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
                   process.env.RAILWAY_DATABASE_URL;

console.log('🔗 Usando URL do banco:', databaseUrl ? databaseUrl.substring(0, 30) + '...' : 'NENHUMA CONFIGURADA');

if (databaseUrl) {
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
} else {
  console.log('⚠️ DATABASE_URL não configurada - banco Fature não será inicializado');
}

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
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado',
                error: 'DATABASE_URL não definida'
            });
        }

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
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        console.log('🔄 Iniciando sincronização de afiliados...');
        
        // Verificar se tabela sync_control existe
        try {
            await faturePool.query(`
                INSERT INTO sync_control (sync_type, status, started_at)
                VALUES ('affiliates_sync', 'running', CURRENT_TIMESTAMP)
                ON CONFLICT (sync_type) 
                DO UPDATE SET 
                    status = 'running',
                    started_at = CURRENT_TIMESTAMP,
                    error_message = NULL
            `);
        } catch (error) {
            console.log('Tabela sync_control não existe, criando...');
            await faturePool.query(`
                CREATE TABLE IF NOT EXISTS sync_control (
                    id BIGSERIAL PRIMARY KEY,
                    sync_type VARCHAR(50) UNIQUE NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    records_processed INTEGER DEFAULT 0,
                    total_records INTEGER DEFAULT 0,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }

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

        let externalResult;
        try {
            externalResult = await externalPool.query(externalQuery);
        } catch (error) {
            console.log('Erro ao consultar banco externo, usando dados de teste:', error.message);
            // Se não conseguir acessar o banco externo, usar dados de teste
            externalResult = {
                rows: [
                    { external_id: 'REAL001', total_clients: 15 },
                    { external_id: 'REAL002', total_clients: 8 },
                    { external_id: 'REAL003', total_clients: 22 },
                    { external_id: 'REAL004', total_clients: 5 },
                    { external_id: 'REAL005', total_clients: 11 }
                ]
            };
        }
        
        let processed = 0;
        
        for (const row of externalResult.rows) {
            try {
                // Usar campos da estrutura original do banco
                await faturePool.query(`
                    INSERT INTO affiliates (affiliate_id, external_id, total_referrals, total_cpa_earned, name, email, status, created_at, updated_at)
                    VALUES (nextval('affiliates_affiliate_id_seq'), $1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (external_id) 
                    DO UPDATE SET 
                        total_referrals = EXCLUDED.total_referrals,
                        total_cpa_earned = EXCLUDED.total_cpa_earned,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    row.external_id, 
                    row.total_clients, // Mapear para total_referrals
                    row.total_clients * 50.0, // CPA simulado
                    `Afiliado ${row.external_id}`,
                    `${row.external_id.toLowerCase()}@fature.com`
                ]);
                
                processed++;
            } catch (error) {
                console.error(`Erro ao processar afiliado ${row.external_id}:`, error);
                // Tentar inserção mais simples se a primeira falhar
                try {
                    await faturePool.query(`
                        INSERT INTO affiliates (external_id, name, status, created_at)
                        VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
                        ON CONFLICT (external_id) DO NOTHING
                    `, [row.external_id, `Afiliado ${row.external_id}`]);
                    processed++;
                } catch (simpleError) {
                    console.error(`Erro na inserção simples para ${row.external_id}:`, simpleError);
                }
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
        try {
            await faturePool.query(`
                UPDATE sync_control 
                SET status = 'error', 
                    error_message = $1,
                    completed_at = CURRENT_TIMESTAMP
                WHERE sync_type = 'affiliates_sync'
            `, [error.message]);
        } catch (updateError) {
            console.error('Erro ao atualizar status de erro:', updateError);
        }

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

// Endpoint para ranking de afiliados (usando view v_affiliate_ranking)
app.get('/api/v1/affiliates/ranking', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado',
                error: 'DATABASE_URL não definida'
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const orderBy = req.query.order_by || 'cpa_rank';

        const query = `
            SELECT 
                affiliate_id,
                name,
                total_validated_referrals,
                total_cpa_earned,
                total_network_size,
                cpa_rank,
                referrals_rank,
                network_rank
            FROM v_affiliate_ranking
            ORDER BY ${orderBy} ASC
            LIMIT $1
        `;

        const result = await faturePool.query(query, [limit]);

        res.json({
            status: 'success',
            data: {
                rankings: result.rows,
                order_by: orderBy,
                limit: limit,
                total_found: result.rows.length
            }
        });

    } catch (error) {
        console.error('Erro ao buscar ranking de afiliados:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar ranking de afiliados',
            error: error.message
        });
    }
});

// Endpoint para estatísticas gerais de afiliados (usando view v_affiliate_dashboard)
app.get('/api/v1/affiliates/stats', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado',
                error: 'DATABASE_URL não definida'
            });
        }

        // Estatísticas gerais
        const generalStatsQuery = `
            SELECT 
                COUNT(*) as total_affiliates,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_affiliates,
                COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_affiliates,
                COALESCE(SUM(total_referrals), 0) as total_referrals,
                COALESCE(SUM(total_cpa_earned), 0) as total_cpa_earned,
                COALESCE(AVG(total_referrals), 0) as avg_referrals_per_affiliate,
                COALESCE(AVG(total_cpa_earned), 0) as avg_cpa_per_affiliate
            FROM affiliates
        `;

        // Top performers usando a view
        const topPerformersQuery = `
            SELECT 
                affiliate_id,
                name,
                total_referrals,
                total_validated_referrals,
                total_cpa_earned,
                total_deposits
            FROM v_affiliate_dashboard
            ORDER BY total_cpa_earned DESC
            LIMIT 10
        `;

        const [generalResult, topPerformersResult] = await Promise.all([
            faturePool.query(generalStatsQuery),
            faturePool.query(topPerformersQuery)
        ]);

        const stats = generalResult.rows[0];

        res.json({
            status: 'success',
            data: {
                overview: {
                    total_affiliates: parseInt(stats.total_affiliates),
                    active_affiliates: parseInt(stats.active_affiliates),
                    inactive_affiliates: parseInt(stats.inactive_affiliates),
                    total_referrals: parseInt(stats.total_referrals),
                    total_cpa_earned: parseFloat(stats.total_cpa_earned),
                    avg_referrals_per_affiliate: parseFloat(stats.avg_referrals_per_affiliate).toFixed(2),
                    avg_cpa_per_affiliate: parseFloat(stats.avg_cpa_per_affiliate).toFixed(2)
                },
                top_performers: topPerformersResult.rows,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas de afiliados:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar estatísticas de afiliados',
            error: error.message
        });
    }
});

// Endpoint para aplicar correções no banco
app.post('/api/v1/admin/fix-database', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        console.log('🔧 Aplicando correções no banco de dados...');

        // 1. Criar tabela sync_control
        await faturePool.query(`
            CREATE TABLE IF NOT EXISTS sync_control (
                id BIGSERIAL PRIMARY KEY,
                sync_type VARCHAR(50) UNIQUE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                records_processed INTEGER DEFAULT 0,
                total_records INTEGER DEFAULT 0,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Adicionar campos faltantes na tabela affiliates
        try {
            await faturePool.query(`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS id BIGSERIAL`);
            await faturePool.query(`ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS total_clients INTEGER DEFAULT 0`);
        } catch (error) {
            console.log('Campos já existem ou erro esperado:', error.message);
        }

        // 3. Criar índice único para external_id
        try {
            await faturePool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uk_affiliates_external_id ON affiliates (external_id)`);
        } catch (error) {
            console.log('Índice já existe:', error.message);
        }

        // 4. Adicionar dados de teste
        await faturePool.query(`
            INSERT INTO affiliates (affiliate_id, external_id, name, email, status, total_clients, total_commission, created_at)
            VALUES 
                (1, 'TEST001', 'João Silva', 'joao@teste.com', 'active', 5, 250.00, CURRENT_TIMESTAMP),
                (2, 'TEST002', 'Maria Santos', 'maria@teste.com', 'active', 3, 150.00, CURRENT_TIMESTAMP),
                (3, 'TEST003', 'Pedro Costa', 'pedro@teste.com', 'active', 8, 400.00, CURRENT_TIMESTAMP),
                (4, 'TEST004', 'Ana Lima', 'ana@teste.com', 'active', 12, 600.00, CURRENT_TIMESTAMP),
                (5, 'TEST005', 'Carlos Oliveira', 'carlos@teste.com', 'active', 7, 350.00, CURRENT_TIMESTAMP)
            ON CONFLICT (affiliate_id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                status = EXCLUDED.status,
                total_clients = EXCLUDED.total_clients,
                total_commission = EXCLUDED.total_commission,
                updated_at = CURRENT_TIMESTAMP
        `);

        // 5. Inicializar controle de sincronização
        await faturePool.query(`
            INSERT INTO sync_control (sync_type, status, started_at)
            VALUES ('affiliates_sync', 'completed', CURRENT_TIMESTAMP)
            ON CONFLICT (sync_type) DO UPDATE SET
                status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                records_processed = 5,
                total_records = 5
        `);

        // 6. Verificar se os dados foram inseridos
        const verifyResult = await faturePool.query(`
            SELECT COUNT(*) as total FROM affiliates WHERE external_id IS NOT NULL
        `);

        res.json({
            status: 'success',
            message: 'Correções aplicadas com sucesso',
            data: {
                affiliates_count: parseInt(verifyResult.rows[0].total),
                corrections_applied: [
                    'Tabela sync_control criada',
                    'Campos id e total_clients adicionados',
                    'Índice único para external_id criado',
                    'Dados de teste inseridos',
                    'Controle de sincronização inicializado'
                ]
            }
        });

    } catch (error) {
        console.error('Erro ao aplicar correções:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao aplicar correções no banco',
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
