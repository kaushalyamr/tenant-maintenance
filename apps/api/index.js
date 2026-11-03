// Vercel entrypoint. The Express preset only accepts an entrypoint that
// imports express directly, so this file names the dependency even though the
// app itself is assembled in src/create-app.js.
import express from 'express';
import { createApp } from './src/create-app.js';
import { connectDatabase } from './src/db.js';
import { ensureEvidenceDir } from './src/services/evidence.js';

await connectDatabase();
await ensureEvidenceDir();

export default createApp();
