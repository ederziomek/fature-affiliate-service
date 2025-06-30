-- =====================================================
-- FATURE CPA v2 - ESTRUTURA COMPLETA DO BANCO DE DADOS
-- Autor: Manus AI
-- Data: 30 de junho de 2025
-- Versão: 2.0
-- =====================================================

-- Criar schema e configurar extensões
CREATE SCHEMA IF NOT EXISTS fature_v2;
SET search_path TO fature_v2;

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- TABELAS PRINCIPAIS
-- =====================================================

-- Tabela principal de afiliados otimizada
CREATE TABLE affiliates_optimized (
    affiliate_id BIGINT PRIMARY KEY,
    parent_affiliate_id BIGINT,
    external_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    document VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    registration_date TIMESTAMP NOT NULL,
    
    -- Campos de hierarquia otimizada
    hierarchy_path LTREE NOT NULL,
    hierarchy_level INTEGER NOT NULL,
    direct_referrals_count INTEGER DEFAULT 0,
    total_network_size INTEGER DEFAULT 0,
    
    -- Campos financeiros
    total_deposits DECIMAL(15,2) DEFAULT 0,
    total_bets DECIMAL(15,2) DEFAULT 0,
    total_withdrawals DECIMAL(15,2) DEFAULT 0,
    total_ggr DECIMAL(15,2) DEFAULT 0,
    
    -- Campos de comissão
    total_cpa_earned DECIMAL(15,2) DEFAULT 0,
    total_rev_earned DECIMAL(15,2) DEFAULT 0,
    total_commissions_paid DECIMAL(15,2) DEFAULT 0,
    
    -- Metadados de performance
    last_commission_calc TIMESTAMP,
    network_hash VARCHAR(64),
    last_activity TIMESTAMP,
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_positive_counts CHECK (
        direct_referrals_count >= 0 AND 
        total_network_size >= 0 AND
        hierarchy_level > 0
    ),
    CONSTRAINT chk_valid_status CHECK (
        status IN ('active', 'inactive', 'suspended', 'banned')
    ),
    CONSTRAINT fk_parent_affiliate FOREIGN KEY (parent_affiliate_id) 
        REFERENCES affiliates_optimized(affiliate_id) DEFERRABLE INITIALLY DEFERRED
);

-- Tabela de índice hierárquico
CREATE TABLE hierarchy_index (
    id BIGSERIAL PRIMARY KEY,
    ancestor_id BIGINT NOT NULL,
    descendant_id BIGINT NOT NULL,
    level_distance INTEGER NOT NULL,
    path_weight DECIMAL(10,4) DEFAULT 1.0,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Constraints únicos
    UNIQUE(ancestor_id, descendant_id),
    
    -- Foreign keys
    FOREIGN KEY (ancestor_id) REFERENCES affiliates_optimized(affiliate_id),
    FOREIGN KEY (descendant_id) REFERENCES affiliates_optimized(affiliate_id),
    
    -- Checks
    CONSTRAINT chk_positive_distance CHECK (level_distance > 0),
    CONSTRAINT chk_different_ids CHECK (ancestor_id != descendant_id)
);

-- Tabela de transações otimizada
CREATE TABLE transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    affiliate_id BIGINT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'BRL',
    transaction_date TIMESTAMP DEFAULT NOW(),
    
    -- Campos para comissões
    commission_eligible BOOLEAN DEFAULT true,
    commission_processed BOOLEAN DEFAULT false,
    commission_batch_id BIGINT,
    
    -- Metadados
    external_transaction_id VARCHAR(100),
    metadata JSONB,
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign keys
    FOREIGN KEY (affiliate_id) REFERENCES affiliates_optimized(affiliate_id),
    
    -- Constraints
    CONSTRAINT chk_positive_amount CHECK (amount > 0),
    CONSTRAINT chk_valid_type CHECK (
        transaction_type IN ('deposit', 'bet', 'withdrawal', 'bonus')
    )
);

-- Tabela de comissões
CREATE TABLE commissions (
    commission_id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    beneficiary_affiliate_id BIGINT NOT NULL,
    source_affiliate_id BIGINT NOT NULL,
    level_distance INTEGER NOT NULL,
    
    -- Valores financeiros
    base_amount DECIMAL(15,2) NOT NULL,
    commission_rate DECIMAL(5,4) NOT NULL,
    commission_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'BRL',
    
    -- Status e processamento
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP,
    paid_at TIMESTAMP,
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT NOW(),
    batch_id BIGINT,
    
    -- Foreign keys
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id),
    FOREIGN KEY (beneficiary_affiliate_id) REFERENCES affiliates_optimized(affiliate_id),
    FOREIGN KEY (source_affiliate_id) REFERENCES affiliates_optimized(affiliate_id),
    
    -- Constraints
    CONSTRAINT chk_positive_amounts CHECK (
        base_amount > 0 AND commission_amount > 0 AND commission_rate > 0
    ),
    CONSTRAINT chk_valid_status CHECK (
        status IN ('pending', 'approved', 'paid', 'cancelled', 'disputed')
    ),
    CONSTRAINT chk_positive_level CHECK (level_distance > 0)
);

-- Tabela de fila de processamento
CREATE TABLE commission_queue (
    queue_id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    priority INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    error_message TEXT,
    
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
);

-- Tabelas de monitoramento
CREATE TABLE query_performance_log (
    log_id BIGSERIAL PRIMARY KEY,
    query_type VARCHAR(100) NOT NULL,
    query_duration_ms INTEGER NOT NULL,
    affected_rows INTEGER,
    query_hash VARCHAR(64),
    parameters JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE performance_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE system_log (
    log_id BIGSERIAL PRIMARY KEY,
    operation VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sequência para lotes de comissão
CREATE SEQUENCE commission_batch_seq START 1;

-- =====================================================
-- ÍNDICES OTIMIZADOS
-- =====================================================

-- Índices para affiliates_optimized
CREATE INDEX idx_affiliates_parent ON affiliates_optimized(parent_affiliate_id) 
    WHERE parent_affiliate_id IS NOT NULL;

CREATE INDEX idx_affiliates_external ON affiliates_optimized(external_id);

CREATE INDEX idx_affiliates_status ON affiliates_optimized(status) 
    WHERE status = 'active';

CREATE INDEX idx_affiliates_registration ON affiliates_optimized(registration_date);

-- Índice LTREE para consultas hierárquicas
CREATE INDEX idx_hierarchy_path_gist ON affiliates_optimized 
    USING GIST (hierarchy_path);

CREATE INDEX idx_hierarchy_path_btree ON affiliates_optimized 
    USING BTREE (hierarchy_path);

-- Índices para hierarchy_index
CREATE INDEX idx_ancestor_level ON hierarchy_index(ancestor_id, level_distance) 
    WHERE is_active = true;

CREATE INDEX idx_descendant_level ON hierarchy_index(descendant_id, level_distance) 
    WHERE is_active = true;

CREATE INDEX idx_level_distance ON hierarchy_index(level_distance) 
    WHERE is_active = true;

-- Índices compostos para consultas complexas
CREATE INDEX idx_ancestor_active_level ON hierarchy_index(ancestor_id, is_active, level_distance) 
    WHERE is_active = true;

CREATE INDEX idx_performance_lookup ON affiliates_optimized(
    status, hierarchy_level, direct_referrals_count
) WHERE status = 'active' AND direct_referrals_count > 0;

-- Índices para transações
CREATE INDEX idx_transactions_affiliate ON transactions(affiliate_id, transaction_date);
CREATE INDEX idx_transactions_processing ON transactions(commission_eligible, commission_processed, transaction_date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type, transaction_date);

-- Índices para comissões
CREATE INDEX idx_commissions_beneficiary ON commissions(beneficiary_affiliate_id, status);
CREATE INDEX idx_commissions_transaction ON commissions(transaction_id, level_distance);
CREATE INDEX idx_commissions_processing ON commissions(status, created_at, batch_id);
CREATE INDEX idx_commissions_payment ON commissions(status, paid_at) WHERE status = 'paid';

-- Índices para fila de processamento
CREATE INDEX idx_queue_processing ON commission_queue(status, priority, created_at);

-- Índices para monitoramento
CREATE INDEX idx_perf_log_type_time ON query_performance_log(query_type, created_at);
CREATE INDEX idx_perf_log_duration ON query_performance_log(query_duration_ms, created_at);
CREATE INDEX idx_cache_expiration ON performance_cache(expires_at);
CREATE INDEX idx_cache_hits ON performance_cache(hit_count, updated_at);

-- =====================================================
-- FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para atualizar hierarquia em inserções
CREATE OR REPLACE FUNCTION update_hierarchy_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    parent_path LTREE;
    new_level INTEGER;
BEGIN
    -- Calcular caminho hierárquico
    IF NEW.parent_affiliate_id IS NOT NULL THEN
        SELECT hierarchy_path, hierarchy_level 
        INTO parent_path, new_level
        FROM affiliates_optimized 
        WHERE affiliate_id = NEW.parent_affiliate_id;
        
        IF parent_path IS NULL THEN
            RAISE EXCEPTION 'Parent affiliate % not found', NEW.parent_affiliate_id;
        END IF;
        
        NEW.hierarchy_path = parent_path || NEW.affiliate_id::text;
        NEW.hierarchy_level = new_level + 1;
    ELSE
        NEW.hierarchy_path = NEW.affiliate_id::text;
        NEW.hierarchy_level = 1;
    END IF;
    
    -- Atualizar timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualização automática
CREATE TRIGGER trg_update_hierarchy_insert
    BEFORE INSERT ON affiliates_optimized
    FOR EACH ROW EXECUTE FUNCTION update_hierarchy_on_insert();

-- Função para construir índice hierárquico
CREATE OR REPLACE FUNCTION build_hierarchy_index(p_affiliate_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    affiliate_path LTREE;
    path_elements TEXT[];
    ancestor_id BIGINT;
    level_dist INTEGER;
    inserted_count INTEGER := 0;
BEGIN
    -- Obter caminho do afiliado
    SELECT hierarchy_path INTO affiliate_path
    FROM affiliates_optimized
    WHERE affiliate_id = p_affiliate_id;
    
    IF affiliate_path IS NULL THEN
        RAISE EXCEPTION 'Affiliate % not found', p_affiliate_id;
    END IF;
    
    -- Converter caminho em array
    path_elements := string_to_array(affiliate_path::text, '.');
    
    -- Inserir relacionamentos com todos os ancestrais
    FOR i IN 1..array_length(path_elements, 1)-1 LOOP
        ancestor_id := path_elements[i]::BIGINT;
        level_dist := array_length(path_elements, 1) - i;
        
        INSERT INTO hierarchy_index (
            ancestor_id, descendant_id, level_distance
        ) VALUES (
            ancestor_id, p_affiliate_id, level_dist
        ) ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
        
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar contadores
CREATE OR REPLACE FUNCTION update_referral_counters()
RETURNS TRIGGER AS $$
DECLARE
    path_elements TEXT[];
    ancestor_id BIGINT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Atualizar contador direto do parent
        IF NEW.parent_affiliate_id IS NOT NULL THEN
            UPDATE affiliates_optimized 
            SET direct_referrals_count = direct_referrals_count + 1,
                updated_at = NOW()
            WHERE affiliate_id = NEW.parent_affiliate_id;
        END IF;
        
        -- Atualizar tamanho da rede para todos os ancestrais
        path_elements := string_to_array(NEW.hierarchy_path::text, '.');
        
        FOR i IN 1..array_length(path_elements, 1)-1 LOOP
            ancestor_id := path_elements[i]::BIGINT;
            
            UPDATE affiliates_optimized 
            SET total_network_size = total_network_size + 1,
                updated_at = NOW()
            WHERE affiliate_id = ancestor_id;
        END LOOP;
        
        -- Construir índice hierárquico
        PERFORM build_hierarchy_index(NEW.affiliate_id);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Lógica para remoção (se necessário)
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para contadores automáticos
CREATE TRIGGER trg_update_referral_counters
    AFTER INSERT OR DELETE ON affiliates_optimized
    FOR EACH ROW EXECUTE FUNCTION update_referral_counters();

-- Função para construção completa do índice hierárquico
CREATE OR REPLACE FUNCTION build_complete_hierarchy_index()
RETURNS TABLE(
    total_affiliates INTEGER,
    total_relationships INTEGER,
    max_level INTEGER,
    processing_time_ms INTEGER
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    affiliate_count INTEGER;
    relationship_count INTEGER;
    max_hierarchy_level INTEGER;
    current_affiliate RECORD;
    batch_size INTEGER := 1000;
    processed_count INTEGER := 0;
BEGIN
    start_time := clock_timestamp();
    
    -- Contar afiliados total
    SELECT COUNT(*) INTO affiliate_count FROM affiliates_optimized;
    
    -- Processar afiliados em lotes para construir índice
    FOR current_affiliate IN 
        SELECT affiliate_id, hierarchy_path, hierarchy_level
        FROM affiliates_optimized
        WHERE hierarchy_level > 1  -- Pular afiliados raiz
        ORDER BY hierarchy_level, affiliate_id
    LOOP
        -- Construir relacionamentos para este afiliado
        PERFORM build_hierarchy_index(current_affiliate.affiliate_id);
        
        processed_count := processed_count + 1;
        
        -- Log de progresso a cada lote
        IF processed_count % batch_size = 0 THEN
            RAISE NOTICE 'Processados % de % afiliados (%.1f%%)',
                processed_count, affiliate_count,
                (processed_count * 100.0 / affiliate_count);
        END IF;
    END LOOP;
    
    -- Obter estatísticas finais
    SELECT COUNT(*) INTO relationship_count FROM hierarchy_index;
    SELECT MAX(hierarchy_level) INTO max_hierarchy_level FROM affiliates_optimized;
    
    end_time := clock_timestamp();
    
    -- Retornar estatísticas
    RETURN QUERY SELECT 
        affiliate_count,
        relationship_count,
        max_hierarchy_level,
        EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;
        
    RAISE NOTICE 'Índice hierárquico construído: % relacionamentos para % afiliados',
        relationship_count, affiliate_count;
END;
$$ LANGUAGE plpgsql;

-- Função para cálculo de comissões em tempo real
CREATE OR REPLACE FUNCTION calculate_commissions_realtime(
    p_transaction_id BIGINT,
    p_max_levels INTEGER DEFAULT 5
) RETURNS TABLE(
    beneficiary_id BIGINT,
    level_distance INTEGER,
    commission_amount DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH commission_rules AS (
        SELECT level_distance, commission_rate
        FROM (VALUES 
            (1, 0.05),  -- 5% nível 1
            (2, 0.03),  -- 3% nível 2
            (3, 0.02),  -- 2% nível 3
            (4, 0.01),  -- 1% nível 4
            (5, 0.005)  -- 0.5% nível 5
        ) AS rules(level_distance, commission_rate)
    ),
    transaction_data AS (
        SELECT t.affiliate_id, t.amount
        FROM transactions t
        WHERE t.transaction_id = p_transaction_id
    )
    SELECT 
        hi.ancestor_id as beneficiary_id,
        hi.level_distance,
        (td.amount * cr.commission_rate) as commission_amount
    FROM hierarchy_index hi
    CROSS JOIN transaction_data td
    JOIN commission_rules cr ON hi.level_distance = cr.level_distance
    WHERE hi.descendant_id = td.affiliate_id
      AND hi.level_distance <= p_max_levels
      AND hi.level_distance > 0;
END;
$$ LANGUAGE plpgsql;

-- Função para cache inteligente
CREATE OR REPLACE FUNCTION get_top_performers_cached(
    p_level INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
    cache_key VARCHAR(255);
    cached_result JSONB;
BEGIN
    cache_key := 'top_performers_level_' || p_level || '_limit_' || p_limit;
    
    -- Verificar cache
    SELECT cache_data INTO cached_result
    FROM performance_cache
    WHERE cache_key = cache_key
      AND expires_at > NOW();
    
    IF cached_result IS NOT NULL THEN
        -- Atualizar contador de hits
        UPDATE performance_cache 
        SET hit_count = hit_count + 1, updated_at = NOW()
        WHERE cache_key = cache_key;
        
        RETURN cached_result;
    END IF;
    
    -- Calcular e cachear resultado
    WITH top_performers AS (
        SELECT 
            hi.ancestor_id as affiliate_id,
            COUNT(hi.descendant_id) as referrals_count
        FROM hierarchy_index hi
        WHERE hi.level_distance = p_level
        GROUP BY hi.ancestor_id
        ORDER BY referrals_count DESC
        LIMIT p_limit
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'affiliate_id', affiliate_id,
            'referrals_count', referrals_count
        )
    ) INTO cached_result
    FROM top_performers;
    
    -- Salvar no cache (válido por 1 hora)
    INSERT INTO performance_cache (cache_key, cache_data, expires_at)
    VALUES (cache_key, cached_result, NOW() + INTERVAL '1 hour')
    ON CONFLICT (cache_key) DO UPDATE SET
        cache_data = EXCLUDED.cache_data,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();
    
    RETURN cached_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS MATERIALIZADAS
-- =====================================================

-- View materializada para estatísticas de performance
CREATE MATERIALIZED VIEW affiliate_performance_stats AS
SELECT 
    a.affiliate_id,
    a.hierarchy_level,
    a.direct_referrals_count,
    a.total_network_size,
    COUNT(DISTINCT hi.descendant_id) as calculated_network_size,
    COALESCE(SUM(c.commission_amount), 0) as total_commissions_earned,
    COUNT(DISTINCT t.transaction_id) as total_transactions_generated,
    MAX(t.transaction_date) as last_transaction_date,
    a.created_at,
    a.updated_at
FROM affiliates_optimized a
LEFT JOIN hierarchy_index hi ON a.affiliate_id = hi.ancestor_id
LEFT JOIN commissions c ON a.affiliate_id = c.beneficiary_affiliate_id AND c.status = 'paid'
LEFT JOIN transactions t ON a.affiliate_id = t.affiliate_id
GROUP BY a.affiliate_id, a.hierarchy_level, a.direct_referrals_count, 
         a.total_network_size, a.created_at, a.updated_at;

-- Índices na view materializada
CREATE UNIQUE INDEX idx_perf_stats_affiliate ON affiliate_performance_stats (affiliate_id);
CREATE INDEX idx_perf_stats_network_size ON affiliate_performance_stats (calculated_network_size DESC);
CREATE INDEX idx_perf_stats_commissions ON affiliate_performance_stats (total_commissions_earned DESC);
CREATE INDEX idx_perf_stats_level ON affiliate_performance_stats (hierarchy_level, direct_referrals_count DESC);

-- View de métricas em tempo real
CREATE VIEW real_time_metrics AS
WITH affiliate_stats AS (
    SELECT 
        COUNT(*) as total_affiliates,
        COUNT(*) FILTER (WHERE status = 'active') as active_affiliates,
        MAX(hierarchy_level) as max_level,
        AVG(hierarchy_level) as avg_level,
        COUNT(*) FILTER (WHERE direct_referrals_count > 0) as affiliates_with_referrals
    FROM affiliates_optimized
),
transaction_stats AS (
    SELECT 
        COUNT(*) as transactions_today,
        SUM(amount) as volume_today,
        AVG(amount) as avg_transaction_amount,
        COUNT(*) FILTER (WHERE commission_processed = true) as processed_commissions
    FROM transactions
    WHERE transaction_date >= CURRENT_DATE
),
commission_stats AS (
    SELECT 
        COUNT(*) as total_commissions_today,
        SUM(commission_amount) as total_commission_amount_today,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_commissions_today,
        AVG(commission_amount) as avg_commission_amount
    FROM commissions
    WHERE created_at >= CURRENT_DATE
),
performance_stats AS (
    SELECT 
        COUNT(*) as queries_last_hour,
        AVG(query_duration_ms) as avg_query_duration,
        MAX(query_duration_ms) as max_query_duration,
        COUNT(*) FILTER (WHERE query_duration_ms > 100) as slow_queries
    FROM query_performance_log
    WHERE created_at >= NOW() - INTERVAL '1 hour'
)
SELECT 
    as_.*,
    ts.*,
    cs.*,
    ps.*,
    NOW() as last_updated
FROM affiliate_stats as_
CROSS JOIN transaction_stats ts
CROSS JOIN commission_stats cs
CROSS JOIN performance_stats ps;

-- =====================================================
-- FUNÇÕES DE MANUTENÇÃO
-- =====================================================

-- Limpeza automática de cache expirado
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM performance_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log da operação
    INSERT INTO system_log (operation, details)
    VALUES ('cache_cleanup', jsonb_build_object('deleted_count', deleted_count));
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Refresh automático da view materializada
CREATE OR REPLACE FUNCTION refresh_performance_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY affiliate_performance_stats;
    
    -- Log da operação
    INSERT INTO system_log (operation, details)
    VALUES ('refresh_materialized_view', jsonb_build_object('view_name', 'affiliate_performance_stats'));
END;
$$ LANGUAGE plpgsql;

-- Função de saúde do sistema
CREATE OR REPLACE FUNCTION system_health_check()
RETURNS JSONB AS $$
DECLARE
    health_data JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_affiliates', (SELECT COUNT(*) FROM affiliates_optimized),
        'active_affiliates', (SELECT COUNT(*) FROM affiliates_optimized WHERE status = 'active'),
        'total_relationships', (SELECT COUNT(*) FROM hierarchy_index WHERE is_active = true),
        'pending_commissions', (SELECT COUNT(*) FROM commissions WHERE status = 'pending'),
        'cache_entries', (SELECT COUNT(*) FROM performance_cache WHERE expires_at > NOW()),
        'last_transaction', (SELECT MAX(transaction_date) FROM transactions),
        'system_uptime', NOW() - (SELECT MIN(created_at) FROM system_log),
        'check_timestamp', NOW()
    ) INTO health_data;
    
    RETURN health_data;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON SCHEMA fature_v2 IS 'Schema otimizado para sistema Fature CPA v2 com arquitetura HPI';

COMMENT ON TABLE affiliates_optimized IS 'Tabela principal de afiliados com hierarquia materializada usando LTREE';
COMMENT ON TABLE hierarchy_index IS 'Índice materializado de todos os relacionamentos hierárquicos para consultas O(1)';
COMMENT ON TABLE transactions IS 'Transações financeiras com suporte a processamento de comissões em tempo real';
COMMENT ON TABLE commissions IS 'Comissões calculadas automaticamente para cada transação';

COMMENT ON COLUMN affiliates_optimized.hierarchy_path IS 'Caminho hierárquico completo usando LTREE para consultas eficientes';
COMMENT ON COLUMN affiliates_optimized.hierarchy_level IS 'Nível na hierarquia (1 = raiz)';
COMMENT ON COLUMN affiliates_optimized.direct_referrals_count IS 'Contador cache de indicações diretas';
COMMENT ON COLUMN affiliates_optimized.total_network_size IS 'Contador cache do tamanho total da rede';

COMMENT ON COLUMN hierarchy_index.level_distance IS 'Distância em níveis entre ancestral e descendente';
COMMENT ON COLUMN hierarchy_index.path_weight IS 'Peso do caminho para cálculos de comissão diferenciados';

-- Finalizar configuração
RESET search_path;

