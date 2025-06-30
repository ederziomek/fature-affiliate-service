#!/usr/bin/env python3
"""
Sistema de Monitoramento em Tempo Real - Fature CPA v2
Autor: Manus AI
Data: 30 de junho de 2025

Este script monitora a performance do sistema em tempo real e envia alertas.
"""

import psycopg2
import psycopg2.extras
import time
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List
import smtplib
from email.mime.text import MimeText
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FatureMonitor:
    """Sistema de monitoramento em tempo real"""
    
    def __init__(self):
        self.config = {
            'database': {
                'host': 'hopper.proxy.rlwy.net',
                'port': 48603,
                'database': 'railway',
                'user': 'postgres',
                'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl'
            },
            'alerts': {
                'email': 'admin@fature.com',
                'webhook_url': 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
            },
            'thresholds': {
                'slow_query_ms': 100,
                'max_pending_commissions': 1000,
                'max_error_rate_percent': 5.0,
                'min_throughput_per_second': 100
            }
        }
        
        self.last_metrics = {}
        self.alert_cooldown = {}  # Evitar spam de alertas
        
    def connect_database(self):
        """Conectar ao banco de dados"""
        return psycopg2.connect(**self.config['database'])
    
    def collect_metrics(self) -> Dict:
        """Coletar métricas do sistema"""
        metrics = {
            'timestamp': datetime.now(),
            'affiliates': {},
            'transactions': {},
            'commissions': {},
            'performance': {},
            'system': {}
        }
        
        try:
            with self.connect_database() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                    
                    # Métricas de afiliados
                    cursor.execute("""
                        SELECT 
                            COUNT(*) as total_affiliates,
                            COUNT(*) FILTER (WHERE status = 'active') as active_affiliates,
                            MAX(hierarchy_level) as max_level,
                            AVG(hierarchy_level) as avg_level,
                            COUNT(*) FILTER (WHERE direct_referrals_count > 0) as affiliates_with_referrals,
                            SUM(direct_referrals_count) as total_direct_referrals,
                            SUM(total_network_size) as total_network_size
                        FROM fature_v2.affiliates_optimized;
                    """)
                    metrics['affiliates'] = dict(cursor.fetchone())
                    
                    # Métricas de transações (últimas 24h)
                    cursor.execute("""
                        SELECT 
                            COUNT(*) as transactions_24h,
                            SUM(amount) as volume_24h,
                            AVG(amount) as avg_transaction_amount,
                            COUNT(*) FILTER (WHERE commission_processed = true) as processed_commissions,
                            COUNT(*) FILTER (WHERE transaction_date >= NOW() - INTERVAL '1 hour') as transactions_last_hour
                        FROM fature_v2.transactions
                        WHERE transaction_date >= NOW() - INTERVAL '24 hours';
                    """)
                    metrics['transactions'] = dict(cursor.fetchone())
                    
                    # Métricas de comissões
                    cursor.execute("""
                        SELECT 
                            COUNT(*) as total_commissions_24h,
                            SUM(commission_amount) as total_commission_amount_24h,
                            COUNT(*) FILTER (WHERE status = 'pending') as pending_commissions,
                            COUNT(*) FILTER (WHERE status = 'paid') as paid_commissions_24h,
                            AVG(commission_amount) as avg_commission_amount,
                            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as commissions_last_hour
                        FROM fature_v2.commissions
                        WHERE created_at >= NOW() - INTERVAL '24 hours';
                    """)
                    metrics['commissions'] = dict(cursor.fetchone())
                    
                    # Métricas de performance
                    cursor.execute("""
                        SELECT 
                            COUNT(*) as queries_last_hour,
                            AVG(query_duration_ms) as avg_query_duration,
                            MAX(query_duration_ms) as max_query_duration,
                            COUNT(*) FILTER (WHERE query_duration_ms > %s) as slow_queries,
                            COUNT(DISTINCT query_type) as unique_query_types
                        FROM fature_v2.query_performance_log
                        WHERE created_at >= NOW() - INTERVAL '1 hour';
                    """, (self.config['thresholds']['slow_query_ms'],))
                    metrics['performance'] = dict(cursor.fetchone())
                    
                    # Métricas do sistema
                    cursor.execute("""
                        SELECT 
                            pg_database_size(current_database()) as database_size_bytes,
                            (SELECT COUNT(*) FROM fature_v2.hierarchy_index) as hierarchy_relationships,
                            (SELECT COUNT(*) FROM fature_v2.performance_cache WHERE expires_at > NOW()) as active_cache_entries
                    """)
                    metrics['system'] = dict(cursor.fetchone())
                    
        except Exception as e:
            logger.error(f"Erro ao coletar métricas: {e}")
            
        return metrics
    
    def check_alerts(self, metrics: Dict) -> List[Dict]:
        """Verificar condições de alerta"""
        alerts = []
        
        try:
            # Alerta para consultas lentas
            if metrics['performance'].get('slow_queries', 0) > 10:
                alerts.append({
                    'level': 'WARNING',
                    'type': 'slow_queries',
                    'message': f"Detectadas {metrics['performance']['slow_queries']} consultas lentas na última hora",
                    'value': metrics['performance']['slow_queries'],
                    'threshold': 10
                })
            
            # Alerta para fila de comissões
            pending_commissions = metrics['commissions'].get('pending_commissions', 0)
            if pending_commissions > self.config['thresholds']['max_pending_commissions']:
                level = 'CRITICAL' if pending_commissions > 10000 else 'WARNING'
                alerts.append({
                    'level': level,
                    'type': 'commission_backlog',
                    'message': f"Fila de comissões pendentes: {pending_commissions} registros",
                    'value': pending_commissions,
                    'threshold': self.config['thresholds']['max_pending_commissions']
                })
            
            # Alerta para throughput baixo
            transactions_last_hour = metrics['transactions'].get('transactions_last_hour', 0)
            throughput_per_second = transactions_last_hour / 3600
            if throughput_per_second < self.config['thresholds']['min_throughput_per_second']:
                alerts.append({
                    'level': 'WARNING',
                    'type': 'low_throughput',
                    'message': f"Throughput baixo: {throughput_per_second:.2f} transações/segundo",
                    'value': throughput_per_second,
                    'threshold': self.config['thresholds']['min_throughput_per_second']
                })
            
            # Alerta para crescimento anormal do banco
            if self.last_metrics and 'system' in self.last_metrics:
                current_size = metrics['system'].get('database_size_bytes', 0)
                last_size = self.last_metrics['system'].get('database_size_bytes', 0)
                
                if last_size > 0:
                    growth_rate = (current_size - last_size) / last_size
                    if growth_rate > 0.1:  # Crescimento > 10%
                        alerts.append({
                            'level': 'WARNING',
                            'type': 'database_growth',
                            'message': f"Crescimento rápido do banco: {growth_rate*100:.1f}% desde última verificação",
                            'value': growth_rate * 100,
                            'threshold': 10.0
                        })
            
        except Exception as e:
            logger.error(f"Erro ao verificar alertas: {e}")
        
        return alerts
    
    def send_alert(self, alert: Dict):
        """Enviar alerta via email/webhook"""
        alert_key = f"{alert['type']}_{alert['level']}"
        
        # Verificar cooldown para evitar spam
        if alert_key in self.alert_cooldown:
            if datetime.now() - self.alert_cooldown[alert_key] < timedelta(minutes=15):
                return
        
        try:
            # Enviar para webhook (Slack/Discord/etc)
            if self.config['alerts']['webhook_url']:
                payload = {
                    'text': f"🚨 ALERTA FATURE CPA - {alert['level']}",
                    'attachments': [{
                        'color': 'danger' if alert['level'] == 'CRITICAL' else 'warning',
                        'fields': [
                            {'title': 'Tipo', 'value': alert['type'], 'short': True},
                            {'title': 'Mensagem', 'value': alert['message'], 'short': False},
                            {'title': 'Valor Atual', 'value': str(alert['value']), 'short': True},
                            {'title': 'Limite', 'value': str(alert['threshold']), 'short': True}
                        ],
                        'timestamp': datetime.now().isoformat()
                    }]
                }
                
                response = requests.post(
                    self.config['alerts']['webhook_url'],
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    logger.info(f"Alerta enviado via webhook: {alert['type']}")
                else:
                    logger.error(f"Erro ao enviar webhook: {response.status_code}")
            
            # Registrar cooldown
            self.alert_cooldown[alert_key] = datetime.now()
            
        except Exception as e:
            logger.error(f"Erro ao enviar alerta: {e}")
    
    def generate_report(self, metrics: Dict) -> str:
        """Gerar relatório de status"""
        report = f"""
=== RELATÓRIO DE STATUS FATURE CPA v2 ===
Timestamp: {metrics['timestamp']}

📊 AFILIADOS:
- Total: {metrics['affiliates'].get('total_affiliates', 0):,}
- Ativos: {metrics['affiliates'].get('active_affiliates', 0):,}
- Com indicações: {metrics['affiliates'].get('affiliates_with_referrals', 0):,}
- Nível máximo: {metrics['affiliates'].get('max_level', 0)}
- Rede total: {metrics['affiliates'].get('total_network_size', 0):,}

💰 TRANSAÇÕES (24h):
- Total: {metrics['transactions'].get('transactions_24h', 0):,}
- Volume: R$ {metrics['transactions'].get('volume_24h', 0):,.2f}
- Média: R$ {metrics['transactions'].get('avg_transaction_amount', 0):,.2f}
- Última hora: {metrics['transactions'].get('transactions_last_hour', 0):,}

🎯 COMISSÕES (24h):
- Total: {metrics['commissions'].get('total_commissions_24h', 0):,}
- Valor: R$ {metrics['commissions'].get('total_commission_amount_24h', 0):,.2f}
- Pendentes: {metrics['commissions'].get('pending_commissions', 0):,}
- Pagas: {metrics['commissions'].get('paid_commissions_24h', 0):,}

⚡ PERFORMANCE (1h):
- Consultas: {metrics['performance'].get('queries_last_hour', 0):,}
- Duração média: {metrics['performance'].get('avg_query_duration', 0):.1f}ms
- Consultas lentas: {metrics['performance'].get('slow_queries', 0)}

🖥️ SISTEMA:
- Tamanho do banco: {metrics['system'].get('database_size_bytes', 0) / 1024 / 1024 / 1024:.2f} GB
- Relacionamentos: {metrics['system'].get('hierarchy_relationships', 0):,}
- Cache ativo: {metrics['system'].get('active_cache_entries', 0):,}
"""
        return report
    
    def run_monitoring_cycle(self):
        """Executar um ciclo de monitoramento"""
        logger.info("Coletando métricas...")
        metrics = self.collect_metrics()
        
        # Verificar alertas
        alerts = self.check_alerts(metrics)
        
        # Enviar alertas se necessário
        for alert in alerts:
            logger.warning(f"ALERTA: {alert['message']}")
            self.send_alert(alert)
        
        # Gerar e exibir relatório
        report = self.generate_report(metrics)
        logger.info(report)
        
        # Salvar métricas para próxima comparação
        self.last_metrics = metrics
        
        return len(alerts) == 0  # Retorna True se não há alertas
    
    def run_continuous_monitoring(self, interval_seconds: int = 300):
        """Executar monitoramento contínuo"""
        logger.info(f"Iniciando monitoramento contínuo (intervalo: {interval_seconds}s)")
        
        while True:
            try:
                healthy = self.run_monitoring_cycle()
                
                if healthy:
                    logger.info("✅ Sistema operando normalmente")
                else:
                    logger.warning("⚠️ Alertas detectados")
                
                time.sleep(interval_seconds)
                
            except KeyboardInterrupt:
                logger.info("Monitoramento interrompido pelo usuário")
                break
            except Exception as e:
                logger.error(f"Erro no monitoramento: {e}")
                time.sleep(60)  # Aguardar 1 minuto antes de tentar novamente

if __name__ == "__main__":
    import sys
    
    monitor = FatureMonitor()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        # Monitoramento contínuo
        interval = int(sys.argv[2]) if len(sys.argv) > 2 else 300
        monitor.run_continuous_monitoring(interval)
    else:
        # Execução única
        healthy = monitor.run_monitoring_cycle()
        sys.exit(0 if healthy else 1)

