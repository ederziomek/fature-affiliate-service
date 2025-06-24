const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { validationResult } = require('express-validator');

// GET /api/v1/affiliates - Listar afiliados com paginação
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'active';
    const search = req.query.search || '';

    let whereClause = 'WHERE a.status = $1';
    let params = [status];
    let paramCount = 1;

    if (search) {
      paramCount++;
      whereClause += ` AND (a.name ILIKE $${paramCount} OR a.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Query principal com dados do dashboard
    const affiliatesQuery = `
      SELECT 
        a.affiliate_id,
        a.name,
        a.email,
        a.status,
        a.registration_date,
        a.last_activity,
        a.total_referrals,
        a.total_validated_referrals,
        a.total_deposits,
        a.total_cpa_earned,
        a.total_rev_earned,
        COALESCE(m.total_network_size, 0) as total_network_size,
        COALESCE(m.level_1_count, 0) as level_1_count
      FROM affiliates a
      LEFT JOIN affiliate_mlm_structure m ON a.affiliate_id = m.affiliate_id
      ${whereClause}
      ORDER BY a.total_cpa_earned DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(limit, offset);

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM affiliates a
      ${whereClause}
    `;

    const [affiliatesResult, countResult] = await Promise.all([
      query(affiliatesQuery, params),
      query(countQuery, params.slice(0, -2)) // Remove limit e offset
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        affiliates: affiliatesResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao listar afiliados:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível listar os afiliados',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/affiliates/:id - Obter dados de um afiliado específico
router.get('/:id', async (req, res) => {
  try {
    const affiliateId = req.params.id;

    const affiliateQuery = `
      SELECT 
        a.*,
        COALESCE(m.total_network_size, 0) as total_network_size,
        COALESCE(m.level_1_count, 0) as level_1_count,
        COALESCE(m.level_2_count, 0) as level_2_count,
        COALESCE(m.level_3_count, 0) as level_3_count,
        COALESCE(m.level_4_count, 0) as level_4_count,
        COALESCE(m.level_5_count, 0) as level_5_count,
        COALESCE(m.level_1_deposits, 0) as level_1_deposits,
        COALESCE(m.level_2_deposits, 0) as level_2_deposits,
        COALESCE(m.level_3_deposits, 0) as level_3_deposits,
        COALESCE(m.level_4_deposits, 0) as level_4_deposits,
        COALESCE(m.level_5_deposits, 0) as level_5_deposits,
        COALESCE(m.level_1_cpa, 0) as level_1_cpa,
        COALESCE(m.level_2_cpa, 0) as level_2_cpa,
        COALESCE(m.level_3_cpa, 0) as level_3_cpa,
        COALESCE(m.level_4_cpa, 0) as level_4_cpa,
        COALESCE(m.level_5_cpa, 0) as level_5_cpa
      FROM affiliates a
      LEFT JOIN affiliate_mlm_structure m ON a.affiliate_id = m.affiliate_id
      WHERE a.affiliate_id = $1
    `;

    const result = await query(affiliateQuery, [affiliateId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Afiliado não encontrado',
        message: `Afiliado com ID ${affiliateId} não existe`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao obter afiliado:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível obter os dados do afiliado',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/affiliates/:id/mlm-structure - Obter estrutura MLM do afiliado
router.get('/:id/mlm-structure', async (req, res) => {
  try {
    const affiliateId = req.params.id;

    const mlmQuery = `
      SELECT 
        affiliate_id,
        level_1_count, level_1_deposits, level_1_bets, level_1_ggr, level_1_cpa, level_1_rev,
        level_2_count, level_2_deposits, level_2_bets, level_2_ggr, level_2_cpa, level_2_rev,
        level_3_count, level_3_deposits, level_3_bets, level_3_ggr, level_3_cpa, level_3_rev,
        level_4_count, level_4_deposits, level_4_bets, level_4_ggr, level_4_cpa, level_4_rev,
        level_5_count, level_5_deposits, level_5_bets, level_5_ggr, level_5_cpa, level_5_rev,
        total_network_size,
        last_calculated,
        calculation_period
      FROM affiliate_mlm_structure
      WHERE affiliate_id = $1
    `;

    const result = await query(mlmQuery, [affiliateId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Estrutura MLM não encontrada',
        message: `Estrutura MLM para afiliado ${affiliateId} não existe`,
        timestamp: new Date().toISOString()
      });
    }

    const mlmData = result.rows[0];

    // Organizar dados por nível
    const structureByLevel = {
      level_1: {
        count: mlmData.level_1_count,
        deposits: parseFloat(mlmData.level_1_deposits),
        bets: parseFloat(mlmData.level_1_bets),
        ggr: parseFloat(mlmData.level_1_ggr),
        cpa: parseFloat(mlmData.level_1_cpa),
        rev: parseFloat(mlmData.level_1_rev)
      },
      level_2: {
        count: mlmData.level_2_count,
        deposits: parseFloat(mlmData.level_2_deposits),
        bets: parseFloat(mlmData.level_2_bets),
        ggr: parseFloat(mlmData.level_2_ggr),
        cpa: parseFloat(mlmData.level_2_cpa),
        rev: parseFloat(mlmData.level_2_rev)
      },
      level_3: {
        count: mlmData.level_3_count,
        deposits: parseFloat(mlmData.level_3_deposits),
        bets: parseFloat(mlmData.level_3_bets),
        ggr: parseFloat(mlmData.level_3_ggr),
        cpa: parseFloat(mlmData.level_3_cpa),
        rev: parseFloat(mlmData.level_3_rev)
      },
      level_4: {
        count: mlmData.level_4_count,
        deposits: parseFloat(mlmData.level_4_deposits),
        bets: parseFloat(mlmData.level_4_bets),
        ggr: parseFloat(mlmData.level_4_ggr),
        cpa: parseFloat(mlmData.level_4_cpa),
        rev: parseFloat(mlmData.level_4_rev)
      },
      level_5: {
        count: mlmData.level_5_count,
        deposits: parseFloat(mlmData.level_5_deposits),
        bets: parseFloat(mlmData.level_5_bets),
        ggr: parseFloat(mlmData.level_5_ggr),
        cpa: parseFloat(mlmData.level_5_cpa),
        rev: parseFloat(mlmData.level_5_rev)
      }
    };

    res.json({
      success: true,
      data: {
        affiliate_id: mlmData.affiliate_id,
        total_network_size: mlmData.total_network_size,
        structure_by_level: structureByLevel,
        last_calculated: mlmData.last_calculated,
        calculation_period: mlmData.calculation_period
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao obter estrutura MLM:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível obter a estrutura MLM',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/affiliates/:id/referrals - Obter indicações do afiliado
router.get('/:id/referrals', async (req, res) => {
  try {
    const affiliateId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'all';
    const level = req.query.level || 'all';

    let whereClause = 'WHERE referrer_id = $1';
    let params = [affiliateId];
    let paramCount = 1;

    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (level !== 'all') {
      paramCount++;
      whereClause += ` AND mlm_level = $${paramCount}`;
      params.push(parseInt(level));
    }

    const referralsQuery = `
      SELECT 
        id,
        referrer_id,
        referred_id,
        mlm_level,
        referral_date,
        registration_date,
        status,
        validation_date,
        validation_criteria,
        total_deposits,
        total_bets,
        total_ggr,
        days_active,
        cpa_amount,
        cpa_paid_date,
        rev_amount
      FROM affiliate_referrals
      ${whereClause}
      ORDER BY referral_date DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM affiliate_referrals
      ${whereClause}
    `;

    const [referralsResult, countResult] = await Promise.all([
      query(referralsQuery, params),
      query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        referrals: referralsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao obter indicações:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível obter as indicações',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/affiliates/:id/dashboard - Obter dados do dashboard
router.get('/:id/dashboard', async (req, res) => {
  try {
    const affiliateId = req.params.id;

    const dashboardQuery = `
      SELECT * FROM v_affiliate_dashboard
      WHERE affiliate_id = $1
    `;

    const result = await query(dashboardQuery, [affiliateId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Dashboard não encontrado',
        message: `Dashboard para afiliado ${affiliateId} não existe`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao obter dashboard:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível obter os dados do dashboard',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/affiliates/ranking - Obter ranking de afiliados
router.get('/ranking', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const orderBy = req.query.order_by || 'cpa'; // cpa, referrals, network

    let orderClause = 'ORDER BY total_cpa_earned DESC';
    
    if (orderBy === 'referrals') {
      orderClause = 'ORDER BY total_validated_referrals DESC';
    } else if (orderBy === 'network') {
      orderClause = 'ORDER BY total_network_size DESC';
    }

    const rankingQuery = `
      SELECT 
        affiliate_id,
        name,
        total_validated_referrals,
        total_cpa_earned,
        total_network_size,
        cpa_rank,
        referrals_rank
      FROM v_affiliate_ranking
      ${orderClause}
      LIMIT $1
    `;

    const result = await query(rankingQuery, [limit]);

    res.json({
      success: true,
      data: {
        ranking: result.rows,
        order_by: orderBy,
        limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao obter ranking:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível obter o ranking',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/affiliates/stats - Obter estatísticas gerais
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_affiliates,
        COUNT(*) FILTER (WHERE status = 'active') as active_affiliates,
        SUM(total_validated_referrals) as total_validated_referrals,
        SUM(total_cpa_earned) as total_cpa_paid,
        SUM(total_deposits) as total_deposits,
        AVG(total_validated_referrals) as avg_referrals_per_affiliate,
        AVG(total_cpa_earned) as avg_cpa_per_affiliate
      FROM affiliates
    `;

    const result = await query(statsQuery);
    const stats = result.rows[0];

    // Converter valores para números
    const formattedStats = {
      total_affiliates: parseInt(stats.total_affiliates),
      active_affiliates: parseInt(stats.active_affiliates),
      total_validated_referrals: parseInt(stats.total_validated_referrals || 0),
      total_cpa_paid: parseFloat(stats.total_cpa_paid || 0),
      total_deposits: parseFloat(stats.total_deposits || 0),
      avg_referrals_per_affiliate: parseFloat(stats.avg_referrals_per_affiliate || 0),
      avg_cpa_per_affiliate: parseFloat(stats.avg_cpa_per_affiliate || 0)
    };

    res.json({
      success: true,
      data: formattedStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível obter as estatísticas',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

