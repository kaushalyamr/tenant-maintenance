'use client';

import { useCallback, useEffect, useState } from 'react';

import { ErrorNote, Spinner } from '@/components/Shell';
import { Severity } from '@/components/Status';
import { ApiError, api, countdown, humanList, minutesSince } from '@/lib/api';
import { useSession } from '@/lib/session';

function JobCard({ job, busy, onAct }) {
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState('');
  const doc = job.case ?? {};

  return (
    <li className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Severity severity={job.severity} />
        <span className={`chip ${job.status === 'open' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
          {job.status}
        </span>
        <span className="ml-auto text-[11px] font-semibold text-slate-500">
          {job.dueAt ? countdown(job.dueAt).text : ''}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-bold capitalize text-slate-900">{doc.triage?.classification?.replaceAll('_', ' ') ?? 'Call'}</h3>
        <p className="text-xs text-slate-600">
          {doc.reference} · unit {doc.unit?.label} ({doc.unit?.zone}) · {doc.property?.name}, {doc.property?.street}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Needed: <span className="capitalize">{job.trade}</span> · trades on the case: {humanList(doc.triage?.requiredTrades)}
        </p>
        {doc.unit?.shutoffLocation ? (
          <p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            <span className="font-semibold">Shutoff:</span> {doc.unit.shutoffLocation}
          </p>
        ) : null}
        {doc.intake?.callerSummary ? (
          <p className="mt-1.5 text-xs text-slate-500 italic">“{doc.intake.callerSummary}”</p>
        ) : null}
      </div>

      {doc.triage?.reasons?.length ? (
        <ul className="space-y-0.5 text-[11px] text-slate-500">
          {doc.triage.reasons.slice(0, 2).map((reason2) => (
            <li key={reason2.ruleId}>· {reason2.text}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-[11px] text-slate-400">
        {doc.mitigation?.length ? `${doc.mitigation.length} guidance script(s) worked through · ` : ''}
        {doc.evidence?.length ? `${doc.evidence.length} evidence item(s) · ` : ''}
        dispatched {minutesSince(job.dispatchedAt)}
      </p>

      {job.status === 'open' ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary !min-h-10 flex-1 px-3 text-xs" disabled={busy} onClick={() => onAct('accept', job._id)}>
            Accept and travel
          </button>
          {declineOpen ? (
            <div className="w-full space-y-2">
              <label className="label" htmlFor={`decline-${job._id}`}>
                Why can you not take it?
              </label>
              <textarea
                id={`decline-${job._id}`}
                className="input min-h-16"
                rows="2"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Already committed to a nearer P1."
              />
              <button
                type="button"
                className="btn-ghost !min-h-10 w-full px-3 text-xs"
                disabled={busy || reason.trim().length < 5}
                onClick={() => onAct('decline', job._id, { reason: reason.trim() })}
              >
                Send the decline
              </button>
            </div>
          ) : (
            <button type="button" className="btn-ghost !min-h-10 px-3 text-xs" disabled={busy} onClick={() => setDeclineOpen(true)}>
              Decline
            </button>
          )}
        </div>
      ) : null}

      {job.status === 'accepted' ? (
        <div className="space-y-2">
          <label className="label" htmlFor={`outcome-${job._id}`}>
            What did you do on site?
          </label>
          <textarea
            id={`outcome-${job._id}`}
            className="input min-h-20"
            rows="2"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="Replaced the failed union and pressure-tested for ten minutes."
          />
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy || outcome.trim().length < 5}
            onClick={() => onAct('complete', job._id, { outcome: outcome.trim() })}
          >
            Mark the work complete
          </button>
        </div>
      ) : null}

      {job.workNotes?.length ? (
        <ul className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
          {job.workNotes.map((note, index) => (
            <li key={index}>
              <span className="font-semibold">{note.author?.name}</span>: {note.body}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function JobsPage() {
  const { user, loading } = useSession();
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
  }, [loading, user]);

  const load = useCallback(() => {
    if (user?.role !== 'contractor') return;
    api
      .get('/api/jobs/mine')
      .then((payload) => setJobs(payload.jobs))
      .catch((failure) => setError(failure));
  }, [user]);

  useEffect(load, [load]);

  async function act(verb, id, body) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/jobs/${id}/${verb}`, body ?? {});
      load();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new Error(failure.message));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading your work orders" />;
  if (!user) return null;
  if (user.role !== 'contractor') {
    return <p className="card p-4 text-sm text-slate-600">This screen is for contractor accounts.</p>;
  }

  const live = jobs.filter((job) => ['open', 'accepted'].includes(job.status));
  const history = jobs.filter((job) => ['completed', 'declined'].includes(job.status));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">{user.contractor?.name ?? 'Your business'}</h1>
        <p className="text-sm text-slate-600">
          {live.length ? `${live.length} job${live.length > 1 ? 's' : ''} waiting on you` : 'No jobs waiting on you right now.'}
        </p>
      </header>

      <ErrorNote error={error} />

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Live work orders</h2>
        {live.length === 0 ? (
          <p className="card p-4 text-sm text-slate-600">Nothing is assigned. New dispatches appear here and on the dispatcher board.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {live.map((job) => (
              <JobCard key={job._id} job={job} busy={busy} onAct={act} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Finished</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No completed or declined jobs yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {history.map((job) => (
              <JobCard key={job._id} job={job} busy={busy} onAct={act} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
