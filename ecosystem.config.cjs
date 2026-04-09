module.exports = {
  apps: [
    {
      name: "tazkarti-watcher",
      script: "npm",
      args: "run watch",
      cwd: __dirname,
      autorestart: true,
      restart_delay: 5000,
      watch: false,
      max_restarts: 20,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
