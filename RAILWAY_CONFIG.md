# Configuração de Variáveis de Ambiente - Railway

## 🚀 Configuração Automática via railway.json

Este projeto inclui um arquivo `railway.json` que configura automaticamente as variáveis de ambiente necessárias.

### 📋 Variáveis Configuradas Automaticamente:

#### **Aplicação:**
- `NODE_ENV=production`
- `PORT=3000`
- `LOG_LEVEL=info`

#### **Banco da Operação (Externo):**
- `EXTERNAL_DB_HOST=177.115.223.216`
- `EXTERNAL_DB_PORT=5999`
- `EXTERNAL_DB_NAME=dados_interno`
- `EXTERNAL_DB_USER=userschapz`
- `EXTERNAL_DB_PASSWORD=mschaphz8881!`
- `EXTERNAL_DB_SSL=false`

#### **Configurações MLM:**
- `MLM_MAX_LEVELS=5`
- `SYNC_INTERVAL_MINUTES=30`
- `BATCH_SIZE=1000`
- `MAX_RETRIES=3`
- `COMMISSION_RATES={"1": 0.05, "2": 0.03, "3": 0.02, "4": 0.01, "5": 0.005}`
- `CACHE_TTL_HOURS=24`

### ⚠️ Variável Manual Necessária:

Você precisa configurar manualmente apenas **UMA** variável no Railway Dashboard:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### 🔧 Como Configurar:

1. **Acesse o Railway Dashboard do microserviço de afiliados**
2. **Vá na aba "Variables"**
3. **Adicione a variável:**
   - **Nome:** `DATABASE_URL`
   - **Valor:** `${{Postgres.DATABASE_URL}}`

4. **Conecte o banco Fature:**
   - Clique em "Connect" 
   - Selecione o serviço "Banco de dados Fature"
   - Isso criará automaticamente a referência `${{Postgres.DATABASE_URL}}`

### ✅ Resultado:

Após o próximo deploy, o microserviço terá:
- ✅ Conexão com banco da operação (dados fonte)
- ✅ Conexão com banco Fature (dados processados)
- ✅ Todas as configurações MLM
- ✅ Agendamentos automáticos funcionando

### 🚀 Deploy:

O deploy acontecerá automaticamente após o commit, e todas as variáveis serão aplicadas conforme o `railway.json`.

