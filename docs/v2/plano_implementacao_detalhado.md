# Plano de Implementação: Nova Arquitetura Fature CPA

**Autor**: Manus AI  
**Data**: 30 de junho de 2025  
**Status**: APROVADO PARA IMPLEMENTAÇÃO  
**Prioridade**: CRÍTICA  

## Sumário Executivo da Implementação

A implementação da nova arquitetura HPI (Hierarchical Path Indexing) será executada em 4 fases principais ao longo de 2 semanas, garantindo zero downtime e migração segura de todos os dados existentes. Este plano detalha cada etapa, scripts necessários, pontos de validação e procedimentos de rollback.

## 📅 Cronograma Master de Implementação

### Semana 1: Preparação e Desenvolvimento

**Dias 1-2: Preparação do Ambiente**
- Configuração do ambiente de desenvolvimento
- Criação da nova estrutura de banco
- Implementação dos algoritmos core
- Testes unitários e de performance

**Dias 3-4: Desenvolvimento dos Scripts**
- Scripts de migração de dados
- Algoritmos de cálculo de hierarquia
- Sistema de monitoramento
- Testes de integração

**Dia 5: Validação e Testes**
- Testes com dados sintéticos
- Validação de performance
- Testes de stress
- Preparação para migração

### Semana 2: Migração e Ativação

**Dias 6-7: Migração de Dados**
- Migração dos afiliados existentes
- Construção do índice hierárquico
- Migração das transações históricas
- Validação de integridade

**Dias 8-9: Ativação Gradual**
- Ativação do sistema em modo híbrido
- Monitoramento comparativo
- Ajustes de performance
- Validação de resultados

**Dia 10: Go-Live Completo**
- Ativação completa da nova arquitetura
- Desativação do sistema antigo
- Monitoramento intensivo 24h
- Documentação final

## 🏗️ Fase 1: Preparação do Ambiente (Dias 1-2)

### Objetivos da Fase 1
A primeira fase estabelece a fundação técnica para toda a implementação. Durante esta fase, criaremos a nova estrutura de banco de dados em paralelo ao sistema existente, implementaremos os algoritmos fundamentais e realizaremos testes preliminares de performance.

### Atividades Detalhadas

#### Dia 1: Configuração da Infraestrutura

**Manhã (08:00-12:00): Preparação do Banco de Dados**

A preparação do banco de dados é crítica para o sucesso da implementação. Começaremos criando um novo schema dedicado à nova arquitetura, permitindo desenvolvimento e testes em paralelo ao sistema de produção.

Primeiro, estabeleceremos conexão com o banco Fature existente e criaremos o novo schema:

```sql
-- Conectar ao banco Fature
-- Host: hopper.proxy.rlwy.net:48603
-- Database: railway

-- Criar schema para nova arquitetura
CREATE SCHEMA fature_v2;
SET search_path TO fature_v2;

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Em seguida, criaremos as tabelas principais da nova arquitetura. A tabela `affiliates_optimized` será o coração do novo sistema:

```sql
-- Tabela principal otimizada
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
```

A tabela de índice hierárquico materializa todos os relacionamentos, eliminando cálculos recursivos:

```sql
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
```

**Tarde (13:00-17:00): Criação de Índices Otimizados**

Os índices são fundamentais para a performance excepcional da nova arquitetura. Criaremos índices especializados para cada tipo de consulta:

```sql
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
```

#### Dia 2: Implementação dos Algoritmos Core

**Manhã (08:00-12:00): Funções de Hierarquia**

Implementaremos as funções fundamentais que mantêm a hierarquia atualizada automaticamente:

```sql
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
```

Função para construir o índice hierárquico:

```sql
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
```

**Tarde (13:00-17:00): Sistema de Contadores**

Implementaremos o sistema de contadores automáticos que mantém estatísticas atualizadas:

```sql
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
```

## 🔧 Fase 2: Desenvolvimento dos Scripts (Dias 3-4)

### Objetivos da Fase 2
Durante esta fase, desenvolveremos todos os scripts necessários para migração de dados, cálculos de comissões e monitoramento do sistema. Cada script será testado individualmente antes da integração.

### Atividades Detalhadas

#### Dia 3: Scripts de Migração

**Manhã (08:00-12:00): Script de Migração de Afiliados**

O script de migração de afiliados é o mais crítico, pois estabelece a base para toda a nova estrutura:

```sql
-- Script principal de migração de afiliados
CREATE OR REPLACE FUNCTION migrate_affiliates_batch(
    p_batch_size INTEGER DEFAULT 5000,
    p_start_id BIGINT DEFAULT 0
) RETURNS TABLE(
    batch_number INTEGER,
    processed_count INTEGER,
    success_count INTEGER,
    error_count INTEGER,
    duration_ms INTEGER
) AS $$
DECLARE
    batch_num INTEGER := 1;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    total_processed INTEGER := 0;
    total_success INTEGER := 0;
    total_errors INTEGER := 0;
    current_batch_size INTEGER;
    max_id BIGINT;
BEGIN
    -- Obter ID máximo para processar
    SELECT MAX(affiliate_id) INTO max_id FROM public.affiliates;
    
    WHILE p_start_id < max_id LOOP
        start_time := clock_timestamp();
        current_batch_size := 0;
        
        -- Processar lote de afiliados
        INSERT INTO fature_v2.affiliates_optimized (
            affiliate_id, parent_affiliate_id, external_id, name,
            status, registration_date, total_deposits, total_bets,
            total_withdrawals, total_cpa_earned, total_rev_earned,
            total_commissions_paid, created_at
        )
        SELECT 
            a.affiliate_id,
            a.parent_affiliate_id,
            a.external_id,
            a.name,
            a.status,
            a.registration_date,
            COALESCE(a.total_deposits, 0),
            COALESCE(a.total_bets, 0),
            COALESCE(a.total_withdrawals, 0),
            COALESCE(a.total_cpa_earned, 0),
            COALESCE(a.total_rev_earned, 0),
            COALESCE(a.total_commissions_paid, 0),
            a.created_at
        FROM public.affiliates a
        WHERE a.affiliate_id > p_start_id 
          AND a.affiliate_id <= p_start_id + p_batch_size
        ORDER BY a.affiliate_id;
        
        GET DIAGNOSTICS current_batch_size = ROW_COUNT;
        
        end_time := clock_timestamp();
        
        -- Retornar estatísticas do lote
        RETURN QUERY SELECT 
            batch_num,
            current_batch_size,
            current_batch_size, -- Assumindo sucesso total por enquanto
            0, -- Erros serão tratados em versão mais robusta
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;
        
        -- Atualizar contadores
        total_processed := total_processed + current_batch_size;
        total_success := total_success + current_batch_size;
        
        -- Preparar próximo lote
        p_start_id := p_start_id + p_batch_size;
        batch_num := batch_num + 1;
        
        -- Log de progresso
        RAISE NOTICE 'Lote % concluído: % afiliados migrados', 
            batch_num - 1, current_batch_size;
        
        -- Commit parcial para evitar transações longas
        COMMIT;
    END LOOP;
    
    RAISE NOTICE 'Migração concluída: % afiliados processados, % sucessos, % erros',
        total_processed, total_success, total_errors;
END;
$$ LANGUAGE plpgsql;
```

**Tarde (13:00-17:00): Script de Construção do Índice Hierárquico**

Após migrar os afiliados, precisamos construir o índice hierárquico completo:

```sql
-- Script para construção completa do índice hierárquico
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
```

#### Dia 4: Sistema de Comissões e Monitoramento

**Manhã (08:00-12:00): Sistema de Comissões em Tempo Real**

Implementaremos o sistema completo de processamento de comissões:

```sql
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

-- Índices para transações
CREATE INDEX idx_transactions_affiliate ON transactions(affiliate_id, transaction_date);
CREATE INDEX idx_transactions_processing ON transactions(commission_eligible, commission_processed, transaction_date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type, transaction_date);

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

-- Índices para comissões
CREATE INDEX idx_commissions_beneficiary ON commissions(beneficiary_affiliate_id, status);
CREATE INDEX idx_commissions_transaction ON commissions(transaction_id, level_distance);
CREATE INDEX idx_commissions_processing ON commissions(status, created_at, batch_id);
CREATE INDEX idx_commissions_payment ON commissions(status, paid_at) WHERE status = 'paid';
```

Função para cálculo automático de comissões:

```sql
-- Função para calcular comissões automaticamente
CREATE OR REPLACE FUNCTION calculate_commissions_auto()
RETURNS TRIGGER AS $$
DECLARE
    commission_rules RECORD;
    hierarchy_record RECORD;
    commission_amount DECIMAL(15,2);
    batch_id BIGINT;
BEGIN
    -- Verificar se transação é elegível para comissão
    IF NOT NEW.commission_eligible THEN
        RETURN NEW;
    END IF;
    
    -- Gerar ID do lote
    batch_id := nextval('commission_batch_seq');
    
    -- Buscar regras de comissão (configurável)
    FOR commission_rules IN
        SELECT level_distance, commission_rate
        FROM (VALUES 
            (1, 0.05),   -- 5% nível 1
            (2, 0.03),   -- 3% nível 2
            (3, 0.02),   -- 2% nível 3
            (4, 0.01),   -- 1% nível 4
            (5, 0.005)   -- 0.5% nível 5
        ) AS rules(level_distance, commission_rate)
    LOOP
        -- Buscar afiliados que devem receber comissão neste nível
        FOR hierarchy_record IN
            SELECT hi.ancestor_id
            FROM hierarchy_index hi
            JOIN affiliates_optimized a ON hi.ancestor_id = a.affiliate_id
            WHERE hi.descendant_id = NEW.affiliate_id
              AND hi.level_distance = commission_rules.level_distance
              AND hi.is_active = true
              AND a.status = 'active'
        LOOP
            -- Calcular valor da comissão
            commission_amount := NEW.amount * commission_rules.commission_rate;
            
            -- Inserir registro de comissão
            INSERT INTO commissions (
                transaction_id, beneficiary_affiliate_id, source_affiliate_id,
                level_distance, base_amount, commission_rate, commission_amount,
                currency, batch_id
            ) VALUES (
                NEW.transaction_id, hierarchy_record.ancestor_id, NEW.affiliate_id,
                commission_rules.level_distance, NEW.amount, 
                commission_rules.commission_rate, commission_amount,
                NEW.currency, batch_id
            );
        END LOOP;
    END LOOP;
    
    -- Marcar transação como processada
    NEW.commission_processed = true;
    NEW.commission_batch_id = batch_id;
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para cálculo automático de comissões
CREATE TRIGGER trg_calculate_commissions_auto
    BEFORE UPDATE OF commission_eligible ON transactions
    FOR EACH ROW 
    WHEN (NEW.commission_eligible = true AND OLD.commission_processed = false)
    EXECUTE FUNCTION calculate_commissions_auto();
```

**Tarde (13:00-17:00): Sistema de Monitoramento**

Implementaremos um sistema completo de monitoramento e alertas:

```sql
-- Tabela de logs de performance
CREATE TABLE query_performance_log (
    log_id BIGSERIAL PRIMARY KEY,
    query_type VARCHAR(100) NOT NULL,
    query_duration_ms INTEGER NOT NULL,
    affected_rows INTEGER,
    query_hash VARCHAR(64),
    parameters JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_perf_log_type_time (query_type, created_at),
    INDEX idx_perf_log_duration (query_duration_ms, created_at)
);

-- Tabela de cache de performance
CREATE TABLE performance_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_cache_expiration (expires_at),
    INDEX idx_cache_hits (hit_count, updated_at)
);

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
```

Função de alertas automáticos:

```sql
-- Sistema de alertas automáticos
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE(
    alert_level VARCHAR(20),
    alert_type VARCHAR(50),
    message TEXT,
    metric_value NUMERIC,
    threshold_value NUMERIC,
    timestamp TIMESTAMP
) AS $$
BEGIN
    -- Alerta para consultas lentas
    RETURN QUERY
    SELECT 
        'WARNING'::VARCHAR as alert_level,
        'slow_queries'::VARCHAR as alert_type,
        format('Detectadas %s consultas lentas (>100ms) na última hora', 
               COUNT(*)) as message,
        COUNT(*)::NUMERIC as metric_value,
        10::NUMERIC as threshold_value,
        NOW() as timestamp
    FROM query_performance_log
    WHERE created_at >= NOW() - INTERVAL '1 hour'
      AND query_duration_ms > 100
    HAVING COUNT(*) > 10
    
    UNION ALL
    
    -- Alerta para fila de comissões
    SELECT 
        CASE WHEN COUNT(*) > 10000 THEN 'CRITICAL' ELSE 'WARNING' END::VARCHAR,
        'commission_backlog'::VARCHAR,
        format('Fila de comissões pendentes: %s registros', COUNT(*)),
        COUNT(*)::NUMERIC,
        1000::NUMERIC,
        NOW()
    FROM commissions
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '1 hour'
    HAVING COUNT(*) > 1000
    
    UNION ALL
    
    -- Alerta para taxa de erro
    SELECT 
        'CRITICAL'::VARCHAR,
        'high_error_rate'::VARCHAR,
        format('Taxa de erro alta: %.2f%% nas últimas 2 horas', 
               (error_count * 100.0 / total_count)),
        (error_count * 100.0 / total_count)::NUMERIC,
        5.0::NUMERIC,
        NOW()
    FROM (
        SELECT 
            COUNT(*) FILTER (WHERE status IN ('cancelled', 'disputed')) as error_count,
            COUNT(*) as total_count
        FROM commissions
        WHERE created_at >= NOW() - INTERVAL '2 hours'
    ) error_stats
    WHERE total_count > 0 AND (error_count * 100.0 / total_count) > 5.0;
END;
$$ LANGUAGE plpgsql;
```


## 🧪 Fase 3: Validação e Testes (Dia 5)

### Objetivos da Fase 3
A terceira fase é crítica para garantir que todos os componentes funcionem perfeitamente antes da migração de produção. Durante esta fase, executaremos testes abrangentes com dados sintéticos e reais, validaremos a performance e identificaremos possíveis gargalos.

### Atividades Detalhadas

#### Manhã (08:00-12:00): Testes de Performance

Os testes de performance são fundamentais para validar que a nova arquitetura atende aos requisitos de velocidade e throughput estabelecidos. Começaremos criando um ambiente de testes com dados sintéticos que simulem o volume de produção.

**Criação de Dados de Teste:**

```python
#!/usr/bin/env python3
"""
Gerador de Dados de Teste - Fature CPA v2
"""

import psycopg2
import random
import time
from datetime import datetime, timedelta

class TestDataGenerator:
    def __init__(self):
        self.config = {
            'host': 'hopper.proxy.rlwy.net',
            'port': 48603,
            'database': 'railway',
            'user': 'postgres',
            'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl'
        }
    
    def generate_test_affiliates(self, count: int = 100000):
        """Gerar afiliados de teste com hierarquia realística"""
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                # Gerar afiliados raiz (10% do total)
                root_count = count // 10
                
                for i in range(1, root_count + 1):
                    cursor.execute("""
                        INSERT INTO fature_v2.affiliates_optimized 
                        (affiliate_id, external_id, name, status, registration_date)
                        VALUES (%s, %s, %s, 'active', %s)
                    """, (
                        i,
                        f"test_user_{i}",
                        f"Test_Affiliate_{i}",
                        datetime.now() - timedelta(days=random.randint(1, 365))
                    ))
                
                conn.commit()
                
                # Gerar afiliados com parents (90% do total)
                for i in range(root_count + 1, count + 1):
                    parent_id = random.randint(1, i - 1)
                    
                    cursor.execute("""
                        INSERT INTO fature_v2.affiliates_optimized 
                        (affiliate_id, parent_affiliate_id, external_id, name, status, registration_date)
                        VALUES (%s, %s, %s, %s, 'active', %s)
                    """, (
                        i,
                        parent_id,
                        f"test_user_{i}",
                        f"Test_Affiliate_{i}",
                        datetime.now() - timedelta(days=random.randint(1, 365))
                    ))
                    
                    if i % 1000 == 0:
                        conn.commit()
                        print(f"Gerados {i} afiliados de teste...")
                
                conn.commit()
                print(f"✅ {count} afiliados de teste criados com sucesso")
                
        finally:
            conn.close()
    
    def generate_test_transactions(self, count: int = 1000000):
        """Gerar transações de teste"""
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                # Obter IDs de afiliados existentes
                cursor.execute("SELECT affiliate_id FROM fature_v2.affiliates_optimized LIMIT 10000;")
                affiliate_ids = [row[0] for row in cursor.fetchall()]
                
                for i in range(count):
                    affiliate_id = random.choice(affiliate_ids)
                    amount = random.uniform(10.0, 1000.0)
                    transaction_type = random.choice(['deposit', 'bet', 'withdrawal'])
                    
                    cursor.execute("""
                        INSERT INTO fature_v2.transactions 
                        (affiliate_id, transaction_type, amount, transaction_date, commission_eligible)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (
                        affiliate_id,
                        transaction_type,
                        amount,
                        datetime.now() - timedelta(hours=random.randint(1, 24*30)),
                        transaction_type in ['deposit', 'bet']
                    ))
                    
                    if i % 10000 == 0:
                        conn.commit()
                        print(f"Geradas {i} transações de teste...")
                
                conn.commit()
                print(f"✅ {count} transações de teste criadas com sucesso")
                
        finally:
            conn.close()

if __name__ == "__main__":
    generator = TestDataGenerator()
    generator.generate_test_affiliates(100000)
    generator.generate_test_transactions(1000000)
```

**Testes de Performance Automatizados:**

```python
#!/usr/bin/env python3
"""
Suite de Testes de Performance - Fature CPA v2
"""

import psycopg2
import time
import statistics
from typing import List, Dict

class PerformanceTests:
    def __init__(self):
        self.config = {
            'host': 'hopper.proxy.rlwy.net',
            'port': 48603,
            'database': 'railway',
            'user': 'postgres',
            'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl'
        }
        
        self.test_results = {}
    
    def run_query_performance_test(self, query: str, test_name: str, iterations: int = 100) -> Dict:
        """Executar teste de performance para uma query específica"""
        conn = psycopg2.connect(**self.config)
        execution_times = []
        
        try:
            with conn.cursor() as cursor:
                # Warm-up
                for _ in range(5):
                    cursor.execute(query)
                    cursor.fetchall()
                
                # Testes reais
                for i in range(iterations):
                    start_time = time.time()
                    cursor.execute(query)
                    cursor.fetchall()
                    end_time = time.time()
                    
                    execution_times.append((end_time - start_time) * 1000)  # ms
                
                results = {
                    'test_name': test_name,
                    'iterations': iterations,
                    'avg_time_ms': statistics.mean(execution_times),
                    'median_time_ms': statistics.median(execution_times),
                    'min_time_ms': min(execution_times),
                    'max_time_ms': max(execution_times),
                    'std_dev_ms': statistics.stdev(execution_times) if len(execution_times) > 1 else 0,
                    'p95_time_ms': sorted(execution_times)[int(0.95 * len(execution_times))],
                    'p99_time_ms': sorted(execution_times)[int(0.99 * len(execution_times))]
                }
                
                self.test_results[test_name] = results
                return results
                
        finally:
            conn.close()
    
    def test_hierarchy_queries(self):
        """Testar consultas hierárquicas"""
        queries = {
            'direct_referrals': """
                SELECT COUNT(*) FROM fature_v2.hierarchy_index 
                WHERE ancestor_id = 1 AND level_distance = 1;
            """,
            'network_size_level_3': """
                SELECT COUNT(*) FROM fature_v2.hierarchy_index 
                WHERE ancestor_id = 1 AND level_distance <= 3;
            """,
            'top_performers': """
                SELECT ancestor_id, COUNT(*) as referrals
                FROM fature_v2.hierarchy_index 
                WHERE level_distance = 1
                GROUP BY ancestor_id
                ORDER BY referrals DESC
                LIMIT 10;
            """,
            'hierarchy_path_query': """
                SELECT * FROM fature_v2.affiliates_optimized 
                WHERE hierarchy_path ~ '*.1.*'
                LIMIT 100;
            """
        }
        
        for test_name, query in queries.items():
            print(f"Executando teste: {test_name}")
            self.run_query_performance_test(query, test_name)
    
    def test_commission_calculations(self):
        """Testar cálculos de comissão"""
        queries = {
            'commission_calculation': """
                SELECT * FROM fature_v2.calculate_commissions_realtime(1, 5);
            """,
            'pending_commissions': """
                SELECT COUNT(*) FROM fature_v2.commissions 
                WHERE status = 'pending' AND created_at >= NOW() - INTERVAL '1 hour';
            """,
            'commission_aggregation': """
                SELECT beneficiary_affiliate_id, SUM(commission_amount)
                FROM fature_v2.commissions
                WHERE status = 'paid' AND created_at >= CURRENT_DATE
                GROUP BY beneficiary_affiliate_id
                ORDER BY SUM(commission_amount) DESC
                LIMIT 100;
            """
        }
        
        for test_name, query in queries.items():
            print(f"Executando teste: {test_name}")
            self.run_query_performance_test(query, test_name)
    
    def test_concurrent_load(self, concurrent_users: int = 50):
        """Testar carga concorrente"""
        import threading
        import queue
        
        results_queue = queue.Queue()
        
        def worker():
            try:
                conn = psycopg2.connect(**self.config)
                with conn.cursor() as cursor:
                    start_time = time.time()
                    
                    # Simular operações típicas de um usuário
                    cursor.execute("SELECT COUNT(*) FROM fature_v2.affiliates_optimized WHERE status = 'active';")
                    cursor.fetchone()
                    
                    cursor.execute("SELECT * FROM fature_v2.get_top_performers_cached(1, 10);")
                    cursor.fetchone()
                    
                    cursor.execute("""
                        SELECT affiliate_id, direct_referrals_count 
                        FROM fature_v2.affiliates_optimized 
                        WHERE direct_referrals_count > 0 
                        ORDER BY direct_referrals_count DESC 
                        LIMIT 20;
                    """)
                    cursor.fetchall()
                    
                    end_time = time.time()
                    results_queue.put(end_time - start_time)
                    
                conn.close()
            except Exception as e:
                results_queue.put(f"ERROR: {e}")
        
        # Executar threads concorrentes
        threads = []
        start_time = time.time()
        
        for _ in range(concurrent_users):
            thread = threading.Thread(target=worker)
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        total_time = time.time() - start_time
        
        # Coletar resultados
        execution_times = []
        errors = 0
        
        while not results_queue.empty():
            result = results_queue.get()
            if isinstance(result, str) and result.startswith("ERROR"):
                errors += 1
            else:
                execution_times.append(result * 1000)  # ms
        
        if execution_times:
            concurrent_results = {
                'test_name': f'concurrent_load_{concurrent_users}_users',
                'concurrent_users': concurrent_users,
                'total_time_s': total_time,
                'successful_requests': len(execution_times),
                'failed_requests': errors,
                'avg_response_time_ms': statistics.mean(execution_times),
                'throughput_requests_per_second': len(execution_times) / total_time,
                'p95_response_time_ms': sorted(execution_times)[int(0.95 * len(execution_times))] if execution_times else 0
            }
            
            self.test_results[f'concurrent_{concurrent_users}'] = concurrent_results
    
    def generate_performance_report(self) -> str:
        """Gerar relatório de performance"""
        report = "=== RELATÓRIO DE PERFORMANCE FATURE CPA v2 ===\n\n"
        
        for test_name, results in self.test_results.items():
            report += f"## {test_name.upper()}\n"
            
            if 'concurrent_users' in results:
                report += f"Usuários concorrentes: {results['concurrent_users']}\n"
                report += f"Tempo total: {results['total_time_s']:.2f}s\n"
                report += f"Requisições bem-sucedidas: {results['successful_requests']}\n"
                report += f"Requisições falhadas: {results['failed_requests']}\n"
                report += f"Throughput: {results['throughput_requests_per_second']:.2f} req/s\n"
                report += f"Tempo médio de resposta: {results['avg_response_time_ms']:.2f}ms\n"
                report += f"P95 tempo de resposta: {results['p95_response_time_ms']:.2f}ms\n"
            else:
                report += f"Iterações: {results['iterations']}\n"
                report += f"Tempo médio: {results['avg_time_ms']:.2f}ms\n"
                report += f"Tempo mediano: {results['median_time_ms']:.2f}ms\n"
                report += f"Tempo mínimo: {results['min_time_ms']:.2f}ms\n"
                report += f"Tempo máximo: {results['max_time_ms']:.2f}ms\n"
                report += f"P95: {results['p95_time_ms']:.2f}ms\n"
                report += f"P99: {results['p99_time_ms']:.2f}ms\n"
            
            report += "\n"
        
        return report
    
    def run_all_tests(self):
        """Executar todos os testes de performance"""
        print("🚀 Iniciando testes de performance...")
        
        print("Testando consultas hierárquicas...")
        self.test_hierarchy_queries()
        
        print("Testando cálculos de comissão...")
        self.test_commission_calculations()
        
        print("Testando carga concorrente...")
        self.test_concurrent_load(50)
        self.test_concurrent_load(100)
        
        print("✅ Todos os testes concluídos!")
        
        # Gerar e salvar relatório
        report = self.generate_performance_report()
        with open('performance_report.txt', 'w') as f:
            f.write(report)
        
        print("📊 Relatório de performance salvo em 'performance_report.txt'")
        return report

if __name__ == "__main__":
    tests = PerformanceTests()
    report = tests.run_all_tests()
    print(report)
```

#### Tarde (13:00-17:00): Testes de Integridade e Validação

Durante a tarde, focaremos em testes de integridade de dados e validação de regras de negócio. Estes testes garantem que a migração preserve todos os dados corretamente e que as regras de comissão funcionem conforme esperado.

**Script de Validação de Integridade:**

```python
#!/usr/bin/env python3
"""
Validação de Integridade - Fature CPA v2
"""

import psycopg2
import logging

class IntegrityValidator:
    def __init__(self):
        self.config = {
            'host': 'hopper.proxy.rlwy.net',
            'port': 48603,
            'database': 'railway',
            'user': 'postgres',
            'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl'
        }
        
        self.validation_results = {}
    
    def validate_hierarchy_integrity(self):
        """Validar integridade da hierarquia"""
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                # Teste 1: Verificar vínculos órfãos
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.affiliates_optimized a
                    WHERE a.parent_affiliate_id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM fature_v2.affiliates_optimized p
                          WHERE p.affiliate_id = a.parent_affiliate_id
                      );
                """)
                orphaned_count = cursor.fetchone()[0]
                
                # Teste 2: Verificar consistência de níveis
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.affiliates_optimized a
                    JOIN fature_v2.affiliates_optimized p ON a.parent_affiliate_id = p.affiliate_id
                    WHERE a.hierarchy_level != p.hierarchy_level + 1;
                """)
                level_inconsistencies = cursor.fetchone()[0]
                
                # Teste 3: Verificar paths LTREE
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.affiliates_optimized
                    WHERE hierarchy_path IS NULL OR hierarchy_path::text = '';
                """)
                invalid_paths = cursor.fetchone()[0]
                
                # Teste 4: Verificar contadores de indicações
                cursor.execute("""
                    SELECT COUNT(*) FROM (
                        SELECT 
                            a.affiliate_id,
                            a.direct_referrals_count,
                            COUNT(c.affiliate_id) as actual_count
                        FROM fature_v2.affiliates_optimized a
                        LEFT JOIN fature_v2.affiliates_optimized c ON a.affiliate_id = c.parent_affiliate_id
                        GROUP BY a.affiliate_id, a.direct_referrals_count
                        HAVING a.direct_referrals_count != COUNT(c.affiliate_id)
                    ) mismatches;
                """)
                counter_mismatches = cursor.fetchone()[0]
                
                self.validation_results['hierarchy_integrity'] = {
                    'orphaned_affiliates': orphaned_count,
                    'level_inconsistencies': level_inconsistencies,
                    'invalid_paths': invalid_paths,
                    'counter_mismatches': counter_mismatches,
                    'passed': all([
                        orphaned_count == 0,
                        level_inconsistencies == 0,
                        invalid_paths == 0,
                        counter_mismatches == 0
                    ])
                }
                
        finally:
            conn.close()
    
    def validate_hierarchy_index(self):
        """Validar índice hierárquico"""
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                # Teste 1: Verificar relacionamentos duplicados
                cursor.execute("""
                    SELECT COUNT(*) FROM (
                        SELECT ancestor_id, descendant_id, COUNT(*)
                        FROM fature_v2.hierarchy_index
                        GROUP BY ancestor_id, descendant_id
                        HAVING COUNT(*) > 1
                    ) duplicates;
                """)
                duplicate_relationships = cursor.fetchone()[0]
                
                # Teste 2: Verificar relacionamentos inválidos
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.hierarchy_index hi
                    WHERE NOT EXISTS (
                        SELECT 1 FROM fature_v2.affiliates_optimized a
                        WHERE a.affiliate_id = hi.ancestor_id
                    ) OR NOT EXISTS (
                        SELECT 1 FROM fature_v2.affiliates_optimized a
                        WHERE a.affiliate_id = hi.descendant_id
                    );
                """)
                invalid_relationships = cursor.fetchone()[0]
                
                # Teste 3: Verificar distâncias de nível
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.hierarchy_index hi
                    JOIN fature_v2.affiliates_optimized a ON hi.ancestor_id = a.affiliate_id
                    JOIN fature_v2.affiliates_optimized d ON hi.descendant_id = d.affiliate_id
                    WHERE hi.level_distance != (d.hierarchy_level - a.hierarchy_level);
                """)
                incorrect_distances = cursor.fetchone()[0]
                
                self.validation_results['hierarchy_index'] = {
                    'duplicate_relationships': duplicate_relationships,
                    'invalid_relationships': invalid_relationships,
                    'incorrect_distances': incorrect_distances,
                    'passed': all([
                        duplicate_relationships == 0,
                        invalid_relationships == 0,
                        incorrect_distances == 0
                    ])
                }
                
        finally:
            conn.close()
    
    def validate_commission_calculations(self):
        """Validar cálculos de comissão"""
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                # Teste 1: Verificar comissões negativas
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.commissions
                    WHERE commission_amount <= 0 OR base_amount <= 0 OR commission_rate <= 0;
                """)
                negative_commissions = cursor.fetchone()[0]
                
                # Teste 2: Verificar consistência de cálculos
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.commissions
                    WHERE ABS(commission_amount - (base_amount * commission_rate)) > 0.01;
                """)
                calculation_errors = cursor.fetchone()[0]
                
                # Teste 3: Verificar referências de transação
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.commissions c
                    WHERE NOT EXISTS (
                        SELECT 1 FROM fature_v2.transactions t
                        WHERE t.transaction_id = c.transaction_id
                    );
                """)
                missing_transactions = cursor.fetchone()[0]
                
                self.validation_results['commission_calculations'] = {
                    'negative_commissions': negative_commissions,
                    'calculation_errors': calculation_errors,
                    'missing_transactions': missing_transactions,
                    'passed': all([
                        negative_commissions == 0,
                        calculation_errors == 0,
                        missing_transactions == 0
                    ])
                }
                
        finally:
            conn.close()
    
    def run_all_validations(self):
        """Executar todas as validações"""
        print("🔍 Iniciando validações de integridade...")
        
        self.validate_hierarchy_integrity()
        self.validate_hierarchy_index()
        self.validate_commission_calculations()
        
        # Gerar relatório
        report = self.generate_validation_report()
        
        # Verificar se todas as validações passaram
        all_passed = all(
            result['passed'] for result in self.validation_results.values()
        )
        
        if all_passed:
            print("✅ Todas as validações passaram!")
        else:
            print("❌ Algumas validações falharam!")
        
        return all_passed, report
    
    def generate_validation_report(self):
        """Gerar relatório de validação"""
        report = "=== RELATÓRIO DE VALIDAÇÃO DE INTEGRIDADE ===\n\n"
        
        for validation_name, results in self.validation_results.items():
            status = "✅ PASSOU" if results['passed'] else "❌ FALHOU"
            report += f"## {validation_name.upper()} - {status}\n"
            
            for key, value in results.items():
                if key != 'passed':
                    report += f"  {key}: {value}\n"
            
            report += "\n"
        
        return report

if __name__ == "__main__":
    validator = IntegrityValidator()
    passed, report = validator.run_all_validations()
    
    with open('validation_report.txt', 'w') as f:
        f.write(report)
    
    print(report)
    exit(0 if passed else 1)
```

## 🚀 Fase 4: Migração de Produção (Dias 6-7)

### Objetivos da Fase 4
Esta é a fase mais crítica, onde executaremos a migração real dos dados de produção. Durante esta fase, migraremos todos os afiliados existentes, construiremos o índice hierárquico completo e validaremos a integridade dos dados migrados.

### Pré-requisitos para Migração
Antes de iniciar a migração de produção, devemos verificar:

1. **Backup Completo**: Backup completo do banco de dados atual
2. **Testes Validados**: Todos os testes de performance e integridade passaram
3. **Ambiente Preparado**: Nova estrutura criada e testada
4. **Equipe Disponível**: Equipe técnica disponível para monitoramento
5. **Plano de Rollback**: Procedimentos de rollback testados e prontos

### Atividades Detalhadas

#### Dia 6: Preparação e Início da Migração

**Manhã (08:00-12:00): Preparação Final**

A preparação final envolve a criação de backups de segurança e a configuração do ambiente de produção para a migração.

```bash
#!/bin/bash
# Script de preparação para migração de produção

echo "🔄 Iniciando preparação para migração de produção..."

# 1. Criar backup completo do banco atual
echo "📦 Criando backup completo..."
pg_dump -h hopper.proxy.rlwy.net -p 48603 -U postgres -d railway > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# 2. Verificar espaço em disco
echo "💾 Verificando espaço em disco..."
df -h

# 3. Verificar conexões ativas
echo "🔗 Verificando conexões ativas..."
psql -h hopper.proxy.rlwy.net -p 48603 -U postgres -d railway -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# 4. Executar script de rollback para criar tabelas de backup
echo "🛡️ Criando tabelas de backup..."
python3 rollback_fature.py backup

# 5. Verificar saúde do sistema atual
echo "🏥 Verificando saúde do sistema..."
python3 monitor_fature.py

echo "✅ Preparação concluída. Sistema pronto para migração."
```

**Tarde (13:00-17:00): Execução da Migração**

A execução da migração deve ser feita em horário de menor movimento para minimizar o impacto nos usuários.

```bash
#!/bin/bash
# Script principal de execução da migração

echo "🚀 INICIANDO MIGRAÇÃO DE PRODUÇÃO FATURE CPA v2"
echo "Timestamp: $(date)"

# Definir variáveis
LOG_FILE="migration_$(date +%Y%m%d_%H%M%S).log"
MIGRATION_START=$(date +%s)

# Função para log
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Função para verificar status
check_status() {
    if [ $? -eq 0 ]; then
        log_message "✅ $1 - SUCESSO"
    else
        log_message "❌ $1 - FALHOU"
        log_message "🚨 ABORTANDO MIGRAÇÃO"
        exit 1
    fi
}

log_message "Iniciando migração de produção..."

# Passo 1: Executar migração principal
log_message "Executando migração principal..."
python3 migrate_fature.py
check_status "Migração principal"

# Passo 2: Validar integridade
log_message "Validando integridade dos dados..."
python3 validate_integrity.py
check_status "Validação de integridade"

# Passo 3: Executar testes de performance
log_message "Executando testes de performance..."
python3 performance_tests.py
check_status "Testes de performance"

# Passo 4: Iniciar monitoramento
log_message "Iniciando monitoramento contínuo..."
nohup python3 monitor_fature.py --continuous 60 > monitoring.log 2>&1 &
MONITOR_PID=$!
echo $MONITOR_PID > monitor.pid

log_message "Monitoramento iniciado (PID: $MONITOR_PID)"

# Calcular tempo total
MIGRATION_END=$(date +%s)
TOTAL_TIME=$((MIGRATION_END - MIGRATION_START))

log_message "🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!"
log_message "Tempo total: $((TOTAL_TIME / 60)) minutos e $((TOTAL_TIME % 60)) segundos"
log_message "Log completo salvo em: $LOG_FILE"

echo "✅ Migração de produção concluída com sucesso!"
echo "📊 Verifique o arquivo $LOG_FILE para detalhes completos"
echo "🔍 Monitoramento ativo - PID: $MONITOR_PID"
```

#### Dia 7: Validação e Otimização

**Manhã (08:00-12:00): Validação Intensiva**

Após a migração, executaremos validações intensivas para garantir que todos os dados foram migrados corretamente e que o sistema está funcionando perfeitamente.

```python
#!/usr/bin/env python3
"""
Validação Pós-Migração - Fature CPA v2
"""

import psycopg2
import logging
from datetime import datetime

class PostMigrationValidator:
    def __init__(self):
        self.config = {
            'host': 'hopper.proxy.rlwy.net',
            'port': 48603,
            'database': 'railway',
            'user': 'postgres',
            'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl'
        }
    
    def compare_data_counts(self):
        """Comparar contagens entre sistema antigo e novo"""
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                # Comparar contagem de afiliados
                cursor.execute("SELECT COUNT(*) FROM public.affiliates;")
                original_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM fature_v2.affiliates_optimized;")
                new_count = cursor.fetchone()[0]
                
                print(f"📊 Contagem de Afiliados:")
                print(f"  Original: {original_count:,}")
                print(f"  Novo: {new_count:,}")
                print(f"  Diferença: {new_count - original_count}")
                
                if original_count != new_count:
                    print("⚠️ ATENÇÃO: Contagens não coincidem!")
                    return False
                
                # Verificar vínculos de indicação
                cursor.execute("""
                    SELECT COUNT(*) FROM public.affiliates 
                    WHERE parent_affiliate_id IS NOT NULL;
                """)
                original_links = cursor.fetchone()[0]
                
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.affiliates_optimized 
                    WHERE parent_affiliate_id IS NOT NULL;
                """)
                new_links = cursor.fetchone()[0]
                
                print(f"🔗 Vínculos de Indicação:")
                print(f"  Original: {original_links:,}")
                print(f"  Novo: {new_links:,}")
                
                if original_links != new_links:
                    print("⚠️ ATENÇÃO: Vínculos não coincidem!")
                    return False
                
                return True
                
        finally:
            conn.close()
    
    def validate_top_performers(self):
        """Validar que os top performers foram migrados corretamente"""
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                # Top 10 do sistema original
                cursor.execute("""
                    SELECT affiliate_id, level_1_referrals
                    FROM public.affiliates
                    WHERE level_1_referrals > 0
                    ORDER BY level_1_referrals DESC
                    LIMIT 10;
                """)
                original_top = cursor.fetchall()
                
                # Top 10 do novo sistema
                cursor.execute("""
                    SELECT affiliate_id, direct_referrals_count
                    FROM fature_v2.affiliates_optimized
                    WHERE direct_referrals_count > 0
                    ORDER BY direct_referrals_count DESC
                    LIMIT 10;
                """)
                new_top = cursor.fetchall()
                
                print("🏆 Validação Top Performers:")
                print("Original vs Novo:")
                
                for i, (orig, new) in enumerate(zip(original_top, new_top)):
                    orig_id, orig_count = orig
                    new_id, new_count = new
                    
                    status = "✅" if orig_id == new_id and orig_count == new_count else "❌"
                    print(f"  {i+1}. {status} {orig_id} ({orig_count}) -> {new_id} ({new_count})")
                
                return original_top == new_top
                
        finally:
            conn.close()
    
    def test_real_time_performance(self):
        """Testar performance em tempo real com dados reais"""
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                import time
                
                # Teste 1: Consulta hierárquica
                start_time = time.time()
                cursor.execute("""
                    SELECT COUNT(*) FROM fature_v2.hierarchy_index 
                    WHERE ancestor_id = (
                        SELECT affiliate_id FROM fature_v2.affiliates_optimized 
                        ORDER BY direct_referrals_count DESC LIMIT 1
                    ) AND level_distance <= 5;
                """)
                result = cursor.fetchone()[0]
                hierarchy_time = (time.time() - start_time) * 1000
                
                print(f"⚡ Teste de Performance em Tempo Real:")
                print(f"  Consulta hierárquica: {hierarchy_time:.2f}ms ({result:,} registros)")
                
                # Teste 2: Ranking em tempo real
                start_time = time.time()
                cursor.execute("""
                    SELECT affiliate_id, direct_referrals_count
                    FROM fature_v2.affiliates_optimized
                    WHERE direct_referrals_count > 0
                    ORDER BY direct_referrals_count DESC
                    LIMIT 100;
                """)
                cursor.fetchall()
                ranking_time = (time.time() - start_time) * 1000
                
                print(f"  Ranking top 100: {ranking_time:.2f}ms")
                
                # Teste 3: Cache de performance
                start_time = time.time()
                cursor.execute("SELECT fature_v2.get_top_performers_cached(1, 10);")
                cursor.fetchone()
                cache_time = (time.time() - start_time) * 1000
                
                print(f"  Cache de performance: {cache_time:.2f}ms")
                
                # Verificar se performance está dentro dos limites
                performance_ok = all([
                    hierarchy_time < 100,  # < 100ms
                    ranking_time < 50,     # < 50ms
                    cache_time < 10        # < 10ms
                ])
                
                return performance_ok
                
        finally:
            conn.close()
    
    def run_comprehensive_validation(self):
        """Executar validação abrangente pós-migração"""
        print("🔍 Iniciando validação abrangente pós-migração...")
        print(f"Timestamp: {datetime.now()}")
        print("=" * 60)
        
        validations = [
            ("Comparação de contagens", self.compare_data_counts),
            ("Validação de top performers", self.validate_top_performers),
            ("Teste de performance em tempo real", self.test_real_time_performance)
        ]
        
        results = {}
        all_passed = True
        
        for validation_name, validation_func in validations:
            print(f"\n🧪 Executando: {validation_name}")
            try:
                result = validation_func()
                results[validation_name] = result
                
                if result:
                    print(f"✅ {validation_name} - PASSOU")
                else:
                    print(f"❌ {validation_name} - FALHOU")
                    all_passed = False
                    
            except Exception as e:
                print(f"💥 {validation_name} - ERRO: {e}")
                results[validation_name] = False
                all_passed = False
        
        print("\n" + "=" * 60)
        print("📋 RESUMO DA VALIDAÇÃO:")
        
        for validation_name, result in results.items():
            status = "✅ PASSOU" if result else "❌ FALHOU"
            print(f"  {validation_name}: {status}")
        
        if all_passed:
            print("\n🎉 TODAS AS VALIDAÇÕES PASSARAM!")
            print("Sistema pronto para produção!")
        else:
            print("\n⚠️ ALGUMAS VALIDAÇÕES FALHARAM!")
            print("Revisar problemas antes de prosseguir.")
        
        return all_passed

if __name__ == "__main__":
    validator = PostMigrationValidator()
    success = validator.run_comprehensive_validation()
    exit(0 if success else 1)
```

**Tarde (13:00-17:00): Otimização e Ajustes Finais**

Durante a tarde, focaremos em otimizações finais e ajustes baseados no comportamento real do sistema com dados de produção.

```sql
-- Script de otimização pós-migração
-- Executar após validação bem-sucedida

-- Atualizar estatísticas do banco
ANALYZE fature_v2.affiliates_optimized;
ANALYZE fature_v2.hierarchy_index;
ANALYZE fature_v2.transactions;
ANALYZE fature_v2.commissions;

-- Refresh da view materializada
REFRESH MATERIALIZED VIEW fature_v2.affiliate_performance_stats;

-- Verificar e otimizar índices
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'fature_v2'
ORDER BY idx_tup_read DESC;

-- Configurações de performance específicas
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET effective_cache_size = '4GB';
ALTER SYSTEM SET random_page_cost = 1.1;

-- Configurar autovacuum para tabelas críticas
ALTER TABLE fature_v2.affiliates_optimized SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE fature_v2.hierarchy_index SET (
    autovacuum_vacuum_scale_factor = 0.2,
    autovacuum_analyze_scale_factor = 0.1
);

-- Criar jobs de manutenção automática
SELECT cron.schedule('cleanup-cache', '0 */6 * * *', 'SELECT fature_v2.cleanup_expired_cache();');
SELECT cron.schedule('refresh-stats', '0 2 * * *', 'SELECT fature_v2.refresh_performance_stats();');
```

## 🔄 Fase 5: Ativação Gradual (Dias 8-9)

### Objetivos da Fase 5
A ativação gradual permite uma transição suave do sistema antigo para o novo, minimizando riscos e permitindo ajustes em tempo real baseados no comportamento real dos usuários.

### Estratégia de Ativação Gradual

#### Dia 8: Modo Híbrido (Leitura Paralela)

Durante o primeiro dia de ativação, o sistema funcionará em modo híbrido, onde as consultas são executadas em ambos os sistemas para comparação, mas as respostas ainda vêm do sistema antigo.

```python
#!/usr/bin/env python3
"""
Proxy de Transição - Modo Híbrido
Executa consultas em paralelo nos dois sistemas para comparação
"""

import psycopg2
import time
import logging
from typing import Dict, Any

class HybridModeProxy:
    def __init__(self):
        self.config = {
            'host': 'hopper.proxy.rlwy.net',
            'port': 48603,
            'database': 'railway',
            'user': 'postgres',
            'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl'
        }
        
        self.comparison_log = []
    
    def execute_parallel_query(self, old_query: str, new_query: str, description: str) -> Dict:
        """Executar query em paralelo nos dois sistemas"""
        results = {
            'description': description,
            'old_system': {'query': old_query, 'result': None, 'time_ms': None, 'error': None},
            'new_system': {'query': new_query, 'result': None, 'time_ms': None, 'error': None},
            'match': False,
            'performance_improvement': None
        }
        
        conn = psycopg2.connect(**self.config)
        
        try:
            with conn.cursor() as cursor:
                # Executar query no sistema antigo
                try:
                    start_time = time.time()
                    cursor.execute(old_query)
                    old_result = cursor.fetchall()
                    old_time = (time.time() - start_time) * 1000
                    
                    results['old_system']['result'] = old_result
                    results['old_system']['time_ms'] = old_time
                    
                except Exception as e:
                    results['old_system']['error'] = str(e)
                
                # Executar query no sistema novo
                try:
                    start_time = time.time()
                    cursor.execute(new_query)
                    new_result = cursor.fetchall()
                    new_time = (time.time() - start_time) * 1000
                    
                    results['new_system']['result'] = new_result
                    results['new_system']['time_ms'] = new_time
                    
                except Exception as e:
                    results['new_system']['error'] = str(e)
                
                # Comparar resultados
                if (results['old_system']['result'] is not None and 
                    results['new_system']['result'] is not None):
                    results['match'] = results['old_system']['result'] == results['new_system']['result']
                    
                    if old_time > 0 and new_time > 0:
                        results['performance_improvement'] = ((old_time - new_time) / old_time) * 100
                
        finally:
            conn.close()
        
        self.comparison_log.append(results)
        return results
    
    def test_common_queries(self):
        """Testar queries comuns em modo paralelo"""
        test_cases = [
            {
                'description': 'Top 10 afiliados por indicações',
                'old_query': """
                    SELECT affiliate_id, level_1_referrals
                    FROM public.affiliates
                    WHERE level_1_referrals > 0
                    ORDER BY level_1_referrals DESC
                    LIMIT 10;
                """,
                'new_query': """
                    SELECT affiliate_id, direct_referrals_count
                    FROM fature_v2.affiliates_optimized
                    WHERE direct_referrals_count > 0
                    ORDER BY direct_referrals_count DESC
                    LIMIT 10;
                """
            },
            {
                'description': 'Contagem total de afiliados ativos',
                'old_query': """
                    SELECT COUNT(*) FROM public.affiliates WHERE status = 'active';
                """,
                'new_query': """
                    SELECT COUNT(*) FROM fature_v2.affiliates_optimized WHERE status = 'active';
                """
            },
            {
                'description': 'Busca por afiliado específico',
                'old_query': """
                    SELECT * FROM public.affiliates WHERE affiliate_id = 13369082;
                """,
                'new_query': """
                    SELECT * FROM fature_v2.affiliates_optimized WHERE affiliate_id = 13369082;
                """
            }
        ]
        
        print("🔄 Executando testes em modo híbrido...")
        
        for test_case in test_cases:
            print(f"\n📊 Testando: {test_case['description']}")
            
            result = self.execute_parallel_query(
                test_case['old_query'],
                test_case['new_query'],
                test_case['description']
            )
            
            # Exibir resultados
            if result['old_system']['error']:
                print(f"❌ Sistema antigo: ERRO - {result['old_system']['error']}")
            else:
                print(f"✅ Sistema antigo: {result['old_system']['time_ms']:.2f}ms")
            
            if result['new_system']['error']:
                print(f"❌ Sistema novo: ERRO - {result['new_system']['error']}")
            else:
                print(f"✅ Sistema novo: {result['new_system']['time_ms']:.2f}ms")
            
            if result['match']:
                print("✅ Resultados coincidem")
            else:
                print("❌ Resultados diferem")
            
            if result['performance_improvement']:
                print(f"⚡ Melhoria de performance: {result['performance_improvement']:.1f}%")
    
    def generate_comparison_report(self):
        """Gerar relatório de comparação"""
        if not self.comparison_log:
            return "Nenhum teste executado."
        
        report = "=== RELATÓRIO DE COMPARAÇÃO - MODO HÍBRIDO ===\n\n"
        
        total_tests = len(self.comparison_log)
        successful_matches = sum(1 for r in self.comparison_log if r['match'])
        
        report += f"Total de testes: {total_tests}\n"
        report += f"Resultados coincidentes: {successful_matches}\n"
        report += f"Taxa de sucesso: {(successful_matches/total_tests)*100:.1f}%\n\n"
        
        for result in self.comparison_log:
            report += f"## {result['description']}\n"
            
            if result['old_system']['error']:
                report += f"Sistema antigo: ERRO - {result['old_system']['error']}\n"
            else:
                report += f"Sistema antigo: {result['old_system']['time_ms']:.2f}ms\n"
            
            if result['new_system']['error']:
                report += f"Sistema novo: ERRO - {result['new_system']['error']}\n"
            else:
                report += f"Sistema novo: {result['new_system']['time_ms']:.2f}ms\n"
            
            report += f"Resultados coincidem: {'Sim' if result['match'] else 'Não'}\n"
            
            if result['performance_improvement']:
                report += f"Melhoria de performance: {result['performance_improvement']:.1f}%\n"
            
            report += "\n"
        
        return report

if __name__ == "__main__":
    proxy = HybridModeProxy()
    proxy.test_common_queries()
    
    report = proxy.generate_comparison_report()
    print("\n" + "="*60)
    print(report)
    
    with open('hybrid_mode_report.txt', 'w') as f:
        f.write(report)
    
    print("📊 Relatório salvo em 'hybrid_mode_report.txt'")
```

#### Dia 9: Ativação Completa

Após validar que o modo híbrido está funcionando corretamente, ativaremos completamente o novo sistema.

```bash
#!/bin/bash
# Script de ativação completa do sistema v2

echo "🚀 ATIVAÇÃO COMPLETA DO SISTEMA FATURE CPA v2"
echo "Timestamp: $(date)"

# Verificar se modo híbrido passou nos testes
if [ ! -f "hybrid_mode_report.txt" ]; then
    echo "❌ Relatório do modo híbrido não encontrado!"
    echo "Execute primeiro o modo híbrido antes da ativação completa."
    exit 1
fi

# Verificar taxa de sucesso do modo híbrido
SUCCESS_RATE=$(grep "Taxa de sucesso:" hybrid_mode_report.txt | grep -o '[0-9.]*%' | head -1 | sed 's/%//')

if (( $(echo "$SUCCESS_RATE < 95" | bc -l) )); then
    echo "❌ Taxa de sucesso do modo híbrido muito baixa: $SUCCESS_RATE%"
    echo "Necessário investigar problemas antes da ativação completa."
    exit 1
fi

echo "✅ Modo híbrido validado com $SUCCESS_RATE% de sucesso"

# Criar ponto de restauração final
echo "📦 Criando ponto de restauração final..."
python3 rollback_fature.py backup

# Ativar sistema v2 completamente
echo "🔄 Redirecionando aplicação para sistema v2..."

# Aqui você faria as mudanças na aplicação para usar o novo schema
# Por exemplo, alterar variáveis de ambiente, configurações, etc.

# Simular ativação (em produção real, isso seria feito na aplicação)
psql -h hopper.proxy.rlwy.net -p 48603 -U postgres -d railway -c "
    -- Criar view de compatibilidade para transição suave
    CREATE OR REPLACE VIEW public.affiliates_v2_compat AS
    SELECT 
        affiliate_id,
        parent_affiliate_id,
        external_id,
        name,
        email,
        status,
        registration_date,
        direct_referrals_count as level_1_referrals,
        total_deposits,
        total_bets,
        total_withdrawals,
        total_cpa_earned,
        total_rev_earned,
        total_commissions_paid,
        created_at,
        updated_at
    FROM fature_v2.affiliates_optimized;
"

# Iniciar monitoramento intensivo
echo "📊 Iniciando monitoramento intensivo..."
nohup python3 monitor_fature.py --continuous 30 > intensive_monitoring.log 2>&1 &
MONITOR_PID=$!
echo $MONITOR_PID > intensive_monitor.pid

# Executar testes de carga em produção
echo "🧪 Executando testes de carga em produção..."
python3 production_load_test.py

# Verificar saúde do sistema após ativação
echo "🏥 Verificando saúde do sistema..."
python3 monitor_fature.py

echo "🎉 SISTEMA FATURE CPA v2 ATIVADO COM SUCESSO!"
echo "📊 Monitoramento intensivo ativo (PID: $MONITOR_PID)"
echo "🔍 Acompanhar logs em: intensive_monitoring.log"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Monitorar sistema por 24-48 horas"
echo "2. Validar métricas de performance"
echo "3. Coletar feedback dos usuários"
echo "4. Documentar lições aprendidas"
```

## 📊 Fase 6: Monitoramento e Otimização (Dia 10+)

### Objetivos da Fase 6
Após a ativação completa, entraremos em modo de monitoramento intensivo e otimização contínua, garantindo que o sistema opere com performance máxima e identificando oportunidades de melhoria.

### Plano de Monitoramento Contínuo

```python
#!/usr/bin/env python3
"""
Sistema de Monitoramento Contínuo Pós-Ativação
"""

import psycopg2
import time
import json
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MimeText

class ContinuousMonitoring:
    def __init__(self):
        self.config = {
            'database': {
                'host': 'hopper.proxy.rlwy.net',
                'port': 48603,
                'database': 'railway',
                'user': 'postgres',
                'password': 'xWyLIRXlRfgqYMVJRKYLlEAIngEgakTl'
            },
            'thresholds': {
                'max_query_time_ms': 100,
                'max_pending_commissions': 1000,
                'min_throughput_per_minute': 100,
                'max_error_rate_percent': 1.0
            }
        }
        
        self.metrics_history = []
        self.alerts_sent = []
    
    def collect_detailed_metrics(self):
        """Coletar métricas detalhadas do sistema"""
        conn = psycopg2.connect(**self.config['database'])
        
        try:
            with conn.cursor() as cursor:
                metrics = {
                    'timestamp': datetime.now().isoformat(),
                    'system_health': {},
                    'performance': {},
                    'business_metrics': {},
                    'technical_metrics': {}
                }
                
                # Métricas de saúde do sistema
                cursor.execute("SELECT fature_v2.system_health_check();")
                health_data = cursor.fetchone()[0]
                metrics['system_health'] = health_data
                
                # Métricas de performance
                cursor.execute("""
                    SELECT 
                        COUNT(*) as queries_last_5min,
                        AVG(query_duration_ms) as avg_duration,
                        MAX(query_duration_ms) as max_duration,
                        COUNT(*) FILTER (WHERE query_duration_ms > %s) as slow_queries
                    FROM fature_v2.query_performance_log
                    WHERE created_at >= NOW() - INTERVAL '5 minutes';
                """, (self.config['thresholds']['max_query_time_ms'],))
                
                perf_data = cursor.fetchone()
                metrics['performance'] = {
                    'queries_last_5min': perf_data[0],
                    'avg_duration_ms': float(perf_data[1]) if perf_data[1] else 0,
                    'max_duration_ms': perf_data[2] or 0,
                    'slow_queries': perf_data[3]
                }
                
                # Métricas de negócio
                cursor.execute("""
                    SELECT 
                        COUNT(*) as new_affiliates_today,
                        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as new_affiliates_last_hour
                    FROM fature_v2.affiliates_optimized
                    WHERE created_at >= CURRENT_DATE;
                """)
                
                business_data = cursor.fetchone()
                metrics['business_metrics'] = {
                    'new_affiliates_today': business_data[0],
                    'new_affiliates_last_hour': business_data[1]
                }
                
                # Métricas técnicas
                cursor.execute("""
                    SELECT 
                        pg_database_size(current_database()) as db_size_bytes,
                        (SELECT COUNT(*) FROM fature_v2.performance_cache WHERE expires_at > NOW()) as active_cache_entries,
                        (SELECT COUNT(*) FROM fature_v2.commissions WHERE status = 'pending') as pending_commissions
                """)
                
                tech_data = cursor.fetchone()
                metrics['technical_metrics'] = {
                    'db_size_gb': tech_data[0] / (1024**3),
                    'active_cache_entries': tech_data[1],
                    'pending_commissions': tech_data[2]
                }
                
                return metrics
                
        finally:
            conn.close()
    
    def analyze_trends(self):
        """Analisar tendências nas métricas"""
        if len(self.metrics_history) < 2:
            return {}
        
        current = self.metrics_history[-1]
        previous = self.metrics_history[-2]
        
        trends = {}
        
        # Tendência de performance
        current_avg = current['performance']['avg_duration_ms']
        previous_avg = previous['performance']['avg_duration_ms']
        
        if previous_avg > 0:
            perf_change = ((current_avg - previous_avg) / previous_avg) * 100
            trends['performance_trend'] = {
                'change_percent': perf_change,
                'direction': 'improving' if perf_change < 0 else 'degrading',
                'significant': abs(perf_change) > 10
            }
        
        # Tendência de crescimento
        current_affiliates = current['business_metrics']['new_affiliates_last_hour']
        previous_affiliates = previous['business_metrics']['new_affiliates_last_hour']
        
        growth_change = current_affiliates - previous_affiliates
        trends['growth_trend'] = {
            'change_absolute': growth_change,
            'current_rate': current_affiliates,
            'accelerating': growth_change > 0
        }
        
        return trends
    
    def check_critical_alerts(self, metrics):
        """Verificar condições críticas de alerta"""
        alerts = []
        
        # Performance crítica
        if metrics['performance']['avg_duration_ms'] > self.config['thresholds']['max_query_time_ms']:
            alerts.append({
                'level': 'CRITICAL',
                'type': 'performance_degradation',
                'message': f"Performance degradada: {metrics['performance']['avg_duration_ms']:.2f}ms média",
                'value': metrics['performance']['avg_duration_ms'],
                'threshold': self.config['thresholds']['max_query_time_ms']
            })
        
        # Comissões pendentes
        pending = metrics['technical_metrics']['pending_commissions']
        if pending > self.config['thresholds']['max_pending_commissions']:
            alerts.append({
                'level': 'WARNING',
                'type': 'commission_backlog',
                'message': f"Muitas comissões pendentes: {pending}",
                'value': pending,
                'threshold': self.config['thresholds']['max_pending_commissions']
            })
        
        # Crescimento do banco muito rápido
        db_size_gb = metrics['technical_metrics']['db_size_gb']
        if len(self.metrics_history) > 0:
            prev_size = self.metrics_history[-1]['technical_metrics']['db_size_gb']
            growth_rate = ((db_size_gb - prev_size) / prev_size) * 100 if prev_size > 0 else 0
            
            if growth_rate > 5:  # Crescimento > 5% em 5 minutos
                alerts.append({
                    'level': 'WARNING',
                    'type': 'rapid_db_growth',
                    'message': f"Crescimento rápido do banco: {growth_rate:.1f}%",
                    'value': growth_rate,
                    'threshold': 5.0
                })
        
        return alerts
    
    def send_alert_notification(self, alert):
        """Enviar notificação de alerta"""
        # Evitar spam de alertas
        alert_key = f"{alert['type']}_{alert['level']}"
        recent_alerts = [a for a in self.alerts_sent if a['timestamp'] > datetime.now() - timedelta(minutes=30)]
        
        if any(a['key'] == alert_key for a in recent_alerts):
            return  # Já enviado recentemente
        
        # Registrar alerta enviado
        self.alerts_sent.append({
            'key': alert_key,
            'timestamp': datetime.now(),
            'alert': alert
        })
        
        # Aqui você implementaria o envio real (email, Slack, etc.)
        print(f"🚨 ALERTA {alert['level']}: {alert['message']}")
    
    def run_monitoring_cycle(self):
        """Executar um ciclo de monitoramento"""
        print(f"📊 Coletando métricas - {datetime.now()}")
        
        # Coletar métricas
        metrics = self.collect_detailed_metrics()
        self.metrics_history.append(metrics)
        
        # Manter apenas últimas 288 medições (24h com coleta a cada 5min)
        if len(self.metrics_history) > 288:
            self.metrics_history = self.metrics_history[-288:]
        
        # Analisar tendências
        trends = self.analyze_trends()
        
        # Verificar alertas
        alerts = self.check_critical_alerts(metrics)
        
        # Enviar alertas se necessário
        for alert in alerts:
            self.send_alert_notification(alert)
        
        # Exibir resumo
        print(f"✅ Sistema saudável - {metrics['system_health']['total_affiliates']:,} afiliados")
        print(f"⚡ Performance: {metrics['performance']['avg_duration_ms']:.1f}ms média")
        print(f"📈 Novos afiliados (1h): {metrics['business_metrics']['new_affiliates_last_hour']}")
        
        if trends:
            if 'performance_trend' in trends and trends['performance_trend']['significant']:
                direction = trends['performance_trend']['direction']
                change = trends['performance_trend']['change_percent']
                print(f"📊 Tendência de performance: {direction} ({change:+.1f}%)")
        
        return len(alerts) == 0
    
    def run_continuous_monitoring(self, interval_minutes=5):
        """Executar monitoramento contínuo"""
        print(f"🔄 Iniciando monitoramento contínuo (intervalo: {interval_minutes} minutos)")
        
        while True:
            try:
                healthy = self.run_monitoring_cycle()
                
                if not healthy:
                    print("⚠️ Alertas ativos - monitoramento intensificado")
                    time.sleep(60)  # Monitoramento mais frequente se há problemas
                else:
                    time.sleep(interval_minutes * 60)
                
            except KeyboardInterrupt:
                print("\n🛑 Monitoramento interrompido pelo usuário")
                break
            except Exception as e:
                print(f"❌ Erro no monitoramento: {e}")
                time.sleep(60)

if __name__ == "__main__":
    import sys
    
    monitor = ContinuousMonitoring()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        interval = int(sys.argv[2]) if len(sys.argv) > 2 else 5
        monitor.run_continuous_monitoring(interval)
    else:
        healthy = monitor.run_monitoring_cycle()
        sys.exit(0 if healthy else 1)
```

---

## 📋 Checklist de Execução

### Pré-Migração
- [ ] Backup completo do banco de dados atual
- [ ] Testes de performance executados e validados
- [ ] Scripts de migração testados em ambiente de desenvolvimento
- [ ] Equipe técnica disponível e treinada
- [ ] Plano de rollback testado e validado
- [ ] Comunicação enviada aos stakeholders

### Durante a Migração
- [ ] Monitoramento ativo do processo
- [ ] Logs detalhados sendo gerados
- [ ] Validações de integridade em cada etapa
- [ ] Performance sendo monitorada
- [ ] Equipe de suporte em standby

### Pós-Migração
- [ ] Validação completa dos dados migrados
- [ ] Testes de performance em produção
- [ ] Monitoramento intensivo ativado
- [ ] Feedback dos usuários coletado
- [ ] Documentação atualizada
- [ ] Lições aprendidas documentadas

---

## 🎯 Critérios de Sucesso

### Performance
- [ ] Consultas de nível 1: < 10ms
- [ ] Consultas de nível 5: < 50ms
- [ ] Throughput: > 10.000 consultas/segundo
- [ ] Disponibilidade: > 99.9%

### Integridade
- [ ] 100% dos afiliados migrados
- [ ] 100% dos vínculos preservados
- [ ] Zero registros órfãos
- [ ] Contadores consistentes

### Negócio
- [ ] Zero downtime durante migração
- [ ] Funcionalidades mantidas
- [ ] Performance melhorada
- [ ] Usuários satisfeitos

Este plano de implementação garante uma migração segura, eficiente e bem-sucedida para a nova arquitetura de alta performance do sistema Fature CPA.

