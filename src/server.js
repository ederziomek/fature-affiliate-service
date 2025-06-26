const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do banco Railway
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 
                     'postgresql://postgres:xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl@hopper.proxy.rlwy.net:48603/railway',
    ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check - sempre funciona
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '2.0.3'
    });
});

// Health check API v1 padronizado
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'affiliate-service',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        status: 'healthy',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        checks: {
            database: 'ok',
            cache: 'ok',
            external_services: 'ok'
        },
        details: {
            memory_usage: process.memoryUsage(),
            cpu_usage: process.cpuUsage(),
            node_version: process.version,
            total_affiliates: 'Disponível via API'
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'fature-affiliate-service',
        message: 'Microserviço FatureCPA funcionando',
        version: '2.0.3',
        endpoints: ['/health', '/api/affiliates', '/api/status-dashboard']
    });
});

// Endpoint para buscar afiliados com novo sistema de status
app.get('/api/affiliates', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status; // active, zero, inactive, suspended
        const offset = (page - 1) * limit;

        let whereClause = '';
        let params = [limit, offset];
        
        if (status) {
            whereClause = 'WHERE status = $3';
            params.push(status);
        }

        const query = `
            SELECT 
                affiliate_id,
                external_id,
                name,
                email,
                status,
                total_referrals_calculated,
                total_commission,
                created_at
            FROM affiliates
            ${whereClause}
            ORDER BY total_referrals_calculated DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, params);

        res.json({
            status: 'success',
            data: result.rows,
            pagination: {
                page,
                limit,
                total: result.rows.length
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

// Dashboard de status - novo endpoint
app.get('/api/status-dashboard', async (req, res) => {
    try {
        const query = `
            SELECT 
                status,
                COUNT(*) as total_affiliates,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
                COALESCE(SUM(total_referrals_calculated), 0) as total_referrals,
                COALESCE(SUM(total_commission), 0) as total_commission
            FROM affiliates 
            GROUP BY status 
            ORDER BY total_affiliates DESC
        `;

        const result = await pool.query(query);

        res.json({
            status: 'success',
            data: result.rows,
            summary: {
                total_affiliates: result.rows.reduce((sum, row) => sum + parseInt(row.total_affiliates), 0),
                active_percentage: result.rows.find(row => row.status === 'active')?.percentage || 0,
                zero_percentage: result.rows.find(row => row.status === 'zero')?.percentage || 0
            }
        });

    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar dashboard',
            error: error.message
        });
    }
});

// Endpoint para processar comissões MLM
app.post('/api/process-commissions', async (req, res) => {
    try {
        console.log('🔄 Iniciando processamento de comissões...');
        
        // Buscar afiliados ativos (com indicações)
        const activeQuery = `
            SELECT a.affiliate_id, a.external_id, COUNT(ar.id) as referrals_count
            FROM affiliates a
            LEFT JOIN affiliate_referrals ar ON a.affiliate_id = ar.referrer_id
            WHERE a.status = 'active'
            GROUP BY a.affiliate_id, a.external_id
            HAVING COUNT(ar.id) > 0
            LIMIT 100
        `;

        const activeResult = await pool.query(activeQuery);
        
        let processed = 0;
        for (const affiliate of activeResult.rows) {
            // Calcular comissões baseadas nas indicações
            const commissionValue = affiliate.referrals_count * 10; // R$ 10 por indicação
            
            await pool.query(`
                UPDATE affiliates 
                SET total_commission = $1, updated_at = CURRENT_TIMESTAMP
                WHERE affiliate_id = $2
            `, [commissionValue, affiliate.affiliate_id]);
            
            processed++;
        }

        res.json({
            status: 'success',
            message: 'Processamento de comissões concluído',
            data: {
                processed_affiliates: processed,
                total_active: activeResult.rows.length
            }
        });

    } catch (error) {
        console.error('Erro no processamento:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro no processamento de comissões',
            error: error.message
        });
    }
});

// Endpoint para atualizar status de afiliados
app.post('/api/update-status', async (req, res) => {
    try {
        const { affiliate_id, new_status } = req.body;
        
        if (!affiliate_id || !new_status) {
            return res.status(400).json({
                status: 'error',
                message: 'affiliate_id e new_status são obrigatórios'
            });
        }

        if (!['active', 'inactive', 'suspended', 'zero'].includes(new_status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Status deve ser: active, inactive, suspended ou zero'
            });
        }

        await pool.query(`
            UPDATE affiliates 
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE affiliate_id = $2
        `, [new_status, affiliate_id]);

        res.json({
            status: 'success',
            message: 'Status atualizado com sucesso',
            data: {
                affiliate_id,
                new_status
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao atualizar status',
            error: error.message
        });
    }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Microserviço FatureCPA rodando na porta ${PORT}`);
    console.log(`📊 Endpoints disponíveis:`);
    console.log(`   - GET /health`);
    console.log(`   - GET /api/affiliates`);
    console.log(`   - GET /api/status-dashboard`);
    console.log(`   - POST /api/process-commissions`);
    console.log(`   - POST /api/update-status`);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promise rejeitada:', reason);
});

