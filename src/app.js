const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Importar rotas
const affiliateRoutes = require('./routes/affiliates');
const healthRoutes = require('./routes/health');

const app = express();

// Middleware de segurança
app.use(helmet());

// CORS - permitir todas as origens para desenvolvimento
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Muitas requisições, tente novamente mais tarde',
    service: config.server.serviceName,
    timestamp: new Date().toISOString()
  }
});
app.use('/api/', limiter);

// Logging
if (config.server.env !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check (sem autenticação)
app.use('/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: config.server.serviceName,
    message: `Microserviço ${config.server.serviceName} do Sistema Fature CPA`,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api/v1/affiliates',
      docs: '/api/v1/docs'
    }
  });
});

// API Routes com autenticação
app.use('/api/v1/affiliates', authMiddleware, affiliateRoutes);

// Documentação da API
app.get('/api/v1/docs', (req, res) => {
  res.json({
    service: config.server.serviceName,
    version: '1.0.0',
    description: 'API do Affiliate Service - Banco Robusto de Afiliados',
    endpoints: {
      'GET /api/v1/affiliates': 'Listar afiliados com paginação',
      'GET /api/v1/affiliates/:id': 'Obter dados de um afiliado específico',
      'GET /api/v1/affiliates/:id/mlm-structure': 'Obter estrutura MLM do afiliado',
      'GET /api/v1/affiliates/:id/referrals': 'Obter indicações do afiliado',
      'GET /api/v1/affiliates/:id/financial-summary': 'Obter resumo financeiro',
      'GET /api/v1/affiliates/:id/dashboard': 'Obter dados do dashboard',
      'POST /api/v1/affiliates/:id/validate-cpa': 'Validar CPA de uma indicação',
      'GET /api/v1/affiliates/ranking': 'Obter ranking de afiliados',
      'GET /api/v1/affiliates/stats': 'Obter estatísticas gerais'
    },
    authentication: 'X-API-Key header obrigatório',
    rateLimit: `${config.rateLimit.max} requisições por ${config.rateLimit.windowMs / 60000} minutos`
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    service: config.server.serviceName,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;

