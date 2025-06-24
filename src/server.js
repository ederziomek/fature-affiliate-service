const app = require('./app');
const config = require('./config');

const PORT = config.server.port;
const SERVICE_NAME = config.server.serviceName;

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ${SERVICE_NAME} rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1/affiliates`);
  console.log(`🌍 Ambiente: ${config.server.env}`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`📴 Recebido ${signal}, encerrando servidor...`);
  
  server.close(() => {
    console.log('✅ Servidor HTTP encerrado');
    
    // Fechar conexões do banco de dados se necessário
    // db.close() - implementar quando necessário
    
    process.exit(0);
  });

  // Forçar encerramento após 10 segundos
  setTimeout(() => {
    console.error('❌ Forçando encerramento do servidor');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  process.exit(1);
});

module.exports = server;

