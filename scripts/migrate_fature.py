#!/usr/bin/env python3
"""
Script Principal de Migração - Sistema Fature CPA v2
Autor: Manus AI
Data: 30 de junho de 2025

Este script executa a migração completa da estrutura atual para a nova arquitetura HPI.
"""

import psycopg2
import psycopg2.extras
import logging
import time
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import sys
import os

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class FatureMigration:
    """Classe principal para migração do sistema Fature"""
    
    def __init__(self):
        """Inicializar configurações de conexão"""
        self.config = {
            'fature_db': {
                'host': 'hopper.proxy.rlwy.net',
                'port': 48603,
                'database': 'railway',
                'user': 'postgres',
                'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl',
                'options': '-c statement_timeout=300000'
            }
        }
        
        self.batch_size = 5000
        self.max_retries = 3
        self.stats = {
            'start_time': None,
            'end_time': None,
            'affiliates_migrated': 0,
            'relationships_created': 0,
            'errors': 0,
            'warnings': 0
        }
        
    def connect_database(self) -> psycopg2.extensions.connection:
        """Estabelecer conexão com o banco de dados"""
        try:
            conn = psycopg2.connect(**self.config['fature_db'])
            conn.autocommit = False
            logger.info("Conexão com banco estabelecida com sucesso")
            return conn
        except Exception as e:
            logger.error(f"Erro ao conectar com banco: {e}")
            raise
    
    def create_new_schema(self, conn: psycopg2.extensions.connection) -> bool:
        """Criar novo schema e estrutura de tabelas"""
        try:
            with conn.cursor() as cursor:
                logger.info("Criando novo schema fature_v2...")
                
                # Criar schema
                cursor.execute("CREATE SCHEMA IF NOT EXISTS fature_v2;")
                cursor.execute("SET search_path TO fature_v2;")
                
                # Habilitar extensões
                cursor.execute("CREATE EXTENSION IF NOT EXISTS ltree;")
                cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;")
                
                # Executar script de criação de tabelas
                with open('create_tables.sql', 'r') as f:
                    cursor.execute(f.read())
                
                conn.commit()
                logger.info("Schema e tabelas criados com sucesso")
                return True
                
        except Exception as e:
            logger.error(f"Erro ao criar schema: {e}")
            conn.rollback()
            return False
    
    def migrate_affiliates_batch(self, conn: psycopg2.extensions.connection, 
                                start_id: int, batch_size: int) -> Dict:
        """Migrar lote de afiliados"""
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                # Buscar afiliados do lote
                cursor.execute("""
                    SELECT affiliate_id, parent_affiliate_id, external_id, name,
                           status, registration_date, total_deposits, total_bets,
                           total_withdrawals, total_cpa_earned, total_rev_earned,
                           total_commissions_paid, created_at, updated_at
                    FROM public.affiliates
                    WHERE affiliate_id > %s AND affiliate_id <= %s
                    ORDER BY affiliate_id
                """, (start_id, start_id + batch_size))
                
                affiliates = cursor.fetchall()
                
                if not affiliates:
                    return {'processed': 0, 'success': 0, 'errors': 0}
                
                # Inserir no novo schema
                success_count = 0
                error_count = 0
                
                for affiliate in affiliates:
                    try:
                        cursor.execute("""
                            INSERT INTO fature_v2.affiliates_optimized (
                                affiliate_id, parent_affiliate_id, external_id, name,
                                status, registration_date, total_deposits, total_bets,
                                total_withdrawals, total_cpa_earned, total_rev_earned,
                                total_commissions_paid, created_at
                            ) VALUES (
                                %(affiliate_id)s, %(parent_affiliate_id)s, %(external_id)s, %(name)s,
                                %(status)s, %(registration_date)s, %(total_deposits)s, %(total_bets)s,
                                %(total_withdrawals)s, %(total_cpa_earned)s, %(total_rev_earned)s,
                                %(total_commissions_paid)s, %(created_at)s
                            )
                        """, affiliate)
                        success_count += 1
                        
                    except Exception as e:
                        logger.error(f"Erro ao migrar afiliado {affiliate['affiliate_id']}: {e}")
                        error_count += 1
                        continue
                
                conn.commit()
                
                return {
                    'processed': len(affiliates),
                    'success': success_count,
                    'errors': error_count
                }
                
        except Exception as e:
            logger.error(f"Erro no lote {start_id}-{start_id + batch_size}: {e}")
            conn.rollback()
            return {'processed': 0, 'success': 0, 'errors': 1}
    
    def build_hierarchy_index(self, conn: psycopg2.extensions.connection) -> bool:
        """Construir índice hierárquico completo"""
        try:
            with conn.cursor() as cursor:
                logger.info("Construindo índice hierárquico...")
                
                # Executar função de construção do índice
                cursor.execute("SELECT * FROM fature_v2.build_complete_hierarchy_index();")
                result = cursor.fetchone()
                
                conn.commit()
                
                logger.info(f"Índice construído: {result[1]} relacionamentos para {result[0]} afiliados")
                logger.info(f"Nível máximo: {result[2]}, Tempo: {result[3]}ms")
                
                self.stats['relationships_created'] = result[1]
                return True
                
        except Exception as e:
            logger.error(f"Erro ao construir índice hierárquico: {e}")
            conn.rollback()
            return False
    
    def validate_migration(self, conn: psycopg2.extensions.connection) -> Dict:
        """Validar integridade da migração"""
        validation_results = {
            'affiliate_count_match': False,
            'hierarchy_integrity': False,
            'referral_counts_match': False,
            'no_orphaned_records': False,
            'performance_acceptable': False
        }
        
        try:
            with conn.cursor() as cursor:
                # Validar contagem de afiliados
                cursor.execute("SELECT COUNT(*) FROM public.affiliates;")
                original_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM fature_v2.affiliates_optimized;")
                new_count = cursor.fetchone()[0]
                
                validation_results['affiliate_count_match'] = (original_count == new_count)
                logger.info(f"Contagem de afiliados - Original: {original_count}, Novo: {new_count}")
                
                # Validar integridade hierárquica
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.affiliates_optimized a
                    WHERE a.parent_affiliate_id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM fature_v2.affiliates_optimized p
                          WHERE p.affiliate_id = a.parent_affiliate_id
                      );
                """)
                orphaned_count = cursor.fetchone()[0]
                validation_results['hierarchy_integrity'] = (orphaned_count == 0)
                logger.info(f"Registros órfãos encontrados: {orphaned_count}")
                
                # Validar contadores de indicações
                cursor.execute("""
                    SELECT 
                        SUM(CASE WHEN direct_referrals_count != actual_count THEN 1 ELSE 0 END) as mismatches
                    FROM (
                        SELECT 
                            a.affiliate_id,
                            a.direct_referrals_count,
                            COUNT(c.affiliate_id) as actual_count
                        FROM fature_v2.affiliates_optimized a
                        LEFT JOIN fature_v2.affiliates_optimized c ON a.affiliate_id = c.parent_affiliate_id
                        GROUP BY a.affiliate_id, a.direct_referrals_count
                    ) counts;
                """)
                count_mismatches = cursor.fetchone()[0] or 0
                validation_results['referral_counts_match'] = (count_mismatches == 0)
                logger.info(f"Inconsistências em contadores: {count_mismatches}")
                
                # Teste de performance
                start_time = time.time()
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.hierarchy_index 
                    WHERE level_distance = 1;
                """)
                cursor.fetchone()
                query_time = (time.time() - start_time) * 1000
                
                validation_results['performance_acceptable'] = (query_time < 100)
                logger.info(f"Tempo de consulta hierárquica: {query_time:.2f}ms")
                
        except Exception as e:
            logger.error(f"Erro na validação: {e}")
        
        return validation_results
    
    def run_migration(self) -> bool:
        """Executar migração completa"""
        self.stats['start_time'] = datetime.now()
        logger.info("=== INICIANDO MIGRAÇÃO FATURE CPA V2 ===")
        
        conn = None
        try:
            # Conectar ao banco
            conn = self.connect_database()
            
            # Criar novo schema
            if not self.create_new_schema(conn):
                return False
            
            # Obter contagem total de afiliados
            with conn.cursor() as cursor:
                cursor.execute("SELECT COUNT(*), MIN(affiliate_id), MAX(affiliate_id) FROM public.affiliates;")
                total_count, min_id, max_id = cursor.fetchone()
            
            logger.info(f"Migrando {total_count} afiliados (IDs: {min_id} - {max_id})")
            
            # Migrar afiliados em lotes
            current_id = min_id - 1
            total_processed = 0
            total_success = 0
            total_errors = 0
            
            while current_id < max_id:
                batch_result = self.migrate_affiliates_batch(conn, current_id, self.batch_size)
                
                total_processed += batch_result['processed']
                total_success += batch_result['success']
                total_errors += batch_result['errors']
                
                if batch_result['processed'] > 0:
                    progress = (total_processed / total_count) * 100
                    logger.info(f"Progresso: {total_processed}/{total_count} ({progress:.1f}%) - "
                              f"Sucessos: {total_success}, Erros: {total_errors}")
                
                current_id += self.batch_size
                
                # Pequena pausa para não sobrecarregar o banco
                time.sleep(0.1)
            
            self.stats['affiliates_migrated'] = total_success
            self.stats['errors'] = total_errors
            
            # Construir índice hierárquico
            if not self.build_hierarchy_index(conn):
                return False
            
            # Validar migração
            validation_results = self.validate_migration(conn)
            
            # Verificar se validação passou
            all_valid = all(validation_results.values())
            
            if all_valid:
                logger.info("✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
                logger.info(f"Afiliados migrados: {self.stats['affiliates_migrated']}")
                logger.info(f"Relacionamentos criados: {self.stats['relationships_created']}")
            else:
                logger.error("❌ MIGRAÇÃO FALHOU NA VALIDAÇÃO")
                for check, result in validation_results.items():
                    status = "✅" if result else "❌"
                    logger.error(f"{status} {check}")
            
            return all_valid
            
        except Exception as e:
            logger.error(f"Erro crítico na migração: {e}")
            return False
            
        finally:
            if conn:
                conn.close()
            
            self.stats['end_time'] = datetime.now()
            duration = self.stats['end_time'] - self.stats['start_time']
            logger.info(f"Tempo total de migração: {duration}")

if __name__ == "__main__":
    migration = FatureMigration()
    success = migration.run_migration()
    
    if success:
        print("🎉 Migração concluída com sucesso!")
        sys.exit(0)
    else:
        print("💥 Migração falhou!")
        sys.exit(1)

