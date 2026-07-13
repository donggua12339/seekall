# 觅源 SeekAll - PM2 进程配置
# 用法：pm2 start ecosystem.config.cjs --env production
#      pm2 save && pm2 startup（开机自启）

module.exports = {
  apps: [
    {
      name: 'seekall-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      env_file: '.env',
      error_file: '/var/log/seekall/api-error.log',
      out_file: '/var/log/seekall/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'seekall-web',
      cwd: './apps/web',
      script: 'node_modules/nuxt/bin/nuxt.mjs',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 7300,
      },
      env_file: '.env',
      error_file: '/var/log/seekall/web-error.log',
      out_file: '/var/log/seekall/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
}
