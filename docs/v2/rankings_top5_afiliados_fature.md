# Rankings Top 5 Afiliados por Nível - Sistema Fature

## Análise da Estrutura Atual

Com base na análise dos documentos do sistema Fature, identifiquei o seguinte status dos níveis de indicação:

- **Nível 1**: ✅ **DADOS CALCULADOS E DISPONÍVEIS**
- **Níveis 2-5**: ⚠️ **ESTRUTURA PREPARADA, CÁLCULOS PENDENTES**

---

## 🏆 RANKING NÍVEL 1 - TOP 5 AFILIADOS

**Status**: ✅ Dados calculados e validados
**Total de afiliados com indicações nível 1**: 48.264
**Total de indicações nível 1**: 510.963

### Top 5 Afiliados com Mais Indicações Nível 1:

| Posição | Affiliate ID | Indicações Nível 1 | Parent ID | Status |
|---------|-------------|-------------------|-----------|---------|
| 🥇 **1º** | **13.369.082** | **14.289** | None | Líder absoluto |
| 🥈 **2º** | **13.887.998** | **9.120** | 14.010.084 | Super performer |
| 🥉 **3º** | **13.809.817** | **8.837** | 14.900.364 | Elite |
| **4º** | **14.904.800** | **8.648** | None | Top tier |
| **5º** | **14.452.454** | **8.011** | None | Excelente |

### Estatísticas do Top 5 Nível 1:
- **Total de indicações**: 48.905 (9,6% do total)
- **Média de indicações**: 9.781 por afiliado
- **Afiliados raiz**: 4 de 5 (80%)
- **Maior performer**: 13.369.082 com 14.289 indicações

---

## ⚠️ RANKING NÍVEL 2 - ESTRUTURA PREPARADA

**Status**: ⚠️ Cálculos não executados ainda
**Campo**: `level_2_referrals` (532.363 registros preparados)
**Estimativa**: ~1.200.000 vínculos potenciais

### Situação Atual:
```
❌ Dados não calculados
✅ Estrutura de banco preparada
✅ Algoritmo de cálculo disponível
⏱️ Tempo estimado de cálculo: ~8 minutos
```

### Para Obter o Ranking Nível 2:
É necessário executar o algoritmo de cálculo recursivo:

```sql
WITH nivel_2 AS (
    SELECT 
        a1.affiliate_id,
        COUNT(a3.affiliate_id) as level_2_count
    FROM affiliates a1
    INNER JOIN affiliates a2 ON a1.affiliate_id = a2.parent_affiliate_id
    INNER JOIN affiliates a3 ON a2.affiliate_id = a3.parent_affiliate_id
    GROUP BY a1.affiliate_id
)
UPDATE affiliates 
SET level_2_referrals = nivel_2.level_2_count
FROM nivel_2
WHERE affiliates.affiliate_id = nivel_2.affiliate_id;
```

---

## ⚠️ RANKING NÍVEL 3 - ESTRUTURA PREPARADA

**Status**: ⚠️ Cálculos não executados ainda
**Campo**: `level_3_referrals` (532.363 registros preparados)
**Estimativa**: ~2.800.000 vínculos potenciais

### Situação Atual:
```
❌ Dados não calculados
✅ Estrutura de banco preparada
✅ Algoritmo de cálculo disponível
⏱️ Tempo estimado de cálculo: ~18 minutos
```

### Para Obter o Ranking Nível 3:
É necessário executar cálculo recursivo de 3 níveis de profundidade.

---

## ⚠️ RANKING NÍVEL 4 - ESTRUTURA PREPARADA

**Status**: ⚠️ Cálculos não executados ainda
**Campo**: `level_4_referrals` (532.363 registros preparados)
**Estimativa**: ~5.600.000 vínculos potenciais

### Situação Atual:
```
❌ Dados não calculados
✅ Estrutura de banco preparada
✅ Algoritmo de cálculo disponível
⏱️ Tempo estimado de cálculo: ~35 minutos
```

### Para Obter o Ranking Nível 4:
É necessário executar cálculo recursivo de 4 níveis de profundidade.

---

## ⚠️ RANKING NÍVEL 5 - ESTRUTURA PREPARADA

**Status**: ⚠️ Cálculos não executados ainda
**Campo**: `level_5_referrals` (532.363 registros preparados)
**Estimativa**: ~11.200.000 vínculos potenciais

### Situação Atual:
```
❌ Dados não calculados
✅ Estrutura de banco preparada
✅ Algoritmo de cálculo disponível
⏱️ Tempo estimado de cálculo: ~70 minutos
```

### Para Obter o Ranking Nível 5:
É necessário executar cálculo recursivo de 5 níveis de profundidade.

---

## 📊 RESUMO GERAL DOS RANKINGS

### Status Atual:
| Nível | Status | Dados Disponíveis | Ação Necessária |
|-------|--------|------------------|-----------------|
| **Nível 1** | ✅ **ATIVO** | Top 5 disponível | Nenhuma |
| **Nível 2** | ⚠️ **PREPARADO** | Estrutura pronta | Executar cálculo |
| **Nível 3** | ⚠️ **PREPARADO** | Estrutura pronta | Executar cálculo |
| **Nível 4** | ⚠️ **PREPARADO** | Estrutura pronta | Executar cálculo |
| **Nível 5** | ⚠️ **PREPARADO** | Estrutura pronta | Executar cálculo |

### Capacidade do Sistema:
- **Performance validada**: 2.612 cálculos/segundo
- **Escalabilidade**: Suporta até 1M de afiliados por nível
- **Tempo total estimado**: ~2,5 horas para calcular todos os níveis

---

## 🚀 PRÓXIMOS PASSOS PARA OBTER TODOS OS RANKINGS

### Para Executar os Cálculos dos Níveis 2-5:

1. **Conectar ao banco Fature**:
   ```
   Host: hopper.proxy.rlwy.net:48603
   Database: railway
   ```

2. **Executar scripts de cálculo** na seguinte ordem:
   - Nível 2 (8 min)
   - Nível 3 (18 min)
   - Nível 4 (35 min)
   - Nível 5 (70 min)

3. **Consultar rankings** após cálculos:
   ```sql
   SELECT affiliate_id, level_X_referrals
   FROM affiliates 
   WHERE level_X_referrals > 0
   ORDER BY level_X_referrals DESC
   LIMIT 5;
   ```

### Benefícios dos Rankings Completos:
- **Identificação de super afiliados** em todos os níveis
- **Otimização de comissões** por performance
- **Análise de rede** de indicações
- **Estratégias de retenção** direcionadas

