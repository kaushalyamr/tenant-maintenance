import { createApp } from './create-app.js';
import { config } from './config.js';
import { connectDatabase } from './db.js';
import { ensureEvidenceDir } from './services/evidence.js';

const connection = await connectDatabase();
await ensureEvidenceDir();

const server = createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (mongo: ${connection.host}/${connection.name})`);
});

function shutdown(signal) {
  console.log(`${signal} received, closing the server`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
