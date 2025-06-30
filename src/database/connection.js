const { Pool } = require('pg');
const config = require('../config');

// Pool de conexões para o banco principal (Railway)
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  ...config.database.pool
});

// Pool de conexões para o banco da operação (fonte de dados)
const externalPool = new Pool({
  host: config.externalDatabase.host,
  port: config.externalDatabase.port,
  user: config.externalDatabase.user,
  password: config.externalDatabase.password,
  database: config.externalDatabase.database,
  ssl: config.externalDatabase.ssl,
  max: 5, // Menos conexões para o banco externo
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Função para testar conexão
const testConnection = async (poolInstance, name) => {
  try {
    const client = await poolInstance.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log(`✅ Conexão com ${name} estabelecida com sucesso`);
    return true;
  } catch (error) {
    console.error(`❌ Erro na conexão com ${name}:`, error.message);
    return false;
  }
};

// Função para executar query no banco principal
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (config.server.env === 'development') {
      console.log('📊 Query executada:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Erro na query:', { text, error: error.message });
    throw error;
  }
};

// Função para executar query no banco da operação
const externalQuery = async (text, params) => {
  const start = Date.now();
  try {
    const res = await externalPool.query(text, params);
    const duration = Date.now() - start;
    
    if (config.server.env === 'development') {
      console.log('📊 Query externa executada:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Erro na query externa:', { text, error: error.message });
    throw error;
  }
};

// Função para obter cliente do pool (para transações)
const getClient = async () => {
  return await pool.connect();
};

// Função para verificar saúde das conexões
const healthCheck = async () => {
  const mainDbStatus = await testConnection(pool, 'Banco Principal');
  const externalDbStatus = await testConnection(externalPool, 'Banco da Operação');
  
  return {
    mainDatabase: mainDbStatus ? 'connected' : 'disconnected',
    externalDatabase: externalDbStatus ? 'connected' : 'disconnected'
  };
};

// Graceful shutdown
const closeConnections = async () => {
  console.log('📴 Fechando conexões com banco de dados...');
  await pool.end();
  await externalPool.end();
  console.log('✅ Conexões fechadas');
};

// Event listeners para logs de conexão
pool.on('connect', () => {
  console.log('🔗 Nova conexão estabelecida com banco principal');
});

pool.on('error', (err) => {
  console.error('❌ Erro no pool do banco principal:', err);
});

externalPool.on('connect', () => {
  console.log('🔗 Nova conexão estabelecida com banco da operação');
});

externalPool.on('error', (err) => {
  console.error('❌ Erro no pool do banco da operação:', err);
});

module.exports = {
  query,
  externalQuery,
  getClient,
  healthCheck,
  closeConnections,
  pool,
  externalPool
};

