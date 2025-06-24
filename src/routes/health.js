const express = require('express');
const router = express.Router();
const config = require('../config');

// Health check básico
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Verificar conexão com banco (implementar quando o banco estiver configurado)
    let databaseStatus = 'unknown';
    let databaseMessage = 'Verificação não implementada';
    
    // Verificar cache Redis (implementar quando necessário)
    let cacheStatus = 'unknown';
    let cacheMessage = 'Verificação não implementada';
    
    const responseTime = Date.now() - startTime;
    
    const healthData = {
      success: true,
      message: 'Affiliate Service funcionando',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: config.server.serviceName,
      environment: config.server.env,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        service: {
          status: 'ok',
          message: 'Serviço rodando normalmente'
        },
        database: {
          status: databaseStatus,
          message: databaseMessage
        },
        cache: {
          status: cacheStatus,
          message: cacheMessage
        }
      },
      responseTime
    };

    res.status(200).json(healthData);
    
  } catch (error) {
    console.error('❌ Erro no health check:', error);
    
    res.status(503).json({
      success: false,
      message: 'Affiliate Service com problemas',
      timestamp: new Date().toISOString(),
      service: config.server.serviceName,
      error: error.message
    });
  }
});

// Health check detalhado
router.get('/detailed', async (req, res) => {
  try {
    const healthData = {
      service: config.server.serviceName,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.server.env,
      uptime: {
        process: process.uptime(),
        system: require('os').uptime()
      },
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      configuration: {
        etlEnabled: config.etl.enabled,
        etlInterval: config.etl.syncInterval,
        rateLimitMax: config.rateLimit.max,
        rateLimitWindow: config.rateLimit.windowMs
      }
    };

    res.status(200).json(healthData);
    
  } catch (error) {
    console.error('❌ Erro no health check detalhado:', error);
    
    res.status(503).json({
      error: 'Erro no health check detalhado',
      message: error.message,
      service: config.server.serviceName,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

