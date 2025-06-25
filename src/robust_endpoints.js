// Novos endpoints para aproveitar a estrutura robusta
// Adicionar ao final do arquivo server.js

// Endpoint para buscar dados detalhados de um afiliado (estrutura robusta)
app.get('/api/v1/affiliates/:id/details', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        const affiliateId = parseInt(req.params.id);

        // Buscar dados principais do afiliado
        const affiliateQuery = `
            SELECT 
                affiliate_id,
                external_id,
                name,
                email,
                phone,
                document,
                status,
                registration_date,
                last_activity,
                total_referrals,
                total_validated_referrals,
                total_deposits,
                total_bets,
                total_withdrawals,
                total_ggr,
                total_cpa_earned,
                total_rev_earned,
                total_commissions_paid,
                created_at,
                updated_at
            FROM affiliates
            WHERE affiliate_id = $1
        `;

        // Buscar estrutura MLM
        const mlmQuery = `
            SELECT 
                level_1_count,
                level_2_count,
                level_3_count,
                level_4_count,
                level_5_count,
                total_network_size,
                level_1_deposits,
                level_2_deposits,
                level_3_deposits,
                level_4_deposits,
                level_5_deposits,
                level_1_bets,
                level_2_bets,
                level_3_bets,
                level_4_bets,
                level_5_bets
            FROM affiliate_mlm_structure
            WHERE affiliate_id = $1
        `;

        // Buscar transações financeiras recentes
        const transactionsQuery = `
            SELECT 
                transaction_type,
                amount,
                level,
                description,
                created_at
            FROM affiliate_financial_transactions
            WHERE affiliate_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `;

        // Buscar validações CPA
        const cpaQuery = `
            SELECT 
                validation_type,
                criteria_met,
                commission_amount,
                level,
                validation_date,
                status
            FROM affiliate_cpa_validations
            WHERE affiliate_id = $1
            ORDER BY validation_date DESC
            LIMIT 5
        `;

        const [affiliateResult, mlmResult, transactionsResult, cpaResult] = await Promise.all([
            faturePool.query(affiliateQuery, [affiliateId]),
            faturePool.query(mlmQuery, [affiliateId]),
            faturePool.query(transactionsQuery, [affiliateId]),
            faturePool.query(cpaQuery, [affiliateId])
        ]);

        if (affiliateResult.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Afiliado não encontrado'
            });
        }

        res.json({
            status: 'success',
            data: {
                affiliate: affiliateResult.rows[0],
                mlm_structure: mlmResult.rows[0] || null,
                recent_transactions: transactionsResult.rows,
                cpa_validations: cpaResult.rows,
                summary: {
                    total_network_levels: 5,
                    has_mlm_data: mlmResult.rows.length > 0,
                    recent_activity: transactionsResult.rows.length > 0,
                    cpa_validations_count: cpaResult.rows.length
                }
            }
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes do afiliado:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar detalhes do afiliado',
            error: error.message
        });
    }
});

// Endpoint para buscar resumos periódicos
app.get('/api/v1/affiliates/:id/summaries', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        const affiliateId = parseInt(req.params.id);
        const period = req.query.period || 'monthly'; // daily, weekly, monthly

        const query = `
            SELECT 
                period_type,
                period_start,
                period_end,
                total_referrals,
                total_deposits,
                total_bets,
                total_ggr,
                commission_earned,
                network_growth,
                created_at
            FROM affiliate_periodic_summaries
            WHERE affiliate_id = $1 
                AND period_type = $2
            ORDER BY period_start DESC
            LIMIT 12
        `;

        const result = await faturePool.query(query, [affiliateId, period]);

        res.json({
            status: 'success',
            data: {
                affiliate_id: affiliateId,
                period_type: period,
                summaries: result.rows,
                total_periods: result.rows.length
            }
        });

    } catch (error) {
        console.error('Erro ao buscar resumos periódicos:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar resumos periódicos',
            error: error.message
        });
    }
});

// Endpoint para analytics avançados
app.get('/api/v1/analytics/performance', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        const period = req.query.period || '30'; // dias
        const limit = parseInt(req.query.limit) || 20;

        // Performance por nível MLM
        const levelPerformanceQuery = `
            SELECT 
                'Level 1' as level,
                SUM(level_1_count) as total_referrals,
                SUM(level_1_deposits) as total_deposits,
                SUM(level_1_bets) as total_bets,
                COUNT(*) as affiliates_count
            FROM affiliate_mlm_structure
            WHERE level_1_count > 0
            UNION ALL
            SELECT 
                'Level 2' as level,
                SUM(level_2_count) as total_referrals,
                SUM(level_2_deposits) as total_deposits,
                SUM(level_2_bets) as total_bets,
                COUNT(*) as affiliates_count
            FROM affiliate_mlm_structure
            WHERE level_2_count > 0
            UNION ALL
            SELECT 
                'Level 3' as level,
                SUM(level_3_count) as total_referrals,
                SUM(level_3_deposits) as total_deposits,
                SUM(level_3_bets) as total_bets,
                COUNT(*) as affiliates_count
            FROM affiliate_mlm_structure
            WHERE level_3_count > 0
            ORDER BY level
        `;

        // Top performers por diferentes métricas
        const topPerformersQuery = `
            SELECT 
                a.affiliate_id,
                a.name,
                a.total_cpa_earned,
                a.total_deposits,
                a.total_ggr,
                m.total_network_size,
                RANK() OVER (ORDER BY a.total_cpa_earned DESC) as cpa_rank,
                RANK() OVER (ORDER BY m.total_network_size DESC) as network_rank,
                RANK() OVER (ORDER BY a.total_deposits DESC) as deposits_rank
            FROM affiliates a
            LEFT JOIN affiliate_mlm_structure m ON a.affiliate_id = m.affiliate_id
            WHERE a.status = 'active'
            ORDER BY a.total_cpa_earned DESC
            LIMIT $1
        `;

        // Crescimento da rede
        const networkGrowthQuery = `
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as new_affiliates,
                SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('day', created_at)) as cumulative_affiliates
            FROM affiliates
            WHERE created_at >= CURRENT_DATE - INTERVAL '${period} days'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date
        `;

        const [levelResult, topResult, growthResult] = await Promise.all([
            faturePool.query(levelPerformanceQuery),
            faturePool.query(topPerformersQuery, [limit]),
            faturePool.query(networkGrowthQuery)
        ]);

        res.json({
            status: 'success',
            data: {
                level_performance: levelResult.rows,
                top_performers: topResult.rows,
                network_growth: growthResult.rows,
                period_days: parseInt(period),
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Erro ao buscar analytics de performance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar analytics de performance',
            error: error.message
        });
    }
});

// Endpoint para buscar referrals de um afiliado
app.get('/api/v1/affiliates/:id/referrals', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        const affiliateId = parseInt(req.params.id);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const level = req.query.level; // filtro opcional por nível

        let query = `
            SELECT 
                referred_affiliate_id,
                level,
                referral_date,
                status,
                validation_date,
                commission_earned,
                total_deposits,
                total_bets,
                created_at
            FROM affiliate_referrals
            WHERE referrer_affiliate_id = $1
        `;

        const params = [affiliateId];

        if (level) {
            query += ` AND level = $${params.length + 1}`;
            params.push(parseInt(level));
        }

        query += ` ORDER BY referral_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        // Query para contar total
        let countQuery = `
            SELECT COUNT(*) as total
            FROM affiliate_referrals
            WHERE referrer_affiliate_id = $1
        `;

        const countParams = [affiliateId];

        if (level) {
            countQuery += ` AND level = $2`;
            countParams.push(parseInt(level));
        }

        const [referralsResult, countResult] = await Promise.all([
            faturePool.query(query, params),
            faturePool.query(countQuery, countParams)
        ]);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            status: 'success',
            data: {
                affiliate_id: affiliateId,
                referrals: referralsResult.rows,
                pagination: {
                    page,
                    pages: totalPages,
                    total,
                    limit
                },
                filters: {
                    level: level || 'all'
                }
            }
        });

    } catch (error) {
        console.error('Erro ao buscar referrals:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar referrals',
            error: error.message
        });
    }
});

// Endpoint para cache metadata e controle de atualizações
app.get('/api/v1/cache/status', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        const query = `
            SELECT 
                affiliate_id,
                cache_type,
                last_updated,
                next_update,
                update_frequency,
                data_version,
                is_stale
            FROM affiliate_cache_metadata
            ORDER BY last_updated DESC
            LIMIT 50
        `;

        const result = await faturePool.query(query);

        // Estatísticas do cache
        const statsQuery = `
            SELECT 
                cache_type,
                COUNT(*) as total_entries,
                COUNT(CASE WHEN is_stale = true THEN 1 END) as stale_entries,
                AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_updated))/3600) as avg_hours_since_update
            FROM affiliate_cache_metadata
            GROUP BY cache_type
        `;

        const statsResult = await faturePool.query(statsQuery);

        res.json({
            status: 'success',
            data: {
                cache_entries: result.rows,
                cache_statistics: statsResult.rows,
                total_entries: result.rows.length,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Erro ao buscar status do cache:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar status do cache',
            error: error.message
        });
    }
});

// Endpoint para invalidar cache de um afiliado
app.post('/api/v1/cache/:affiliateId/invalidate', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        const affiliateId = parseInt(req.params.affiliateId);
        const cacheType = req.body.cache_type || 'all';

        let query = `
            UPDATE affiliate_cache_metadata 
            SET is_stale = true, 
                next_update = CURRENT_TIMESTAMP
            WHERE affiliate_id = $1
        `;

        const params = [affiliateId];

        if (cacheType !== 'all') {
            query += ` AND cache_type = $2`;
            params.push(cacheType);
        }

        const result = await faturePool.query(query, params);

        res.json({
            status: 'success',
            message: 'Cache invalidado com sucesso',
            data: {
                affiliate_id: affiliateId,
                cache_type: cacheType,
                entries_invalidated: result.rowCount
            }
        });

    } catch (error) {
        console.error('Erro ao invalidar cache:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao invalidar cache',
            error: error.message
        });
    }
});

// Endpoint para buscar dados financeiros detalhados
app.get('/api/v1/affiliates/:id/financial', async (req, res) => {
    try {
        if (!faturePool) {
            return res.status(503).json({
                status: 'error',
                message: 'Banco de dados Fature não configurado'
            });
        }

        const affiliateId = parseInt(req.params.id);
        const period = req.query.period || '30'; // dias

        // Transações financeiras
        const transactionsQuery = `
            SELECT 
                transaction_type,
                amount,
                level,
                description,
                created_at,
                DATE_TRUNC('day', created_at) as transaction_date
            FROM affiliate_financial_transactions
            WHERE affiliate_id = $1
                AND created_at >= CURRENT_DATE - INTERVAL '${period} days'
            ORDER BY created_at DESC
        `;

        // Resumo financeiro por tipo
        const summaryQuery = `
            SELECT 
                transaction_type,
                COUNT(*) as transaction_count,
                SUM(amount) as total_amount,
                AVG(amount) as avg_amount,
                MIN(amount) as min_amount,
                MAX(amount) as max_amount
            FROM affiliate_financial_transactions
            WHERE affiliate_id = $1
                AND created_at >= CURRENT_DATE - INTERVAL '${period} days'
            GROUP BY transaction_type
            ORDER BY total_amount DESC
        `;

        // Evolução diária
        const dailyEvolutionQuery = `
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                transaction_type,
                SUM(amount) as daily_amount,
                COUNT(*) as daily_count
            FROM affiliate_financial_transactions
            WHERE affiliate_id = $1
                AND created_at >= CURRENT_DATE - INTERVAL '${period} days'
            GROUP BY DATE_TRUNC('day', created_at), transaction_type
            ORDER BY date DESC, transaction_type
        `;

        const [transactionsResult, summaryResult, evolutionResult] = await Promise.all([
            faturePool.query(transactionsQuery, [affiliateId]),
            faturePool.query(summaryQuery, [affiliateId]),
            faturePool.query(dailyEvolutionQuery, [affiliateId])
        ]);

        res.json({
            status: 'success',
            data: {
                affiliate_id: affiliateId,
                period_days: parseInt(period),
                transactions: transactionsResult.rows,
                summary_by_type: summaryResult.rows,
                daily_evolution: evolutionResult.rows,
                total_transactions: transactionsResult.rows.length
            }
        });

    } catch (error) {
        console.error('Erro ao buscar dados financeiros:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao buscar dados financeiros',
            error: error.message
        });
    }
});

console.log('✅ Novos endpoints da estrutura robusta carregados');

