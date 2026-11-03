'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CaseCard } from '@/components/CaseCard';
import { ErrorNote, Spinner } from '@/components/Shell';
import { ApiError, api, countdown, humanList } from '@/lib/api';
import { useSession } from '@/lib/session';

const VIEWS = [
  { key: 'all', label: 'Everything open', build: () => ({}) },
  { key: 'awaiting', label: 'Awaiting dispatch', build: () => ({ status: 'triaged' }) },
  { key: 'guiding', label: 'Guiding callers', build: () => ({ status: 'mitigating' }) },
  { key: 'escalated', label: 'Human review', build: () => ({ escalated: 'true' }) },
  { key: 'p1', label: 'P1 only', build: () => ({ severity: 'P1' }) },
];

const CLOSED = new Set(['closed', 'resolved']);

function Stats({ cases }) {
  const now = Date.now();
  const open = cases.filter((item) => !CLOSED.has(item.status));
  const p1 = open.filter((item) => item.triage?.severity === 'P1').length;
  const escalated = open.filter((item) => item.triage?.escalateToHuman).length;
  const overdue = open.filter((item) => item.dispatch?.dueAt && new Date(item.dispatch.dueAt).getTime() < now).length;

  const cells = [
    ['Open cases', open.length, 'text-slate-900'],
    ['P1 emergencies', p1, p1 ? 'text-rose-700' : 'text-slate-900'],
    ['Need a human', escalated, escalated ? 'text-violet-700' : 'text-slate-900'],
    ['Past the window', overdue, overdue ? 'text-amber-700' : 'text-slate-900'],
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map(([label, value, tone]) => (
        <div key={label} className="card p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DispatchPanel({ caseDoc, onClose, onDispatched }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    api
      .get(`/api/cases/${caseDoc._id}/matches`)
      .then((payload) => active && setData(payload))
      .catch((failure) => active && setError(failure));
    return () => {
      active = false;
    };
  }, [caseDoc._id]);

  async function dispatch(contractorId) {
    setBusy(true);
    setError(null);
    try {
      const payload = await api.post(`/api/cases/${caseDoc._id}/dispatch`, { contractorId });
      onDispatched(payload.case);
      onClose();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new Error(failure.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Contractors for ${caseDoc.reference}`}
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-slate-50 p-4 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Send a licensed contractor</h2>
            <p className="text-xs text-slate-600">
              {caseDoc.triage?.classification?.replaceAll('_', ' ')} · needs {humanList(caseDoc.triage?.requiredTrades)} · zone{' '}
              {caseDoc.unit?.zone}
            </p>
          </div>
          <button type="button" className="btn-ghost !min-h-9 px-3 text-xs" onClick={onClose}>
            Close
          </button>
        </header>

        {error && !data ? <ErrorNote error={error} /> : null}
        {!data && !error ? <Spinner label="Checking licences and capacity" /> : null}

        {data ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              {data.matched.length} eligible of {data.matched.length + data.rejected.length} · work order due{' '}
              {new Date(data.dueAt).toLocaleTimeString()} ({data.requirement.dispatchWindowMinutes} min window)
            </p>

            <ul className="space-y-3">
              {data.matched.map((match) => (
                <li key={match.contractorId} className="card p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
                      {match.score}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-900">{match.name}</h3>
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                        {match.reasons.map((reason) => (
                          <li key={reason}>· {reason}</li>
                        ))}
                      </ul>
                      {match.renewalDueSoon ? (
                        <p className="mt-1.5 chip bg-amber-100 text-amber-900">
                          Licence or insurance lapses within 30 days
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn-primary shrink-0 !min-h-9 px-3 text-xs"
                      disabled={busy}
                      onClick={() => dispatch(match.contractorId)}
                    >
                      Dispatch
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {data.rejected.length ? (
              <details className="card p-4 text-sm">
                <summary className="cursor-pointer font-semibold text-slate-800">
                  {data.rejected.length} contractor{data.rejected.length > 1 ? 's' : ''} refused by the compliance filter
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {data.rejected.map((item) => (
                    <li key={item.contractorId} className="text-xs text-slate-600">
                      <span className="font-mono text-[10px] text-rose-700">{item.code}</span> — {item.name}: {item.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useSession();
  const [cases, setCases] = useState([]);
  const [view, setView] = useState('all');
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
  }, [loading, user]);

  useEffect(() => {
    if (!user || !['dispatcher', 'admin'].includes(user.role)) return;
    const params = new URLSearchParams(VIEWS.find((item) => item.key === view).build());
    params.set('limit', '100');
    api
      .get(`/api/cases?${params}`)
      .then((payload) => {
        setCases(payload.cases);
        setError(null);
      })
      .catch((failure) => setError(failure));
  }, [user, view, stamp]);

  const refresh = useCallback(() => setStamp((current) => current + 1), []);

  // A case page can hand work back here with /dashboard?case=<id>; open the picker straight away.
  const [pendingId, setPendingId] = useState(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('case'),
  );

  useEffect(() => {
    if (!pendingId) return;
    const target = cases.find((item) => item._id === pendingId);
    if (!target) return;
    setSelected(target);
    setPendingId(null);
    window.history.replaceState(null, '', '/dashboard');
  }, [cases, pendingId]);

  const sorted = useMemo(
    () =>
      [...cases].sort((a, b) => {
        const rank = (item) => ({ P1: 1, P2: 2, P3: 3, P4: 4 }[item.triage?.severity] ?? 5);
        return rank(a) - rank(b) || new Date(b.createdAt) - new Date(a.createdAt);
      }),
    [cases],
  );

  if (loading) return <Spinner label="Loading the board" />;
  if (!user) return null;
  if (!['dispatcher', 'admin'].includes(user.role)) {
    return (
      <p className="card p-4 text-sm text-slate-600">
        This board is for dispatchers and building admins. <a href="/login" className="font-semibold underline">Sign in with a staff account</a>.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live board</h1>
          <p className="text-sm text-slate-600">Every call the portfolio has taken, ranked by severity.</p>
        </div>
        <button type="button" className="btn-ghost !min-h-9 px-3 text-xs" onClick={refresh}>
          Refresh
        </button>
      </div>

      <Stats cases={cases} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={view === item.key}
            onClick={() => setView(item.key)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              view === item.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ErrorNote error={error} />

      {sorted.length === 0 ? (
        <p className="card p-6 text-center text-sm text-slate-500">Nothing in this queue right now.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((item) => (
            <li key={item._id} className="relative">
              <CaseCard item={item} />
              {['triaged', 'mitigating'].includes(item.status) ? (
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="mt-2 w-full rounded-xl border border-brand-600 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Find a contractor
                </button>
              ) : null}
              {item.dispatch?.dueAt && !CLOSED.has(item.status) ? (
                <p className={`mt-2 text-center text-xs font-semibold ${countdown(item.dispatch.dueAt).overdue ? 'text-rose-700' : 'text-slate-500'}`}>
                  {item.dispatch.selected?.name} · {countdown(item.dispatch.dueAt).text}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <DispatchPanel caseDoc={selected} onClose={() => setSelected(null)} onDispatched={refresh} />
      ) : null}
    </div>
  );
}
