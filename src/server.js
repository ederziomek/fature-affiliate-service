const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const MLMProcessor = require('./MLMProcessor');
const SyncScheduler = require('./SyncScheduler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = 'affiliate-service';

// Debug das variáveis de ambiente
console.log('🔍 Variáveis de ambiente detectadas:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINIDA' : 'NÃO DEFINIDA');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

// Configuração forçada do banco Fature com fallback
let faturePool;
const databaseUrl = process.env.DATABASE_URL || 
                   process.env.POSTGRES_URL || 
                   process.env.DB_URL ||
                   process.env.RAILWAY_DATABASE_URL ||
                   'postgresql://postgres:VJmQNlGNdqJOhOJQZJdLCGGqCNJqKGdE@junction.proxy.rlwy.net:26847/railway';

console.log('🔗 Usando URL do banco:', databaseUrl.substring(0, 30) + '...');

faturePool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Teste de conexão imediato
faturePool.connect()
  .then(client => {
    console.log('✅ Conexão com banco Fature estabelecida com sucesso!');
    client.release();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar com banco Fature:', err.message);
  });

// Configuração do banco externo (operação)
const externalPool = new Pool({
  host: process.env.EXTERNAL_DB_HOST || '177.115.223.216',
  port: process.env.EXTERNAL_DB_PORT || 5999,
  database: process.env.EXTERNAL_DB_NAME || 'dados_interno',
  user: process.env.EXTERNAL_DB_USER || 'userschapz',
  password: process.env.EXTERNAL_DB_PASSWORD || 'mschaphz8881!',
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar processador MLM e agendador (apenas se banco Fature estiver disponível)
let mlmProcessor, syncScheduler;

if (databaseUrl) {
  mlmProcessor = new MLMProcessor(faturePool, externalPool);
  syncScheduler = new SyncScheduler(faturePool, externalPool);
  
  // Iniciar agendamentos automáticos
  syncScheduler.start();
  console.log('✅ MLM Processor e Scheduler inicializados');
} else {
  console.log('⚠️ MLM Processor não inicializado - banco Fature não configurado');
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const healthStatus = {
            status: 'ok',
            service: SERVICE_NAME,
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            databases: {},
            config: {
                database_url_configured: !!databaseUrl,
                mlm_processor_active: !!mlmProcessor,
                scheduler_active: !!syncScheduler
            }
        };

        // Testar conexão com banco do Fature (se configurado)
        if (databaseUrl) {
            try {
                const fatureTest = await faturePool.query('SELECT NOW()');
                healthStatus.databases.fature = 'connected';
                console.log('✅ Banco Fature: conectado');
            } catch (error) {
                healthStatus.databases.fature = `error: ${error.message}`;
                console.log('❌ Banco Fature:', error.message);
            }
        } else {
            healthStatus.databases.fature = 'not_configured';
            console.log('⚠️ Banco Fature: não configurado');
        }
        
        // Testar conexão com banco da operação
        try {
            const externalTest = await externalPool.query('SELECT NOW()');
            healthStatus.databases.external = 'connected';
            console.log('✅ Banco Operação: conectado');
        } catch (error) {
            healthStatus.databases.external = `error: ${error.message}`;
            console.log('❌ Banco Operação:', error.message);
        }
        
        // Se pelo menos um banco estiver funcionando, retorna 200
        const hasWorkingDatabase = healthStatus.databases.external === 'connected' || 
                                  healthStatus.databases.fature === 'connected';
        
        if (hasWorkingDatabase) {
            res.status(200).json(healthStatus);
        } else {
            healthStatus.status = 'degraded';
            res.status(500).json(healthStatus);
        }
        
    } catch (error) {
        console.log('❌ Health check error:', error.message);
        res.status(500).json({
            status: 'error',
            service: SERVICE_NAME,
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: SERVICE_NAME,
        message: `Microserviço ${SERVICE_NAME} do Sistema Fature com MLM`,
        version: '2.0.0',
        features: [
            'MLM Network Processing',
            'Affiliate Management', 
            'Commission Calculation',
            'Data Synchronization',
            'Real-time Analytics'
        ],
        endpoints: {
            health: '/health',
            api: `/api/v1/${SERVICE_NAME}`,
            affiliates: '/api/v1/affiliates',
            mlm: '/api/v1/mlm',
            sync: '/api/v1/sync'
        }
    });
});

// API principal
app.get(`/api/v1/${SERVICE_NAME}`, (req, res) => {
    res.json({
        service: SERVICE_NAME,
        message: `API do ${SERVICE_NAME} funcionando`,
        timestamp: new Date().toISOString(),
        data: {
            status: 'operational',
            features: [
                'health-check', 
                'mlm-processing', 
                'affiliate-management',
                'data-sync',
                'commission-calculation'
            ]
        }
    });
});

// Endpoint para debug de variáveis de ambiente
app.get('/debug/env', (req, res) => {
    const envVars = {};
    
    // Listar todas as variáveis que começam com DATABASE, POSTGRES, DB
    Object.keys(process.env).forEach(key => {
        if (key.includes('DATABASE') || 
            key.includes('POSTGRES') || 
            key.includes('DB') ||
            key.includes('RAILWAY')) {
            envVars[key] = process.env[key] ? 'DEFINIDA' : 'VAZIA';
        }
    });
    
    res.json({
        service: 'affiliate-service',
        available_env_vars: envVars,
        current_database_url: databaseUrl ? 'CONFIGURADA' : 'NÃO CONFIGURADA',
        database_url_value: databaseUrl ? databaseUrl.substring(0, 50) + '...' : 'NENHUMA'
    });
});

// Endpoint para buscar afiliados
app.get('/api/v1/affiliates', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const query = `
            SELECT 
                id,
                external_id,
                name,
                email,
                status,
                total_clients,
                total_commission,
                created_at
            FROM affiliates
            ORDER BY total_clients DESC
            LIMIT $1 OFFSET $2
        `;

        const countQuery = 'SELECT COUNT(*) as total FROM affiliates';

        const [affiliatesResult, countResult] = await Promise.all([
            faturePool.query(query, [limit, offset]),
            faturePool.query(countQuery)
        ]);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            status: 'success',
            data: affiliatesResult.rows,
            pagination: {
                page,
                pages: totalPages,
                total,
                limit
            }
        });

    } catch (error) {
        console.error('Erro ao buscar afiliados:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar afiliados',
            error: error.message
        });
    }
});

// Endpoint para buscar rede MLM de um afiliado
app.get('/api/v1/affiliates/:id/mlm', async (req, res) => {
    try {
        const affiliateId = parseInt(req.params.id);

        const query = `
            SELECT 
                level,
                client_id,
                path,
                created_at
            FROM mlm_network
            WHERE affiliate_id = $1
            ORDER BY level, client_id
        `;

        const statsQuery = `
            SELECT 
                total_network,
                n1_count,
                n2_count,
                n3_count,
                n4_count,
                n5_count,
                total_commission,
                last_calculated
            FROM mlm_stats
            WHERE affiliate_id = $1
        `;

        const [networkResult, statsResult] = await Promise.all([
            faturePool.query(query, [affiliateId]),
            faturePool.query(statsQuery, [affiliateId])
        ]);

        res.json({
            status: 'success',
            data: {
                affiliate_id: affiliateId,
                network: networkResult.rows,
                stats: statsResult.rows[0] || null
            }
        });

    } catch (error) {
        console.error('Erro ao buscar rede MLM:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar rede MLM',
            error: error.message
        });
    }
});

// Endpoint para estatísticas MLM agregadas
app.get('/api/v1/mlm/stats', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const query = `
            SELECT 
                ms.affiliate_id,
                a.name,
                ms.total_network,
                ms.n1_count,
                ms.n2_count,
                ms.n3_count,
                ms.n4_count,
                ms.n5_count,
                ms.total_commission,
                ms.last_calculated
            FROM mlm_stats ms
            JOIN affiliates a ON ms.affiliate_id = a.id
            ORDER BY ms.total_network DESC
            LIMIT $1 OFFSET $2
        `;

        const countQuery = 'SELECT COUNT(*) as total FROM mlm_stats';

        const [statsResult, countResult] = await Promise.all([
            faturePool.query(query, [limit, offset]),
            faturePool.query(countQuery)
        ]);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            status: 'success',
            data: statsResult.rows,
            pagination: {
                page,
                pages: totalPages,
                total,
                limit
            }
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas MLM:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar estatísticas MLM',
            error: error.message
        });
    }
});

// Endpoint para sincronização manual
app.post('/api/v1/sync/affiliates', async (req, res) => {
    try {
        console.log('🔄 Iniciando sincronização de afiliados...');
        
        // Marcar início da sincronização
        await faturePool.query(`
            INSERT INTO sync_control (sync_type, status, started_at)
            VALUES ('affiliates_sync', 'running', CURRENT_TIMESTAMP)
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

        const externalResult = await externalPool.query(externalQuery);
        
        let processed = 0;
        
        for (const row of externalResult.rows) {
            try {
                await faturePool.query(`
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

        // Marcar conclusão da sincronização
        await faturePool.query(`
            UPDATE sync_control 
            SET status = 'completed', 
                completed_at = CURRENT_TIMESTAMP,
                records_processed = $1,
                total_records = $2
            WHERE sync_type = 'affiliates_sync'
        `, [processed, externalResult.rows.length]);

        res.json({
            status: 'success',
            message: 'Sincronização de afiliados concluída',
            data: {
                processed,
                total: externalResult.rows.length
            }
        });

    } catch (error) {
        console.error('Erro na sincronização:', error);
        
        // Marcar erro na sincronização
        await faturePool.query(`
            UPDATE sync_control 
            SET status = 'error', 
                error_message = $1,
                completed_at = CURRENT_TIMESTAMP
            WHERE sync_type = 'affiliates_sync'
        `, [error.message]);

        res.status(500).json({
            status: 'error',
            message: 'Erro na sincronização de afiliados',
            error: error.message
        });
    }
});

// Endpoint para processamento MLM completo
app.post('/api/v1/mlm/process', async (req, res) => {
    try {
        console.log('🔄 Iniciando processamento MLM manual...');
        
        const result = await mlmProcessor.processAllMLMNetworks();
        
        res.json({
            status: 'success',
            message: 'Processamento MLM concluído',
            data: result
        });

    } catch (error) {
        console.error('Erro no processamento MLM:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro no processamento MLM',
            error: error.message
        });
    }
});

// Endpoint para sincronização incremental
app.post('/api/v1/sync/incremental', async (req, res) => {
    try {
        console.log('🔄 Iniciando sincronização incremental manual...');
        
        const result = await mlmProcessor.incrementalSync();
        
        res.json({
            status: 'success',
            message: 'Sincronização incremental concluída',
            data: result
        });

    } catch (error) {
        console.error('Erro na sincronização incremental:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro na sincronização incremental',
            error: error.message
        });
    }
});

// Endpoint para status de sincronização
app.get('/api/v1/sync/status', async (req, res) => {
    try {
        const result = await faturePool.query(`
            SELECT 
                sync_type,
                status,
                last_sync,
                records_processed,
                total_records,
                error_message,
                started_at,
                completed_at
            FROM sync_control
            ORDER BY last_sync DESC
        `);

        res.json({
            status: 'success',
            data: result.rows
        });

    } catch (error) {
        console.error('Erro ao buscar status de sincronização:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar status de sincronização',
            error: error.message
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        service: SERVICE_NAME,
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        service: SERVICE_NAME,
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ${SERVICE_NAME} v2.0 rodando na porta ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API: http://localhost:${PORT}/api/v1/${SERVICE_NAME}`);
    console.log(`👥 Afiliados: http://localhost:${PORT}/api/v1/affiliates`);
    console.log(`🌐 MLM: http://localhost:${PORT}/api/v1/mlm/stats`);
    console.log(`🔄 Sync: http://localhost:${PORT}/api/v1/sync/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 Recebido SIGTERM, encerrando servidor...');
    faturePool.end();
    externalPool.end();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📴 Recebido SIGINT, encerrando servidor...');
    faturePool.end();
    externalPool.end();
    process.exit(0);
});
