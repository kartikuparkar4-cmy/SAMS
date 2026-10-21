const app = require('./app');
const { config, validateConfig } = require('./config');
const { connectDatabase } = require('./config/db');

async function start() {
  validateConfig();
  await connectDatabase(config.mongoUri);
  const server = app.listen(config.port, () => {
    console.log(`Northstar Medical is running at http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await require('mongoose').disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exitCode = 1;
});