# 16 Campos com Dados Ativos do Banco Fature

## Tabela: `affiliates` - Database: railway

**Total de registros na tabela**: 532.363

### Os 16 Campos com Informações Ativas:

1. **Campo `affiliate_id` da tabela `affiliates` do banco fature contém 532.363 registros**
   - Tipo: bigint
   - Status: 100% populado
   - Descrição: Chave primária - IDs preservados da operação original

2. **Campo `parent_affiliate_id` da tabela `affiliates` do banco fature contém 510.963 registros**
   - Tipo: bigint
   - Status: 96% populado (21.400 registros são afiliados raiz sem parent)
   - Descrição: ID do afiliado indicador

3. **Campo `external_id` da tabela `affiliates` do banco fature contém 532.363 registros**
   - Tipo: varchar
   - Status: 100% populado
   - Descrição: Formato "user_XXXXX" para referência externa

4. **Campo `name` da tabela `affiliates` do banco fature contém 532.363 registros**
   - Tipo: varchar
   - Status: 100% populado
   - Descrição: Formato "Afiliado_XXXXX"

5. **Campo `status` da tabela `affiliates` do banco fature contém 532.363 registros**
   - Tipo: varchar
   - Status: 100% populado
   - Descrição: Todos definidos como "active"

6. **Campo `registration_date` da tabela `affiliates` do banco fature contém 532.363 registros**
   - Tipo: timestamp
   - Status: 100% populado
   - Descrição: Datas originais preservadas (período: 2021-2025)

7. **Campo `level_1_referrals` da tabela `affiliates` do banco fature contém 532.363 registros**
   - Tipo: integer
   - Status: 100% populado (48.264 registros com valor >0)
   - Descrição: Indicações diretas - 9,1% dos afiliados possuem indicações ativas

8. **Campo `level_2_referrals` da tabela `affiliates` do banco fature contém 532.363 registros**
   - Tipo: integer
   - Status: 100% populado (estrutura preparada)
   - Descrição: Estrutura pronta para cálculo de indicações nível 2

9. **Campo `level_3_referrals` da tabela `affiliates` do banco fature contém 532.363 registros**
   - Tipo: integer
   - Status: 100% populado (estrutura preparada)
   - Descrição: Estrutura pronta para cálculo de indicações nível 3

10. **Campo `level_4_referrals` da tabela `affiliates` do banco fature contém 532.363 registros**
    - Tipo: integer
    - Status: 100% populado (estrutura preparada)
    - Descrição: Estrutura pronta para cálculo de indicações nível 4

11. **Campo `level_5_referrals` da tabela `affiliates` do banco fature contém 532.363 registros**
    - Tipo: integer
    - Status: 100% populado (estrutura preparada)
    - Descrição: Estrutura pronta para cálculo de indicações nível 5

12. **Campo `total_referrals` da tabela `affiliates` do banco fature contém 532.363 registros**
    - Tipo: integer
    - Status: 100% populado
    - Descrição: Total de indicações por afiliado

13. **Campo `total_referrals_calculated` da tabela `affiliates` do banco fature contém 532.363 registros**
    - Tipo: integer
    - Status: 100% populado
    - Descrição: Valor calculado e verificado

14. **Campo `created_at` da tabela `affiliates` do banco fature contém 532.363 registros**
    - Tipo: timestamp
    - Status: 100% populado
    - Descrição: Data de migração

15. **Campo `updated_at` da tabela `affiliates` do banco fature contém 532.363 registros**
    - Tipo: timestamp
    - Status: 100% populado
    - Descrição: Última atualização

16. **Campo `id` da tabela `affiliates` do banco fature contém 532.363 registros**
    - Tipo: bigint
    - Status: 100% populado
    - Descrição: Coluna gerada = affiliate_id

---

## Resumo dos 16 Campos Ativos:

- **Total de registros em todos os campos**: 532.363
- **Campos 100% populados**: 15 campos
- **Campos com 96% de população**: 1 campo (`parent_affiliate_id`)
- **Campo com dados de indicação ativa**: `level_1_referrals` (48.264 registros com valor >0)
- **Total de vínculos de indicação**: 510.963

## Estatísticas Importantes:

- **Afiliados com indicações próprias**: 48.264 (9,1% do total)
- **Afiliados sem indicações**: 484.099 (90,9% do total)
- **Afiliados raiz (sem parent)**: 21.400 (4,0% do total)
- **Afiliados com parent definido**: 510.963 (96,0% do total)

