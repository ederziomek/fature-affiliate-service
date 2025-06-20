const { Pool } = require('pg');

class MLMProcessor {
  constructor(faturePool, externalPool) {
    this.faturePool = faturePool;
    this.externalPool = externalPool;
    this.maxLevels = 5;
  }

  // Processar rede MLM completa de todos os afiliados
  async processAllMLMNetworks() {
    console.log('🔄 Iniciando processamento completo da rede MLM...');
    
    try {
      // Marcar início do processamento
      await this.faturePool.query(`
        INSERT INTO sync_control (sync_type, status, started_at)
        VALUES ('mlm_network_sync', 'running', CURRENT_TIMESTAMP)
        ON CONFLICT (sync_type) 
        DO UPDATE SET 
          status = 'running',
          started_at = CURRENT_TIMESTAMP,
          error_message = NULL
      `);

      // Limpar dados MLM antigos
      await this.faturePool.query('DELETE FROM mlm_network');
      await this.faturePool.query('DELETE FROM mlm_stats');

      // Buscar todos os afiliados
      const affiliatesResult = await this.faturePool.query(
        'SELECT id, external_id FROM affiliates WHERE external_id IS NOT NULL'
      );

      let processed = 0;
      const total = affiliatesResult.rows.length;

      for (const affiliate of affiliatesResult.rows) {
        try {
          await this.processAffiliateMLM(affiliate.id, affiliate.external_id);
          processed++;
          
          if (processed % 100 === 0) {
            console.log(`📈 Progresso MLM: ${processed}/${total} afiliados processados`);
          }
        } catch (error) {
          console.error(`❌ Erro ao processar MLM do afiliado ${affiliate.external_id}:`, error);
        }
      }

      // Marcar conclusão
      await this.faturePool.query(`
        UPDATE sync_control 
        SET status = 'completed', 
            completed_at = CURRENT_TIMESTAMP,
            records_processed = $1,
            total_records = $2
        WHERE sync_type = 'mlm_network_sync'
      `, [processed, total]);

      console.log(`✅ Processamento MLM concluído: ${processed}/${total} afiliados`);
      return { processed, total };

    } catch (error) {
      console.error('❌ Erro no processamento MLM:', error);
      
      await this.faturePool.query(`
        UPDATE sync_control 
        SET status = 'error', 
            error_message = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE sync_type = 'mlm_network_sync'
      `, [error.message]);
      
      throw error;
    }
  }

  // Processar rede MLM de um afiliado específico
  async processAffiliateMLM(affiliateId, externalId) {
    const network = new Map();
    const processed = new Set();
    
    // Processar níveis recursivamente
    await this.processMLMLevel(externalId, 1, [externalId], network, processed);
    
    // Salvar rede no banco
    await this.saveMLMNetwork(affiliateId, network);
    
    // Calcular e salvar estatísticas
    await this.calculateMLMStats(affiliateId, network);
  }

  // Processar um nível específico da rede MLM
  async processMLMLevel(affiliateId, currentLevel, path, network, processed) {
    if (currentLevel > this.maxLevels) return;
    
    // Buscar indicações diretas do afiliado
    const query = `
      SELECT user_id as client_id
      FROM tracked 
      WHERE user_afil = $1 
        AND user_id IS NOT NULL 
        AND tracked_type_id = 1
    `;
    
    const result = await this.externalPool.query(query, [affiliateId]);
    
    for (const row of result.rows) {
      const clientId = row.client_id;
      const networkKey = `${affiliateId}-${clientId}-${currentLevel}`;
      
      // Evitar loops e duplicatas
      if (processed.has(networkKey) || path.includes(clientId)) {
        continue;
      }
      
      processed.add(networkKey);
      
      // Adicionar à rede
      if (!network.has(currentLevel)) {
        network.set(currentLevel, []);
      }
      
      network.get(currentLevel).push({
        client_id: clientId,
        level: currentLevel,
        path: [...path],
        direct_sponsor: affiliateId
      });
      
      // Processar próximo nível se o cliente também é afiliado
      if (currentLevel < this.maxLevels) {
        await this.processMLMLevel(clientId, currentLevel + 1, [...path, clientId], network, processed);
      }
    }
  }

  // Salvar rede MLM no banco
  async saveMLMNetwork(affiliateId, network) {
    const client = await this.faturePool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const [level, connections] of network) {
        for (const connection of connections) {
          await client.query(`
            INSERT INTO mlm_network (affiliate_id, client_id, level, path, direct_sponsor)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            affiliateId,
            connection.client_id,
            connection.level,
            connection.path,
            connection.direct_sponsor
          ]);
        }
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Calcular estatísticas MLM
  async calculateMLMStats(affiliateId, network) {
    const stats = {
      total_network: 0,
      n1_count: 0,
      n2_count: 0,
      n3_count: 0,
      n4_count: 0,
      n5_count: 0
    };

    for (const [level, connections] of network) {
      const count = connections.length;
      stats.total_network += count;
      
      switch (level) {
        case 1: stats.n1_count = count; break;
        case 2: stats.n2_count = count; break;
        case 3: stats.n3_count = count; break;
        case 4: stats.n4_count = count; break;
        case 5: stats.n5_count = count; break;
      }
    }

    await this.faturePool.query(`
      INSERT INTO mlm_stats (
        affiliate_id, total_network, n1_count, n2_count, 
        n3_count, n4_count, n5_count, last_calculated
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (affiliate_id) 
      DO UPDATE SET 
        total_network = EXCLUDED.total_network,
        n1_count = EXCLUDED.n1_count,
        n2_count = EXCLUDED.n2_count,
        n3_count = EXCLUDED.n3_count,
        n4_count = EXCLUDED.n4_count,
        n5_count = EXCLUDED.n5_count,
        last_calculated = EXCLUDED.last_calculated
    `, [
      affiliateId,
      stats.total_network,
      stats.n1_count,
      stats.n2_count,
      stats.n3_count,
      stats.n4_count,
      stats.n5_count
    ]);
  }

  // Sincronização incremental (apenas novos dados)
  async incrementalSync() {
    console.log('🔄 Iniciando sincronização incremental...');
    
    try {
      // Buscar última sincronização
      const lastSyncResult = await this.faturePool.query(`
        SELECT last_sync FROM sync_control 
        WHERE sync_type = 'incremental_sync'
      `);
      
      const lastSync = lastSyncResult.rows[0]?.last_sync || '1970-01-01';
      
      // Buscar novos dados desde a última sincronização
      // (Aqui assumimos que há um campo de timestamp na tabela tracked)
      const newDataQuery = `
        SELECT DISTINCT user_afil as external_id
        FROM tracked 
        WHERE user_afil IS NOT NULL 
          AND user_id IS NOT NULL 
          AND tracked_type_id = 1
        -- AND updated_at > $1  -- Descomente se houver campo de timestamp
      `;
      
      const newDataResult = await this.externalPool.query(newDataQuery);
      
      let processed = 0;
      
      for (const row of newDataResult.rows) {
        try {
          // Verificar se afiliado existe no banco Fature
          const affiliateResult = await this.faturePool.query(
            'SELECT id FROM affiliates WHERE external_id = $1',
            [row.external_id]
          );
          
          if (affiliateResult.rows.length > 0) {
            const affiliateId = affiliateResult.rows[0].id;
            
            // Reprocessar MLM do afiliado
            await this.processAffiliateMLM(affiliateId, row.external_id);
            processed++;
          }
        } catch (error) {
          console.error(`Erro na sincronização incremental do afiliado ${row.external_id}:`, error);
        }
      }
      
      // Atualizar timestamp da última sincronização
      await this.faturePool.query(`
        INSERT INTO sync_control (sync_type, status, last_sync, records_processed)
        VALUES ('incremental_sync', 'completed', CURRENT_TIMESTAMP, $1)
        ON CONFLICT (sync_type) 
        DO UPDATE SET 
          status = 'completed',
          last_sync = CURRENT_TIMESTAMP,
          records_processed = EXCLUDED.records_processed
      `, [processed]);
      
      console.log(`✅ Sincronização incremental concluída: ${processed} afiliados atualizados`);
      return { processed };
      
    } catch (error) {
      console.error('❌ Erro na sincronização incremental:', error);
      throw error;
    }
  }
}

module.exports = MLMProcessor;

