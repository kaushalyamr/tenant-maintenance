'use client';

import { useEffect, useState } from 'react';

import { evidenceBlobUrl } from '@/lib/api';

function EvidenceImage({ caseId, item }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let created;
    evidenceBlobUrl(caseId, item._id)
      .then((objectUrl) => {
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        created = objectUrl;
        setUrl(objectUrl);
      })
      .catch((failure) => active && setError(failure.message));
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [caseId, item._id]);

  if (error) return <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>;
  if (!url) return <div className="grid aspect-4/3 place-items-center rounded-lg bg-slate-100 text-xs text-slate-500">Loading…</div>;

  return item.kind === 'video' ? (
    <video src={url} controls className="aspect-4/3 w-full rounded-lg bg-slate-900 object-contain" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- a blob object URL, not an optimisable remote image.
    <img src={url} alt={item.description || item.originalName} loading="lazy" className="aspect-4/3 w-full rounded-lg object-cover" />
  );
}

export function EvidenceGallery({ caseId, evidence }) {
  if (!evidence?.length) {
    return <p className="text-sm text-slate-500">No photo, video or written observation has been recorded on this case.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {evidence.map((item) => (
        <li key={item._id} className="card overflow-hidden">
          {item.storedName ? (
            <EvidenceImage caseId={caseId} item={item} />
          ) : (
            <div className="grid aspect-4/3 place-items-center bg-slate-50 p-4 text-center">
              <span className="text-3xl" aria-hidden="true">
                📝
              </span>
              <span className="mt-1 text-xs font-semibold text-slate-500">Written observation</span>
            </div>
          )}
          <div className="space-y-1 p-3">
            <p className="text-sm text-slate-700">{item.description}</p>
            <p className="text-[11px] text-slate-400">
              {item.kind} · {Math.round(item.bytes / 1024)} KB · {new Date(item.capturedAt).toLocaleString()} ·{' '}
              {item.uploadedBy?.name}
            </p>
            <p className="font-mono text-[10px] text-slate-400">sha256 {item.sha256?.slice(0, 16)}…</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
