# Database Schema - Affiliate Service

## Estrutura Robusta Implementada

Este diretório contém os scripts de migração para a estrutura robusta do banco de dados do Affiliate Service.

### Migração 001 - Estrutura Principal

**Arquivo:** `001_create_affiliate_tables.sql`  
**Data:** 24 de junho de 2025  
**Status:** ✅ Aplicada em produção  

#### Tabelas Criadas:

1. **`affiliates`** - Tabela principal de afiliados
   - Dados cadastrais e métricas agregadas
   - Colunas de compatibilidade: `id`, `total_clients`, `total_commission`

2. **`affiliate_mlm_structure`** - Estrutura MLM pré-calculada
   - Totais por nível (1-5)
   - Valores financeiros e CPA por nível

3. **`affiliate_referrals`** - Indicações detalhadas
   - Relacionamentos e status de validação
   - Dados financeiros acumulados

4. **`affiliate_financial_transactions`** - Transações financeiras
   - Histórico completo de transações
   - Suporte a múltiplos tipos

5. **`affiliate_cpa_validations`** - Validações CPA
   - Critérios e valores calculados
   - Status de pagamento

6. **`affiliate_periodic_summaries`** - Resumos periódicos
   - Relatórios por período
   - Breakdown por nível MLM

7. **`affiliate_cache_metadata`** - Controle de cache
   - Metadados de atualização
   - Frequência de cache

#### Views Criadas:

- **`v_affiliate_dashboard`** - Dashboard principal
- **`v_affiliate_ranking`** - Ranking de afiliados

#### Recursos:

- ✅ 16 índices otimizados para performance
- ✅ Triggers automáticos para updated_at
- ✅ Chaves estrangeiras para integridade
- ✅ Comentários para documentação

## Como Aplicar

```bash
# Conectar ao banco PostgreSQL
psql -h hopper.proxy.rlwy.net -p 48603 -U postgres -d railway

# Aplicar migração
\i database/migrations/001_create_affiliate_tables.sql
```

## Status das APIs

Após aplicação da migração:

- ✅ **GET /api/v1/affiliates** - Funcionando
- ✅ **Health Check** - Banco conectado
- ✅ **Views** - Dashboard e Ranking disponíveis

## Próximos Passos

1. Migração de dados do sistema antigo
2. Implementação de endpoints para views
3. Testes de carga com dados reais
4. Otimizações baseadas em uso

