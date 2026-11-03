'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { EvidenceGallery } from '@/components/EvidenceGallery';
import { EvidenceUploader } from '@/components/EvidenceUploader';
import { ErrorNote, Spinner } from '@/components/Shell';
import { Timeline } from '@/components/Timeline';
import { TriagePanel } from '@/components/TriagePanel';
import { EscalatedChip, Severity, StatusChip } from '@/components/Status';
import { ApiError, api, countdown, humanList, minutesSince } from '@/lib/api';
import { useSession } from '@/lib/session';

const SIGNAL_LABELS = [
  ['waterPresent', 'Water present'],
  ['flow', 'Flow'],
  ['spreading', 'Spreading'],
  ['nearElectrical', 'Near electricity'],
  ['ceilingOrWallDamage', 'Ceiling or wall damage'],
  ['sourceKnown', 'Source visible'],
  ['hotWaterOrBrown', 'Hot or discoloured'],
  ['sewage', 'Sewage'],
  ['gasOrSmoke', 'Gas or smoke'],
  ['shutoffAccessible', 'Shutoff reachable'],
  ['vulnerableOccupant', 'Vulnerable occupant'],
  ['affectedUnits', 'Units affected'],
  ['evidenceUploaded', 'Camera evidence'],
];

function yesNo(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replaceAll('_', ' ');
}

function IntakeRecord({ intake }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {SIGNAL_LABELS.map(([key, label]) => (
        <div key={key} className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="font-semibold text-slate-800">{yesNo(intake[key])}</dd>
        </div>
      ))}
      {intake.callerSummary ? (
        <p className="col-span-2 mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">“{intake.callerSummary}”</p>
      ) : null}
    </dl>
  );
}

function MitigationRecord({ mitigation }) {
  if (!mitigation?.length) return <p className="text-sm text-slate-500">No safety guidance was opened on this case.</p>;
  return (
    <ul className="space-y-3">
      {mitigation.map((entry) => (
        <li key={entry._id ?? entry.scriptId} className="card p-4">
          <h3 className="text-sm font-bold text-slate-900">{entry.title}</h3>
          <p className="text-[11px] text-slate-500">
            Accepted {new Date(entry.acknowledgedAt).toLocaleString()} by {entry.acknowledgedBy?.name}
          </p>
          <ol className="mt-2 space-y-1.5">
            {entry.steps.map((step) => (
              <li key={step.stepId} className="text-xs text-slate-700">
                <span className={`mr-1.5 font-bold ${step.confirmation === 'observed' ? 'text-brand-700' : 'text-slate-400'}`}>
                  {step.confirmation === 'observed' ? '◉' : '✓'}
                </span>
                {step.instruction}
                <span className="text-slate-400">
                  {' '}
                  — {step.confirmedBy?.name}, {new Date(step.confirmedAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
            {!entry.steps.length ? <li className="text-xs text-slate-400">No steps confirmed yet.</li> : null}
          </ol>
        </li>
      ))}
    </ul>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const { user, loading } = useSession();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const payload = await api.get(`/api/cases/${id}`);
      setDoc(payload.case);
      setError(null);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new Error(failure.message));
    }
  }, [id]);

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
  }, [loading, user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function act(path, body) {
    setBusy(true);
    try {
      const payload = await api.post(`/api/cases/${id}/${path}`, body ?? {});
      setDoc(payload.case);
      setError(null);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new Error(failure.message));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <Spinner label="Opening the case record" />;
  if (error && !doc) return <ErrorNote error={error} />;
  if (!doc) return <Spinner label="Loading" />;

  const staff = ['dispatcher', 'admin'].includes(user.role);
  const canDispatch = staff && ['triaged', 'mitigating'].includes(doc.status);
  const live = !['closed'].includes(doc.status);

  return (
    <div className="space-y-5">
      <header className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {doc.triage?.severity ? <Severity severity={doc.triage.severity} windowMinutes={doc.triage.dispatchWindowMinutes} /> : null}
          <StatusChip status={doc.status} />
          {doc.triage?.escalateToHuman ? <EscalatedChip /> : null}
          <span className="ml-auto font-mono text-[11px] text-slate-400">{doc.reference}</span>
        </div>

        <h1 className="mt-3 text-lg font-bold capitalize text-slate-900">
          {doc.triage?.classification?.replaceAll('_', ' ') ?? 'Untitled call'}
        </h1>
        <p className="text-sm text-slate-600">
          Unit {doc.unit?.label} · {doc.property?.name}, {doc.property?.city} · reported by {doc.reportedByName}
          {doc.reporterPhone ? ` on ${doc.reporterPhone}` : ''} · {doc.channel} · opened {minutesSince(doc.createdAt)}
        </p>

        {doc.dispatch?.selected ? (
          <p className={`mt-2 text-sm ${countdown(doc.dispatch.dueAt).overdue ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>
            {doc.dispatch.selected.name} (score {doc.dispatch.selected.score}) · {countdown(doc.dispatch.dueAt).text} ·{' '}
            {doc.dispatch.considered} contractors assessed, {doc.dispatch.rejectedCount} refused on compliance
          </p>
        ) : null}

        {doc.outcome ? (
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold">Outcome: </span>
            {doc.outcome}
          </p>
        ) : null}
      </header>

      {live ? (
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700">Dispatcher actions</h2>
          <div className="flex flex-wrap gap-2">
            {canDispatch ? (
              <Link href={`/dashboard?case=${doc._id}`} className="btn-primary !min-h-10 px-3 text-xs">
                Find a contractor
              </Link>
            ) : null}
            {staff && live ? (
              <button type="button" className="btn-ghost !min-h-10 px-3 text-xs" disabled={busy || doc.escalated} onClick={() => act('escalate', { reason: 'Escalated from the case record.' })}>
                {doc.escalated ? 'Already escalated' : 'Escalate to a human'}
              </button>
            ) : null}
            {staff || user.role === 'tenant' ? (
              <button type="button" className="btn-ghost !min-h-10 px-3 text-xs" disabled={busy} onClick={() => act('reassess')}>
                Re-run triage on this evidence
              </button>
            ) : null}
            {staff && doc.status === 'resolved' ? (
              <>
                <button type="button" className="btn-ghost !min-h-10 px-3 text-xs" disabled={busy} onClick={() => act('reopen')}>
                  Reopen the work
                </button>
                <button
                  type="button"
                  className="btn-primary !min-h-10 px-3 text-xs"
                  disabled={busy}
                  onClick={() => act('close', { outcome: doc.outcome ?? 'Closed by the dispatcher after review.' })}
                >
                  Close the case
                </button>
              </>
            ) : null}
            {(staff || user.role === 'tenant') && !['resolved', 'closed'].includes(doc.status) ? (
              <button type="button" className="btn-danger !min-h-10 px-3 text-xs" disabled={busy} onClick={() => act('cancel')}>
                Cancel this call
              </button>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-500">
            Needed trades: {humanList(doc.triage?.requiredTrades)} · window {doc.triage?.dispatchWindowMinutes} minutes · engine{' '}
            {doc.triage?.version}
          </p>
        </section>
      ) : null}

      <ErrorNote error={error} />

      <TriagePanel triage={doc.triage} />

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">What the caller told us</h2>
        <IntakeRecord intake={doc.intake} />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Guided shutoff and safety steps</h2>
        <MitigationRecord mitigation={doc.mitigation} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Evidence</h2>
        <EvidenceGallery caseId={doc._id} evidence={doc.evidence} />
        {live ? <EvidenceUploader caseId={doc._id} onUploaded={setDoc} onBusyChange={setBusy} /> : null}
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Audit timeline</h2>
          <span className="text-[11px] text-slate-400">{doc.events?.length ?? 0} events, append-only</span>
        </div>
        <Timeline events={doc.events} />
      </section>

      <div className="flex gap-3">
        <Link href={staff ? '/dashboard' : '/cases'} className="btn-ghost flex-1">
          Back to the list
        </Link>
        {user.role === 'tenant' ? (
          <Link href="/call" className="btn-primary flex-1">
            Start another call
          </Link>
        ) : null}
      </div>
    </div>
  );
}
