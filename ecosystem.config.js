const DOTENV = '/root/ahenk/node_modules/.pnpm/dotenv@16.4.5/node_modules/dotenv/config.js';

module.exports = {
  apps: [
    {
      name: 'ahenk-api',
      cwd: '/root/ahenk/backend',
      script: '/root/ahenk/backend/dist/src/main.js',
      node_args: `-r ${DOTENV}`,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DOTENV_CONFIG_PATH: '/root/ahenk/backend/.env',
      },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'ahenk-web',
      script: '/root/ahenk/start-web.js',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
