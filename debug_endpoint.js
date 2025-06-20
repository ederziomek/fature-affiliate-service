# Endpoint para listar todas as variáveis de ambiente disponíveis
app.get('/debug/env', (req, res) => {
    const envVars = {};
    
    // Listar todas as variáveis que começam com DATABASE, POSTGRES, DB
    Object.keys(process.env).forEach(key => {
        if (key.includes('DATABASE') || 
            key.includes('POSTGRES') || 
            key.includes('DB') ||
            key.includes('RAILWAY')) {
            envVars[key] = process.env[key] ? 'DEFINIDA' : 'VAZIA';
        }
    });
    
    res.json({
        service: 'affiliate-service',
        available_env_vars: envVars,
        current_database_url: databaseUrl ? 'CONFIGURADA' : 'NÃO CONFIGURADA'
    });
});


