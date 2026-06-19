module.exports = {
  apps: [
    {
      name: "mcp-control-room",
      script: "npx tsx server/index.ts",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
}
