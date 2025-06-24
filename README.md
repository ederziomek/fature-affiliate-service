# 🏢 Fature Affiliate Service

Microserviço de Afiliados com Banco Robusto - Sistema Fature CPA

## 📋 Descrição

O **Fature Affiliate Service** é o componente central da nova arquitetura do sistema Fature CPA, projetado para eliminar processamento em tempo real através de dados pré-agregados e otimizar consultas de afiliados e MLM.

### 🎯 Objetivos Principais

- **Eliminar processamento desnecessário** através de dados pré-agregados
- **Otimizar performance** das consultas de afiliados e MLM (10-50x mais rápidas)
- **Centralizar informações** de afiliados em estrutura dedicada
- **Facilitar desenvolvimento** de novas funcionalidades
- **Reduzir carga** no banco da operação em 90%

## 🏗️ Arquitetura

### Banco de Dados Robusto

O serviço utiliza um banco PostgreSQL dedicado com estrutura otimizada:

#### Tabelas Principais:
- **`affiliates`** - Dados cadastrais e métricas agregadas
- **`affiliate_mlm_structure`** - Estrutura MLM pré-calculada por nível
- **`affiliate_referrals`** - Registro completo de indicações
- **`affiliate_financial_transactions`** - Transações financeiras detalhadas
- **`affiliate_cpa_validations`** - Histórico de validações CPA
- **`affiliate_periodic_summaries`** - Resumos periódicos para relatórios
- **`affiliate_cache_metadata`** - Controle de cache e atualizações

#### Views Otimizadas:
- **`v_affiliate_dashboard`** - Dashboard principal (consulta mais frequente)
- **`v_affiliate_ranking`** - Ranking de performance

## 🚀 API Endpoints

### Autenticação
Todas as rotas da API requerem autenticação via header `X-API-Key`.

### Endpoints Principais

#### Afiliados
- `GET /api/v1/affiliates` - Listar afiliados com paginação
- `GET /api/v1/affiliates/:id` - Obter dados de um afiliado específico
- `GET /api/v1/affiliates/:id/dashboard` - Obter dados do dashboard

#### Estrutura MLM
- `GET /api/v1/affiliates/:id/mlm-structure` - Obter estrutura MLM do afiliado
- `GET /api/v1/affiliates/:id/referrals` - Obter indicações do afiliado

#### Relatórios e Rankings
- `GET /api/v1/affiliates/ranking` - Obter ranking de afiliados
- `GET /api/v1/affiliates/stats` - Obter estatísticas gerais

#### Sistema
- `GET /health` - Health check do serviço
- `GET /health/detailed` - Health check detalhado
- `GET /api/v1/docs` - Documentação da API

## 🔧 Configuração

### Variáveis de Ambiente

```bash
# Servidor
NODE_ENV=development
PORT=3000
SERVICE_NAME=affiliate-service

# Banco Principal (Railway)
DATABASE_URL=postgresql://username:password@host:port/database

# Banco da Operação (Fonte de Dados)
EXTERNAL_DB_HOST=177.115.223.216
EXTERNAL_DB_PORT=5999
EXTERNAL_DB_USER=userschapz
EXTERNAL_DB_PASSWORD=mschaphz8881!
EXTERNAL_DB_NAME=dados_interno

# Autenticação
AFFILIATE_SERVICE_API_KEY=fature_affiliate_api_2025!K3y_9h8i7j6k5l4m3n2o1p

# ETL
ETL_SYNC_INTERVAL=900000
ETL_BATCH_SIZE=1000
ETL_ENABLED=true
```

### Instalação

```bash
# Instalar dependências
npm install

# Executar migração do banco
npm run migrate

# Iniciar em desenvolvimento
npm run dev

# Iniciar em produção
npm start
```

## 📊 Performance

### Benefícios da Arquitetura:
- **Consultas 10-50x mais rápidas** (dados pré-agregados)
- **Redução de 90% na carga** do banco da operação
- **Tempo de resposta:** 100-500ms (vs 5-15 segundos anterior)
- **Escalabilidade independente**

### Métricas Esperadas:
- **~48,261 afiliados** no banco robusto
- **~614,944 indicações** detalhadas
- **Milhões de transações** financeiras
- **Atualizações ETL** a cada 15 minutos

## 🔄 Processo ETL

O serviço sincroniza dados do banco da operação através de processo ETL:

### Frequência de Atualização:
- **Dados críticos:** A cada 15 minutos
- **Resumos diários:** 1x por dia (00:30)
- **Resumos semanais/mensais:** 1x por semana/mês
- **Recálculo completo:** 1x por semana (domingo)

### Fonte de Dados:
- **Banco da Operação:** PostgreSQL (177.115.223.216:5999)
- **Tabelas analisadas:** cadastro, casino_bets_v, depositos, saque, tracked

## 🛠️ Desenvolvimento

### Estrutura do Projeto

```
src/
├── app.js              # Aplicação Express principal
├── server.js           # Servidor HTTP
├── config/             # Configurações
├── controllers/        # Controladores (futuro)
├── database/           # Conexão e migração
├── middleware/         # Middlewares (auth, errors)
├── models/             # Modelos de dados (futuro)
├── routes/             # Rotas da API
├── services/           # Serviços de negócio (futuro)
└── utils/              # Utilitários (futuro)
```

### Tecnologias Utilizadas

- **Node.js 18+** - Runtime
- **Express.js** - Framework web
- **PostgreSQL** - Banco de dados
- **Redis** - Cache (futuro)
- **JWT** - Autenticação (futuro)

### Scripts Disponíveis

```bash
npm start          # Iniciar produção
npm run dev        # Iniciar desenvolvimento
npm run migrate    # Executar migração
npm test           # Executar testes
```

## 🔐 Segurança

- **Autenticação via API Key** obrigatória
- **Rate limiting** configurável
- **Validação de entrada** em todos os endpoints
- **Logs de segurança** centralizados
- **CORS** configurado para desenvolvimento

## 📈 Monitoramento

### Health Checks
- **Básico:** `GET /health`
- **Detalhado:** `GET /health/detailed`

### Métricas Monitoradas
- Status das conexões de banco
- Tempo de resposta das queries
- Uso de memória e CPU
- Uptime do serviço

## 🚀 Deploy

### Railway

```bash
# Login no Railway
railway login

# Deploy
railway up

# Configurar variáveis
railway variables set DATABASE_URL=postgresql://...
railway variables set AFFILIATE_SERVICE_API_KEY=...
```

### Variáveis Obrigatórias no Railway
- `DATABASE_URL` - URL do banco PostgreSQL
- `AFFILIATE_SERVICE_API_KEY` - Chave de API
- `EXTERNAL_DB_*` - Configurações do banco da operação

## 📚 Documentação Adicional

- **Estratégia Arquitetural:** Documento completo da arquitetura
- **Estrutura SQL:** Schema completo do banco robusto
- **APIs dos Microsserviços:** Integração com outros serviços

## 🤝 Integração

### Outros Microsserviços
- **Config Service:** Configurações CPA
- **MLM Service:** Processamento MLM
- **Commission Service:** Cálculo de comissões
- **Data Service:** ETL e sincronização

### API Gateway
O serviço será integrado ao API Gateway fortalecido para:
- Roteamento inteligente
- Cache de respostas
- Agregação de dados
- Monitoramento centralizado

---

**Versão:** 1.0.0  
**Autor:** EderZiomek <ederziomek@upbet.com>  
**Data:** 24 de junho de 2025

