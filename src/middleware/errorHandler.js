const config = require('../config');

const errorHandler = (err, req, res, next) => {
  console.error('❌ Erro capturado:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Erro de validação
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Erro de validação',
      message: err.message,
      details: err.details || null,
      service: config.server.serviceName,
      timestamp: new Date().toISOString()
    });
  }

  // Erro de banco de dados
  if (err.code && err.code.startsWith('23')) { // PostgreSQL constraint errors
    return res.status(400).json({
      error: 'Erro de banco de dados',
      message: 'Violação de restrição de dados',
      service: config.server.serviceName,
      timestamp: new Date().toISOString()
    });
  }

  // Erro de conexão com banco
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Serviço indisponível',
      message: 'Erro de conexão com banco de dados',
      service: config.server.serviceName,
      timestamp: new Date().toISOString()
    });
  }

  // Erro genérico
  const statusCode = err.statusCode || err.status || 500;
  
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Erro interno do servidor' : err.message,
    message: config.server.env === 'development' ? err.message : 'Algo deu errado',
    service: config.server.serviceName,
    timestamp: new Date().toISOString(),
    ...(config.server.env === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;

