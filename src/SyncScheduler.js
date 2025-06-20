const cron = require('node-cron');
const MLMProcessor = require('./MLMProcessor');

class SyncScheduler {
  constructor(faturePool, externalPool) {
    this.faturePool = faturePool;
    this.externalPool = externalPool;
    this.mlmProcessor = new MLMProcessor(faturePool, externalPool);
    this.isRunning = false;
  }

  // Iniciar agendamentos automáticos
  start() {
    console.log('🕐 Iniciando agendador de sincronização...');

    // Sincronização de afiliados a cada 30 minutos
    cron.schedule('*/30 * * * *', async () => {
      if (!this.isRunning) {
        console.log('🔄 Executando sincronização automática de afiliados...');
        try {
          await this.syncAffiliates();
        } catch (error) {
          console.error('❌ Erro na sincronização automática de afiliados:', error);
        }
      }
    });

    // Processamento MLM completo a cada 6 horas
    cron.schedule('0 */6 * * *', async () => {
      if (!this.isRunning) {
        console.log('🔄 Executando processamento MLM automático...');
        try {
          await this.processMLM();
        } catch (error) {
          console.error('❌ Erro no processamento MLM automático:', error);
        }
      }
    });

    // Sincronização incremental a cada hora
    cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) {
        console.log('🔄 Executando sincronização incremental...');
        try {
          await this.incrementalSync();
        } catch (error) {
          console.error('❌ Erro na sincronização incremental:', error);
        }
      }
    });

    // Limpeza de cache a cada dia às 2:00
    cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Executando limpeza de cache...');
      try {
        await this.cleanupCache();
      } catch (error) {
        console.error('❌ Erro na limpeza de cache:', error);
      }
    });

    console.log('✅ Agendador de sincronização iniciado');
  }

  // Sincronização de afiliados
  async syncAffiliates() {
    if (this.isRunning) {
      console.log('⚠️ Sincronização já em andamento, pulando...');
      return;
    }

    this.isRunning = true;
    
    try {
      console.log('🔄 Iniciando sincronização automática de afiliados...');
      
      await this.faturePool.query(`
        INSERT INTO sync_control (sync_type, status, started_at)
        VALUES ('auto_affiliates_sync', 'running', CURRENT_TIMESTAMP)
        ON CONFLICT (sync_type) 
        DO UPDATE SET 
          status = 'running',
          started_at = CURRENT_TIMESTAMP,
          error_message = NULL
      `);

      // Buscar afiliados do banco da operação
      const externalQuery = `
        SELECT DISTINCT 
          user_afil as external_id,
          COUNT(DISTINCT user_id) as total_clients
        FROM tracked 
        WHERE user_afil IS NOT NULL 
          AND user_id IS NOT NULL 
          AND tracked_type_id = 1
        GROUP BY user_afil
        HAVING COUNT(DISTINCT user_id) > 0
      `;

      const externalResult = await this.externalPool.query(externalQuery);
      
      let processed = 0;
      
      for (const row of externalResult.rows) {
        try {
          await this.faturePool.query(`
            INSERT INTO affiliates (external_id, total_clients, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (external_id) 
            DO UPDATE SET 
              total_clients = EXCLUDED.total_clients,
              updated_at = CURRENT_TIMESTAMP
          `, [row.external_id, row.total_clients]);
          
          processed++;
        } catch (error) {
          console.error(`Erro ao processar afiliado ${row.external_id}:`, error);
        }
      }

      await this.faturePool.query(`
        UPDATE sync_control 
        SET status = 'completed', 
            completed_at = CURRENT_TIMESTAMP,
            records_processed = $1,
            total_records = $2
        WHERE sync_type = 'auto_affiliates_sync'
      `, [processed, externalResult.rows.length]);

      console.log(`✅ Sincronização automática concluída: ${processed} afiliados`);
      
    } catch (error) {
      console.error('❌ Erro na sincronização automática:', error);
      
      await this.faturePool.query(`
        UPDATE sync_control 
        SET status = 'error', 
            error_message = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE sync_type = 'auto_affiliates_sync'
      `, [error.message]);
      
    } finally {
      this.isRunning = false;
    }
  }

  // Processamento MLM completo
  async processMLM() {
    if (this.isRunning) {
      console.log('⚠️ Processamento já em andamento, pulando...');
      return;
    }

    this.isRunning = true;
    
    try {
      await this.mlmProcessor.processAllMLMNetworks();
    } catch (error) {
      console.error('❌ Erro no processamento MLM:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Sincronização incremental
  async incrementalSync() {
    if (this.isRunning) {
      console.log('⚠️ Sincronização já em andamento, pulando...');
      return;
    }

    this.isRunning = true;
    
    try {
      await this.mlmProcessor.incrementalSync();
    } catch (error) {
      console.error('❌ Erro na sincronização incremental:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Limpeza de cache
  async cleanupCache() {
    try {
      console.log('🧹 Limpando cache expirado...');
      
      const result = await this.faturePool.query(`
        DELETE FROM external_data_cache 
        WHERE expires_at < CURRENT_TIMESTAMP
      `);
      
      console.log(`✅ Cache limpo: ${result.rowCount} registros removidos`);
      
      // Log da limpeza
      await this.faturePool.query(`
        INSERT INTO sync_logs (sync_type, level, message, details)
        VALUES ('cache_cleanup', 'info', 'Cache cleanup completed', $1)
      `, [JSON.stringify({ removed_records: result.rowCount })]);
      
    } catch (error) {
      console.error('❌ Erro na limpeza de cache:', error);
    }
  }

  // Parar agendamentos
  stop() {
    console.log('🛑 Parando agendador de sincronização...');
    // Note: node-cron não tem método global para parar todas as tarefas
    // Em produção, você pode manter referências às tarefas para pará-las individualmente
  }

  // Status do agendador
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: [
        { name: 'Affiliate Sync', schedule: 'Every 30 minutes' },
        { name: 'MLM Processing', schedule: 'Every 6 hours' },
        { name: 'Incremental Sync', schedule: 'Every hour' },
        { name: 'Cache Cleanup', schedule: 'Daily at 2:00 AM' }
      ]
    };
  }
}

module.exports = SyncScheduler;

