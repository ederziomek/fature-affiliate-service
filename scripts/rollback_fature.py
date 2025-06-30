#!/usr/bin/env python3
"""
Script de Rollback de Emergência - Fature CPA v2
Autor: Manus AI
Data: 30 de junho de 2025

Este script permite reverter para o sistema anterior em caso de problemas.
"""

import psycopg2
import psycopg2.extras
import logging
import time
import json
from datetime import datetime
from typing import Dict
import sys
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FatureRollback:
    """Sistema de rollback para emergências"""
    
    def __init__(self):
        self.config = {
            'database': {
                'host': 'hopper.proxy.rlwy.net',
                'port': 48603,
                'database': 'railway',
                'user': 'postgres',
                'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl'
            }
        }
        
        self.rollback_steps = []
        
    def connect_database(self):
        """Conectar ao banco de dados"""
        return psycopg2.connect(**self.config['database'])
    
    def create_backup_tables(self) -> bool:
        """Criar backup das tabelas originais antes da migração"""
        try:
            with self.connect_database() as conn:
                with conn.cursor() as cursor:
                    logger.info("Criando backup das tabelas originais...")
                    
                    # Backup da tabela affiliates original
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS public.affiliates_backup_pre_v2 AS 
                        SELECT * FROM public.affiliates;
                    """)
                    
                    # Backup de outras tabelas críticas se existirem
                    tables_to_backup = ['transactions', 'commissions', 'payments']
                    
                    for table in tables_to_backup:
                        try:
                            cursor.execute(f"""
                                CREATE TABLE IF NOT EXISTS public.{table}_backup_pre_v2 AS 
                                SELECT * FROM public.{table};
                            """)
                            logger.info(f"Backup criado para tabela: {table}")
                        except psycopg2.Error as e:
                            logger.warning(f"Tabela {table} não existe ou erro no backup: {e}")
                    
                    # Criar tabela de log de rollback
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS public.rollback_log (
                            id SERIAL PRIMARY KEY,
                            step_name VARCHAR(255) NOT NULL,
                            executed_at TIMESTAMP DEFAULT NOW(),
                            status VARCHAR(50) DEFAULT 'pending',
                            details TEXT,
                            error_message TEXT
                        );
                    """)
                    
                    conn.commit()
                    logger.info("✅ Backup das tabelas originais criado com sucesso")
                    return True
                    
        except Exception as e:
            logger.error(f"Erro ao criar backup: {e}")
            return False
    
    def log_rollback_step(self, step_name: str, status: str, details: str = None, error: str = None):
        """Registrar passo do rollback"""
        try:
            with self.connect_database() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO public.rollback_log (step_name, status, details, error_message)
                        VALUES (%s, %s, %s, %s)
                    """, (step_name, status, details, error))
                    conn.commit()
        except Exception as e:
            logger.error(f"Erro ao registrar log: {e}")
    
    def check_system_health(self) -> Dict:
        """Verificar saúde do sistema atual"""
        health_status = {
            'v2_schema_exists': False,
            'v2_data_consistent': False,
            'original_backup_exists': False,
            'performance_acceptable': False,
            'critical_errors': []
        }
        
        try:
            with self.connect_database() as conn:
                with conn.cursor() as cursor:
                    # Verificar se schema v2 existe
                    cursor.execute("""
                        SELECT EXISTS(
                            SELECT 1 FROM information_schema.schemata 
                            WHERE schema_name = 'fature_v2'
                        );
                    """)
                    health_status['v2_schema_exists'] = cursor.fetchone()[0]
                    
                    if health_status['v2_schema_exists']:
                        # Verificar consistência dos dados v2
                        cursor.execute("""
                            SELECT 
                                (SELECT COUNT(*) FROM fature_v2.affiliates_optimized) as v2_count,
                                (SELECT COUNT(*) FROM public.affiliates) as original_count;
                        """)
                        v2_count, original_count = cursor.fetchone()
                        health_status['v2_data_consistent'] = (v2_count == original_count)
                        
                        if v2_count != original_count:
                            health_status['critical_errors'].append(
                                f"Inconsistência de dados: Original={original_count}, V2={v2_count}"
                            )
                    
                    # Verificar se backup existe
                    cursor.execute("""
                        SELECT EXISTS(
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_name = 'affiliates_backup_pre_v2'
                        );
                    """)
                    health_status['original_backup_exists'] = cursor.fetchone()[0]
                    
                    # Teste de performance básico
                    if health_status['v2_schema_exists']:
                        start_time = time.time()
                        cursor.execute("""
                            SELECT COUNT(*) FROM fature_v2.affiliates_optimized 
                            WHERE status = 'active';
                        """)
                        cursor.fetchone()
                        query_time = (time.time() - start_time) * 1000
                        health_status['performance_acceptable'] = (query_time < 1000)  # 1 segundo
                        
                        if query_time >= 1000:
                            health_status['critical_errors'].append(
                                f"Performance degradada: {query_time:.2f}ms para consulta básica"
                            )
                    
        except Exception as e:
            health_status['critical_errors'].append(f"Erro na verificação: {e}")
            logger.error(f"Erro ao verificar saúde do sistema: {e}")
        
        return health_status
    
    def rollback_to_original(self) -> bool:
        """Executar rollback completo para sistema original"""
        logger.info("🚨 INICIANDO ROLLBACK DE EMERGÊNCIA 🚨")
        
        try:
            with self.connect_database() as conn:
                with conn.cursor() as cursor:
                    
                    # Passo 1: Verificar se backup existe
                    self.log_rollback_step("check_backup", "started", "Verificando existência do backup")
                    
                    cursor.execute("""
                        SELECT EXISTS(
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_name = 'affiliates_backup_pre_v2'
                        );
                    """)
                    
                    if not cursor.fetchone()[0]:
                        error_msg = "Backup não encontrado! Rollback não é possível."
                        self.log_rollback_step("check_backup", "failed", error=error_msg)
                        logger.error(error_msg)
                        return False
                    
                    self.log_rollback_step("check_backup", "completed", "Backup encontrado")
                    
                    # Passo 2: Criar backup do estado atual (por segurança)
                    self.log_rollback_step("backup_current", "started", "Criando backup do estado atual")
                    
                    cursor.execute("""
                        DROP TABLE IF EXISTS public.affiliates_v2_backup_rollback;
                        CREATE TABLE public.affiliates_v2_backup_rollback AS 
                        SELECT * FROM fature_v2.affiliates_optimized;
                    """)
                    
                    self.log_rollback_step("backup_current", "completed", "Backup do estado atual criado")
                    
                    # Passo 3: Desativar triggers e constraints
                    self.log_rollback_step("disable_constraints", "started", "Desativando constraints")
                    
                    cursor.execute("SET session_replication_role = replica;")
                    
                    self.log_rollback_step("disable_constraints", "completed", "Constraints desativadas")
                    
                    # Passo 4: Restaurar tabela principal
                    self.log_rollback_step("restore_main_table", "started", "Restaurando tabela principal")
                    
                    cursor.execute("""
                        TRUNCATE TABLE public.affiliates;
                        INSERT INTO public.affiliates 
                        SELECT * FROM public.affiliates_backup_pre_v2;
                    """)
                    
                    # Verificar contagem
                    cursor.execute("SELECT COUNT(*) FROM public.affiliates;")
                    restored_count = cursor.fetchone()[0]
                    
                    self.log_rollback_step("restore_main_table", "completed", 
                                         f"Tabela principal restaurada com {restored_count} registros")
                    
                    # Passo 5: Restaurar outras tabelas se necessário
                    tables_to_restore = ['transactions', 'commissions', 'payments']
                    
                    for table in tables_to_restore:
                        try:
                            cursor.execute(f"""
                                SELECT EXISTS(
                                    SELECT 1 FROM information_schema.tables 
                                    WHERE table_name = '{table}_backup_pre_v2'
                                );
                            """)
                            
                            if cursor.fetchone()[0]:
                                self.log_rollback_step(f"restore_{table}", "started", f"Restaurando {table}")
                                
                                cursor.execute(f"""
                                    TRUNCATE TABLE public.{table};
                                    INSERT INTO public.{table} 
                                    SELECT * FROM public.{table}_backup_pre_v2;
                                """)
                                
                                cursor.execute(f"SELECT COUNT(*) FROM public.{table};")
                                count = cursor.fetchone()[0]
                                
                                self.log_rollback_step(f"restore_{table}", "completed", 
                                                     f"{table} restaurada com {count} registros")
                        except Exception as e:
                            self.log_rollback_step(f"restore_{table}", "failed", error=str(e))
                            logger.warning(f"Erro ao restaurar {table}: {e}")
                    
                    # Passo 6: Reativar constraints
                    self.log_rollback_step("enable_constraints", "started", "Reativando constraints")
                    
                    cursor.execute("SET session_replication_role = DEFAULT;")
                    
                    self.log_rollback_step("enable_constraints", "completed", "Constraints reativadas")
                    
                    # Passo 7: Remover schema v2 (opcional, para limpeza)
                    self.log_rollback_step("cleanup_v2", "started", "Limpando schema v2")
                    
                    cursor.execute("DROP SCHEMA IF EXISTS fature_v2 CASCADE;")
                    
                    self.log_rollback_step("cleanup_v2", "completed", "Schema v2 removido")
                    
                    # Commit final
                    conn.commit()
                    
                    logger.info("✅ ROLLBACK CONCLUÍDO COM SUCESSO!")
                    logger.info(f"Sistema restaurado para estado anterior com {restored_count} afiliados")
                    
                    return True
                    
        except Exception as e:
            error_msg = f"Erro crítico durante rollback: {e}"
            logger.error(error_msg)
            self.log_rollback_step("rollback_failed", "failed", error=error_msg)
            return False
    
    def partial_rollback(self, component: str) -> bool:
        """Rollback parcial de componente específico"""
        logger.info(f"Executando rollback parcial: {component}")
        
        if component == "schema_only":
            # Apenas remover schema v2, manter dados originais
            try:
                with self.connect_database() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("DROP SCHEMA IF EXISTS fature_v2 CASCADE;")
                        conn.commit()
                        logger.info("Schema v2 removido com sucesso")
                        return True
            except Exception as e:
                logger.error(f"Erro no rollback do schema: {e}")
                return False
        
        elif component == "triggers_only":
            # Desativar apenas triggers do v2
            try:
                with self.connect_database() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("""
                            SELECT 'DROP TRIGGER IF EXISTS ' || trigger_name || ' ON ' || event_object_table || ';'
                            FROM information_schema.triggers 
                            WHERE trigger_schema = 'fature_v2';
                        """)
                        
                        drop_commands = cursor.fetchall()
                        for cmd in drop_commands:
                            cursor.execute(cmd[0])
                        
                        conn.commit()
                        logger.info("Triggers v2 removidos com sucesso")
                        return True
            except Exception as e:
                logger.error(f"Erro no rollback dos triggers: {e}")
                return False
        
        else:
            logger.error(f"Componente de rollback não reconhecido: {component}")
            return False
    
    def generate_rollback_report(self) -> str:
        """Gerar relatório do rollback"""
        try:
            with self.connect_database() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    cursor.execute("""
                        SELECT step_name, status, executed_at, details, error_message
                        FROM public.rollback_log
                        ORDER BY executed_at DESC
                        LIMIT 50;
                    """)
                    
                    steps = cursor.fetchall()
                    
                    report = "=== RELATÓRIO DE ROLLBACK ===\n\n"
                    
                    for step in steps:
                        status_icon = "✅" if step['status'] == 'completed' else "❌" if step['status'] == 'failed' else "⏳"
                        report += f"{status_icon} {step['step_name']} ({step['status']})\n"
                        report += f"   Executado em: {step['executed_at']}\n"
                        
                        if step['details']:
                            report += f"   Detalhes: {step['details']}\n"
                        
                        if step['error_message']:
                            report += f"   Erro: {step['error_message']}\n"
                        
                        report += "\n"
                    
                    return report
                    
        except Exception as e:
            return f"Erro ao gerar relatório: {e}"

def main():
    rollback = FatureRollback()
    
    if len(sys.argv) < 2:
        print("Uso: python rollback_fature.py [comando]")
        print("Comandos disponíveis:")
        print("  backup          - Criar backup das tabelas originais")
        print("  check           - Verificar saúde do sistema")
        print("  rollback-full   - Rollback completo (CUIDADO!)")
        print("  rollback-schema - Rollback apenas do schema v2")
        print("  report          - Gerar relatório de rollback")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "backup":
        success = rollback.create_backup_tables()
        sys.exit(0 if success else 1)
    
    elif command == "check":
        health = rollback.check_system_health()
        print("=== STATUS DO SISTEMA ===")
        for key, value in health.items():
            if key != 'critical_errors':
                status = "✅" if value else "❌"
                print(f"{status} {key}: {value}")
        
        if health['critical_errors']:
            print("\n🚨 ERROS CRÍTICOS:")
            for error in health['critical_errors']:
                print(f"  - {error}")
        
        sys.exit(0 if not health['critical_errors'] else 1)
    
    elif command == "rollback-full":
        print("⚠️  ATENÇÃO: Você está prestes a executar um rollback completo!")
        print("Isso irá restaurar o sistema para o estado anterior à migração v2.")
        confirm = input("Digite 'CONFIRMAR ROLLBACK' para continuar: ")
        
        if confirm == "CONFIRMAR ROLLBACK":
            success = rollback.rollback_to_original()
            sys.exit(0 if success else 1)
        else:
            print("Rollback cancelado.")
            sys.exit(0)
    
    elif command == "rollback-schema":
        success = rollback.partial_rollback("schema_only")
        sys.exit(0 if success else 1)
    
    elif command == "report":
        report = rollback.generate_rollback_report()
        print(report)
        sys.exit(0)
    
    else:
        print(f"Comando não reconhecido: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

