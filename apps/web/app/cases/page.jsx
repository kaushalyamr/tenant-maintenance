'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { CaseCard } from '@/components/CaseCard';
import { ErrorNote, Spinner } from '@/components/Shell';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'awaiting', label: 'Awaiting dispatch' },
  { key: 'done', label: 'Finished' },
  { key: 'all', label: 'All' },
];

const BUILD = {
  open: () => ({ limit: 100 }),
  awaiting: () => ({ status: 'triaged', limit: 100 }),
  done: () => ({ status: 'closed', limit: 100 }),
  all: () => ({ limit: 100 }),
};

export default function CasesPage() {
  const { user, loading } = useSession();
  const [cases, setCases] = useState([]);
  const [filter, setFilter] = useState('open');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(BUILD[filter]());
    api
      .get(`/api/cases?${params}`)
      .then((payload) => setCases(payload.cases))
      .catch((failure) => setError(failure));
  }, [user, filter]);

  // 'open' is not a single database status, so it is filtered here rather than in the query.
  const visible = useMemo(
    () => (filter === 'open' ? cases.filter((item) => !['closed'].includes(item.status)) : cases),
    [cases, filter],
  );

  if (loading || !user) return <Spinner label="Loading cases" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Case history</h1>
        {user.role === 'tenant' ? (
          <Link href="/call" className="btn-primary !min-h-9 px-3 text-xs">
            Start a call
          </Link>
        ) : null}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              filter === item.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ErrorNote error={error} />

      {visible.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">No cases in this view.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((item) => (
            <li key={item._id}>
              <CaseCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
