const { Pool } = require('pg');
const config = require('../config');

const createDatabaseStructure = async () => {
  const pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl
  });

  try {
    console.log('🚀 Iniciando migração do banco de dados...');

    // SQL completo da estrutura do banco robusto
    const migrationSQL = `
-- =====================================================
-- BANCO DE DADOS ROBUSTO PARA AFILIADOS - FATURE CPA
-- Estrutura otimizada para evitar processamento em tempo real
-- =====================================================

-- =====================================================
-- 1. TABELA PRINCIPAL DE AFILIADOS
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliates (
    -- Identificação
    affiliate_id BIGINT PRIMARY KEY,
    external_id VARCHAR(50), -- ID no sistema externo
    
    -- Dados cadastrais básicos
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    document VARCHAR(50),
    
    -- Status e datas
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended, blocked
    registration_date TIMESTAMP,
    last_activity TIMESTAMP,
    
    -- Dados de performance agregados (atualizados via ETL)
    total_referrals INTEGER DEFAULT 0,
    total_validated_referrals INTEGER DEFAULT 0,
    total_deposits DECIMAL(15,2) DEFAULT 0,
    total_bets DECIMAL(15,2) DEFAULT 0,
    total_withdrawals DECIMAL(15,2) DEFAULT 0,
    total_ggr DECIMAL(15,2) DEFAULT 0,
    total_cpa_earned DECIMAL(15,2) DEFAULT 0,
    total_rev_earned DECIMAL(15,2) DEFAULT 0,
    total_commissions_paid DECIMAL(15,2) DEFAULT 0,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. ESTRUTURA MLM - INDICAÇÕES POR NÍVEL
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_mlm_structure (
    id BIGSERIAL PRIMARY KEY,
    affiliate_id BIGINT NOT NULL,
    
    -- Totais por nível (pré-calculados)
    level_1_count INTEGER DEFAULT 0,
    level_2_count INTEGER DEFAULT 0,
    level_3_count INTEGER DEFAULT 0,
    level_4_count INTEGER DEFAULT 0,
    level_5_count INTEGER DEFAULT 0,
    total_network_size INTEGER DEFAULT 0,
    
    -- Valores financeiros por nível
    level_1_deposits DECIMAL(15,2) DEFAULT 0,
    level_2_deposits DECIMAL(15,2) DEFAULT 0,
    level_3_deposits DECIMAL(15,2) DEFAULT 0,
    level_4_deposits DECIMAL(15,2) DEFAULT 0,
    level_5_deposits DECIMAL(15,2) DEFAULT 0,
    
    level_1_bets DECIMAL(15,2) DEFAULT 0,
    level_2_bets DECIMAL(15,2) DEFAULT 0,
    level_3_bets DECIMAL(15,2) DEFAULT 0,
    level_4_bets DECIMAL(15,2) DEFAULT 0,
    level_5_bets DECIMAL(15,2) DEFAULT 0,
    
    level_1_ggr DECIMAL(15,2) DEFAULT 0,
    level_2_ggr DECIMAL(15,2) DEFAULT 0,
    level_3_ggr DECIMAL(15,2) DEFAULT 0,
    level_4_ggr DECIMAL(15,2) DEFAULT 0,
    level_5_ggr DECIMAL(15,2) DEFAULT 0,
    
    -- CPA e REV por nível
    level_1_cpa DECIMAL(15,2) DEFAULT 0,
    level_2_cpa DECIMAL(15,2) DEFAULT 0,
    level_3_cpa DECIMAL(15,2) DEFAULT 0,
    level_4_cpa DECIMAL(15,2) DEFAULT 0,
    level_5_cpa DECIMAL(15,2) DEFAULT 0,
    
    level_1_rev DECIMAL(15,2) DEFAULT 0,
    level_2_rev DECIMAL(15,2) DEFAULT 0,
    level_3_rev DECIMAL(15,2) DEFAULT 0,
    level_4_rev DECIMAL(15,2) DEFAULT 0,
    level_5_rev DECIMAL(15,2) DEFAULT 0,
    
    -- Metadados
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculation_period VARCHAR(20) DEFAULT 'all_time', -- all_time, monthly, weekly
    
    FOREIGN KEY (affiliate_id) REFERENCES affiliates(affiliate_id)
);

-- =====================================================
-- 3. INDICAÇÕES DETALHADAS (TODAS AS INDICAÇÕES)
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id BIGSERIAL PRIMARY KEY,
    
    -- Relacionamento
    referrer_id BIGINT NOT NULL, -- Quem indicou
    referred_id BIGINT NOT NULL, -- Quem foi indicado
    mlm_level INTEGER NOT NULL, -- Nível na rede (1-5)
    
    -- Dados da indicação
    referral_date TIMESTAMP NOT NULL,
    registration_date TIMESTAMP, -- Data de registro do indicado
    
    -- Status da indicação
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, validated, inactive
    validation_date TIMESTAMP,
    validation_criteria JSONB, -- Critérios que foram atendidos
    
    -- Dados financeiros acumulados do indicado
    total_deposits DECIMAL(15,2) DEFAULT 0,
    total_bets DECIMAL(15,2) DEFAULT 0,
    total_withdrawals DECIMAL(15,2) DEFAULT 0,
    total_ggr DECIMAL(15,2) DEFAULT 0,
    days_active INTEGER DEFAULT 0,
    
    -- CPA e comissões geradas
    cpa_amount DECIMAL(15,2) DEFAULT 0,
    cpa_paid_date TIMESTAMP,
    rev_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (referrer_id) REFERENCES affiliates(affiliate_id)
);

-- =====================================================
-- 4. TRANSAÇÕES FINANCEIRAS DETALHADAS POR AFILIADO
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_financial_transactions (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificação
    affiliate_id BIGINT NOT NULL,
    user_id BIGINT, -- ID do usuário que fez a transação
    mlm_level INTEGER, -- Nível na rede do afiliado
    
    -- Tipo de transação
    transaction_type VARCHAR(50) NOT NULL, -- deposit, withdrawal, bet, win, bonus, cpa, rev
    transaction_date TIMESTAMP NOT NULL,
    
    -- Valores
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'BRL',
    
    -- Dados específicos por tipo
    bet_details JSONB, -- Para apostas: jogo, odds, etc.
    deposit_method VARCHAR(50), -- PIX, cartão, etc.
    withdrawal_method VARCHAR(50),
    
    -- Referência externa
    external_transaction_id VARCHAR(100),
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (affiliate_id) REFERENCES affiliates(affiliate_id)
);

-- =====================================================
-- 5. HISTÓRICO DE VALIDAÇÕES CPA
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_cpa_validations (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificação
    affiliate_id BIGINT NOT NULL,
    referred_user_id BIGINT NOT NULL,
    
    -- Dados da validação
    validation_date TIMESTAMP NOT NULL,
    validation_criteria JSONB NOT NULL, -- Critérios atendidos
    
    -- Valores no momento da validação
    user_deposits DECIMAL(15,2),
    user_bets DECIMAL(15,2),
    user_ggr DECIMAL(15,2),
    days_active INTEGER,
    
    -- CPA calculado
    cpa_level INTEGER, -- Nível do CPA (1-5)
    cpa_amount DECIMAL(15,2),
    cpa_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, cancelled
    cpa_paid_date TIMESTAMP,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (affiliate_id) REFERENCES affiliates(affiliate_id)
);

-- =====================================================
-- 6. RESUMOS PERIÓDICOS (PARA RELATÓRIOS RÁPIDOS)
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_periodic_summaries (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificação
    affiliate_id BIGINT NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly, yearly
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Métricas do período
    new_referrals INTEGER DEFAULT 0,
    validated_referrals INTEGER DEFAULT 0,
    total_deposits DECIMAL(15,2) DEFAULT 0,
    total_bets DECIMAL(15,2) DEFAULT 0,
    total_ggr DECIMAL(15,2) DEFAULT 0,
    cpa_earned DECIMAL(15,2) DEFAULT 0,
    rev_earned DECIMAL(15,2) DEFAULT 0,
    
    -- Breakdown por nível
    level_breakdown JSONB, -- Detalhes por nível MLM
    
    -- Metadados
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (affiliate_id) REFERENCES affiliates(affiliate_id)
);

-- =====================================================
-- 7. CONFIGURAÇÕES E CACHE
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_cache_metadata (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificação
    affiliate_id BIGINT NOT NULL,
    cache_type VARCHAR(50) NOT NULL, -- mlm_structure, financial_summary, etc.
    
    -- Dados do cache
    last_updated TIMESTAMP NOT NULL,
    next_update TIMESTAMP,
    update_frequency INTEGER DEFAULT 3600, -- segundos
    
    -- Status
    status VARCHAR(20) DEFAULT 'valid', -- valid, updating, error
    error_message TEXT,
    
    FOREIGN KEY (affiliate_id) REFERENCES affiliates(affiliate_id)
);
`;

    // Executar migração
    await pool.query(migrationSQL);
    console.log('✅ Estrutura básica criada com sucesso');

    // Criar índices
    const indexesSQL = `
-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_affiliate_status ON affiliates (status);
CREATE INDEX IF NOT EXISTS idx_affiliate_registration ON affiliates (registration_date);
CREATE INDEX IF NOT EXISTS idx_affiliate_activity ON affiliates (last_activity);
CREATE INDEX IF NOT EXISTS idx_affiliate_performance ON affiliates (total_validated_referrals, total_cpa_earned);

CREATE INDEX IF NOT EXISTS idx_mlm_affiliate ON affiliate_mlm_structure (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_mlm_network_size ON affiliate_mlm_structure (total_network_size);
CREATE INDEX IF NOT EXISTS idx_mlm_calculation ON affiliate_mlm_structure (last_calculated);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON affiliate_referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON affiliate_referrals (referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_level ON affiliate_referrals (mlm_level);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON affiliate_referrals (status);
CREATE INDEX IF NOT EXISTS idx_referrals_validation ON affiliate_referrals (validation_date);
CREATE INDEX IF NOT EXISTS idx_referrals_date ON affiliate_referrals (referral_date);

CREATE INDEX IF NOT EXISTS idx_financial_affiliate ON affiliate_financial_transactions (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_financial_type ON affiliate_financial_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_financial_date ON affiliate_financial_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_level ON affiliate_financial_transactions (mlm_level);
CREATE INDEX IF NOT EXISTS idx_financial_amount ON affiliate_financial_transactions (amount);

CREATE INDEX IF NOT EXISTS idx_cpa_affiliate ON affiliate_cpa_validations (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_cpa_validation_date ON affiliate_cpa_validations (validation_date);
CREATE INDEX IF NOT EXISTS idx_cpa_status ON affiliate_cpa_validations (cpa_status);
CREATE INDEX IF NOT EXISTS idx_cpa_level ON affiliate_cpa_validations (cpa_level);

CREATE INDEX IF NOT EXISTS idx_summary_affiliate ON affiliate_periodic_summaries (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_summary_period ON affiliate_periodic_summaries (period_type, period_start);

CREATE INDEX IF NOT EXISTS idx_cache_affiliate ON affiliate_cache_metadata (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_cache_type ON affiliate_cache_metadata (cache_type);
CREATE INDEX IF NOT EXISTS idx_cache_update ON affiliate_cache_metadata (next_update);
`;

    await pool.query(indexesSQL);
    console.log('✅ Índices criados com sucesso');

    // Criar views
    const viewsSQL = `
-- View para dashboard principal de afiliados
CREATE OR REPLACE VIEW v_affiliate_dashboard AS
SELECT 
    a.affiliate_id,
    a.name,
    a.status,
    a.registration_date,
    a.last_activity,
    
    -- Totais gerais
    a.total_referrals,
    a.total_validated_referrals,
    a.total_deposits,
    a.total_cpa_earned,
    a.total_rev_earned,
    
    -- Estrutura MLM
    COALESCE(m.total_network_size, 0) as total_network_size,
    COALESCE(m.level_1_count, 0) as level_1_count,
    COALESCE(m.level_2_count, 0) as level_2_count,
    COALESCE(m.level_3_count, 0) as level_3_count,
    COALESCE(m.level_4_count, 0) as level_4_count,
    COALESCE(m.level_5_count, 0) as level_5_count,
    
    -- Performance financeira
    COALESCE((m.level_1_deposits + m.level_2_deposits + m.level_3_deposits + 
     m.level_4_deposits + m.level_5_deposits), 0) as network_total_deposits,
    
    COALESCE((m.level_1_cpa + m.level_2_cpa + m.level_3_cpa + 
     m.level_4_cpa + m.level_5_cpa), 0) as network_total_cpa

FROM affiliates a
LEFT JOIN affiliate_mlm_structure m ON a.affiliate_id = m.affiliate_id
WHERE a.status = 'active';

-- View para ranking de afiliados
CREATE OR REPLACE VIEW v_affiliate_ranking AS
SELECT 
    affiliate_id,
    name,
    total_validated_referrals,
    total_cpa_earned,
    COALESCE((SELECT total_network_size FROM affiliate_mlm_structure WHERE affiliate_id = a.affiliate_id), 0) as total_network_size,
    RANK() OVER (ORDER BY total_cpa_earned DESC) as cpa_rank,
    RANK() OVER (ORDER BY total_validated_referrals DESC) as referrals_rank
FROM affiliates a
WHERE status = 'active'
ORDER BY total_cpa_earned DESC;
`;

    await pool.query(viewsSQL);
    console.log('✅ Views criadas com sucesso');

    // Criar triggers
    const triggersSQL = `
-- Trigger para atualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_affiliates_updated_at ON affiliates;
CREATE TRIGGER update_affiliates_updated_at 
    BEFORE UPDATE ON affiliates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_referrals_updated_at ON affiliate_referrals;
CREATE TRIGGER update_referrals_updated_at 
    BEFORE UPDATE ON affiliate_referrals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

    await pool.query(triggersSQL);
    console.log('✅ Triggers criados com sucesso');

    console.log('🎉 Migração do banco de dados concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

// Executar migração se chamado diretamente
if (require.main === module) {
  createDatabaseStructure()
    .then(() => {
      console.log('✅ Migração executada com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na migração:', error);
      process.exit(1);
    });
}

module.exports = { createDatabaseStructure };

