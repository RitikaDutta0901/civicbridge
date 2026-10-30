import 'dotenv/config';
import app from './app.js';
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => console.log(`CivicBridge API listening on http://localhost:${port}`));
server.on('error', (error) => {
  console.error(`CivicBridge API failed to listen on port ${port}:`, error.message);
  process.exitCode = 1;
});
function shutdown(signal) {
  console.log(`Received ${signal}; shutting down CivicBridge API.`);
  server.close(() => process.exit(0));
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
