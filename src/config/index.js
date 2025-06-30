require('dotenv').config();

const config = {
  // Configurações do servidor
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    serviceName: process.env.SERVICE_NAME || 'affiliate-service'
  },

  // Configurações do banco de dados
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000
    }
  },

  // Banco da operação (fonte de dados)
  externalDatabase: {
    host: process.env.EXTERNAL_DB_HOST,
    port: parseInt(process.env.EXTERNAL_DB_PORT) || 5999,
    user: process.env.EXTERNAL_DB_USER,
    password: process.env.EXTERNAL_DB_PASSWORD,
    database: process.env.EXTERNAL_DB_NAME,
    ssl: process.env.EXTERNAL_DB_SSL === 'true'
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: 3600 // 1 hora
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  // API Keys
  apiKeys: {
    affiliate: process.env.AFFILIATE_SERVICE_API_KEY,
    config: process.env.CONFIG_SERVICE_API_KEY,
    mlm: process.env.MLM_SERVICE_API_KEY,
    commission: process.env.COMMISSION_SERVICE_API_KEY,
    data: process.env.DATA_SERVICE_API_KEY
  },

  // URLs dos outros microsserviços
  services: {
    config: process.env.CONFIG_SERVICE_URL,
    mlm: process.env.MLM_SERVICE_URL,
    commission: process.env.COMMISSION_SERVICE_URL,
    data: process.env.DATA_SERVICE_URL
  },

  // Configurações ETL
  etl: {
    syncInterval: parseInt(process.env.ETL_SYNC_INTERVAL) || 900000, // 15 minutos
    batchSize: parseInt(process.env.ETL_BATCH_SIZE) || 1000,
    enabled: process.env.ETL_ENABLED === 'true'
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  }
};

module.exports = config;

