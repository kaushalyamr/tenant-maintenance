// Vercel entrypoint. Vercel detects an Express app that exports itself as the
// default export from one of a few well-known file names; this one wins over
// src/app.js in the detection order because the API is mounted at /api.
import { createApp } from './src/app.js';
import { connectDatabase } from './src/db.js';
import { ensureEvidenceDir } from './src/services/evidence.js';

await connectDatabase();
await ensureEvidenceDir();

export default createApp();
