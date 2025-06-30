const config = require('../config');

const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key obrigatória',
      message: 'Forneça a API Key no header X-API-Key',
      service: config.server.serviceName,
      timestamp: new Date().toISOString()
    });
  }

  if (apiKey !== config.apiKeys.affiliate) {
    return res.status(403).json({
      error: 'API Key inválida',
      message: 'A API Key fornecida não é válida',
      service: config.server.serviceName,
      timestamp: new Date().toISOString()
    });
  }

  // API Key válida, continuar
  next();
};

module.exports = authMiddleware;

