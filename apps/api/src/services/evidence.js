import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import multer from 'multer';

import { config } from '../config.js';
import { CASE_STATE } from '../domain/case-state-machine.js';
import { ConflictError, NotFoundError, ValidationError } from '../http/errors.js';
import { EvidenceFile } from '../models/evidence-file.js';
import { loadAccessibleCase } from './cases.js';

// Only these types are accepted, and the stored extension comes from the type
// the server detected — never from the filename the browser sent.
const ACCEPTED = new Map([
  ['image/jpeg', { kind: 'photo', ext: '.jpg' }],
  ['image/png', { kind: 'photo', ext: '.png' }],
  ['image/webp', { kind: 'photo', ext: '.webp' }],
  ['video/mp4', { kind: 'video', ext: '.mp4' }],
  ['video/webm', { kind: 'video', ext: '.webm' }],
]);

export async function ensureEvidenceDir() {
  if (config.evidence.storage === 'disk') await mkdir(config.evidence.dir, { recursive: true });
}

// Always buffer the upload: the disk backend writes the buffer afterwards and
// the Mongo backend inserts it, so there is only one validation path.
export const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.evidence.maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED.has(file.mimetype)) {
      return cb(new ValidationError('That file type cannot be used as evidence.'));
    }
    cb(null, true);
  },
});

async function storeFile(storedName, mime, data) {
  if (config.evidence.storage === 'mongo') {
    await EvidenceFile.create({ storedName, mime, bytes: data.byteLength, data });
    return;
  }
  await writeFile(join(config.evidence.dir, storedName), data);
}

// A lean Mongoose query returns BSON Binary rather than a Node Buffer.
function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value?.buffer) return Buffer.from(value.buffer);
  return Buffer.from(value);
}

async function discardFile(storedName) {
  if (config.evidence.storage === 'mongo') {
    await EvidenceFile.deleteOne({ storedName });
    return;
  }
  await rm(join(config.evidence.dir, storedName), { force: true });
}

function safeName(name) {
  return String(name ?? 'evidence').replace(/[^\w.\- ]+/g, '_').slice(0, 140) || 'evidence';
}

export async function attachEvidence(id, user, file, { description, kind }) {
  if (kind !== 'note' && !file) throw new ValidationError('Attach a photo or video from the call.');

  const doc = await loadAccessibleCase(id, user);
  if (doc.status === CASE_STATE.CLOSED) throw new ConflictError('This case is closed, so evidence can no longer be added.');

  // A typed observation is evidence too, but it must never be filed as a photo.
  if (kind !== 'note') {
    const detected = ACCEPTED.get(file.mimetype);
    if (detected.kind !== kind) {
      throw new ValidationError(`That upload is a ${detected.kind}, not a ${kind}.`);
    }
  }

  const stored = kind === 'note' ? null : ACCEPTED.get(file.mimetype);
  const payload = kind === 'note' ? Buffer.from(description, 'utf8') : file.buffer;
  const storedName = stored ? `${Date.now()}-${randomBytes(8).toString('hex')}${stored.ext}` : null;
  const sha256 = createHash('sha256').update(payload).digest('hex');

  if (storedName) await storeFile(storedName, file.mimetype, payload);

  doc.evidence.push({
    kind,
    originalName: kind === 'note' ? 'caller note' : safeName(file.originalname),
    storedName,
    mime: stored ? file.mimetype : 'text/plain',
    bytes: stored ? file.size : payload.byteLength,
    sha256,
    description,
    uploadedBy: { id: user.id, name: user.name, role: user.role },
  });
  // Evidence is an input to the rules engine, so the case is flagged as seen.
  doc.intake.evidenceUploaded = true;

  try {
    doc.events.push({
      type: 'evidence.added',
      actor: { id: user.id, name: user.name, role: user.role },
      data: { kind, bytes: stored ? file.size : payload.byteLength, sha256, description },
    });
    await doc.save();
  } catch (error) {
    if (storedName) await discardFile(storedName);
    throw error;
  }

  return doc;
}

export async function evidenceFile(id, evidenceId, user) {
  const doc = await loadAccessibleCase(id, user);
  const item = doc.evidence.id(evidenceId);
  if (!item) throw new NotFoundError('No such evidence on this case.');
  if (!item.storedName) throw new NotFoundError('That evidence is a written note, not a file.');

  const base = { mime: item.mime, bytes: item.bytes, kind: item.kind, capturedAt: item.capturedAt };
  if (config.evidence.storage === 'mongo') {
    const stored = await EvidenceFile.findOne({ storedName: item.storedName }).lean();
    if (!stored) throw new NotFoundError('The stored evidence file is missing.');
    return { ...base, buffer: asBuffer(stored.data) };
  }
  return { ...base, path: join(config.evidence.dir, item.storedName) };
}
