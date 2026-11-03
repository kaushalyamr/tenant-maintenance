'use client';

import { useRef, useState } from 'react';

import { ApiError, api } from '@/lib/api';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

function kindOf(file) {
  if (!file) return 'note';
  if (IMAGE_TYPES.includes(file.type)) return 'photo';
  if (VIDEO_TYPES.includes(file.type)) return 'video';
  return 'unsupported';
}

export function EvidenceUploader({ caseId, onUploaded, onBusyChange }) {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const kind = kindOf(file);
  const canSubmit = description.trim().length >= 3 && (file ? kind !== 'unsupported' : true) && !busy;

  async function submit(event) {
    event.preventDefault();
    setError(null);

    const form = new FormData();
    form.append('description', description.trim());
    form.append('kind', kind);
    if (file) form.append('evidence', file);

    setBusy(true);
    onBusyChange?.(true);
    try {
      const payload = await api.upload(`/api/cases/${caseId}/evidence`, form);
      setFile(null);
      setDescription('');
      if (inputRef.current) inputRef.current.value = '';
      onUploaded(payload.case);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new Error(failure.message));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">Send evidence</h3>
      <p className="text-xs text-slate-500">
        A photo or short clip from the call raises the engine&rsquo;s confidence and is kept with the case for the claim.
      </p>

      <input
        ref={inputRef}
        id="evidence-file"
        type="file"
        accept={IMAGE_TYPES.concat(VIDEO_TYPES).join(',')}
        className="block w-full text-sm text-slate-600 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:text-sm file:font-semibold file:text-brand-900"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      {file ? (
        <p className="text-xs text-slate-600">
          {file.name} · {(file.size / 1024).toFixed(0)} KB ·{' '}
          {kind === 'unsupported' ? (
            <span className="font-semibold text-rose-700">this type is not accepted</span>
          ) : (
            <span className="font-semibold text-brand-800">will be filed as {kind}</span>
          )}
        </p>
      ) : (
        <p className="text-xs text-slate-500">No file chosen — leaving this empty records a written observation instead.</p>
      )}

      <div>
        <label className="label" htmlFor="evidence-description">
          What does it show?
        </label>
        <textarea
          id="evidence-description"
          className="input min-h-20"
          rows="2"
          maxLength="500"
          placeholder="Ceiling above the bathroom is bulging and dripping brown water."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error.message}</p> : null}

      <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
        {busy ? 'Uploading…' : 'Attach to the case'}
      </button>
    </form>
  );
}
