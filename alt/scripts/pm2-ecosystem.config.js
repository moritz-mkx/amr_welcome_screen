// PM2 Ecosystem-Konfiguration für Welcome Screen
// Verwenden Sie: pm2 start pm2-ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'welcome-screen',
      script: './backend/src/server.js',
      cwd: __dirname + '/..',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
