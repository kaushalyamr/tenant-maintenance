'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CaseCard } from '@/components/CaseCard';
import { EvidenceUploader } from '@/components/EvidenceUploader';
import { IntakeForm, EMPTY_SIGNALS } from '@/components/IntakeForm';
import { MitigationGuide } from '@/components/MitigationGuide';
import { TriagePanel } from '@/components/TriagePanel';
import { ErrorNote, Spinner } from '@/components/Shell';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

const PHASE = { IDLE: 'idle', LIVE: 'live', RESULT: 'result' };

function CallChrome({ phase, seconds, onStart, unitLabel }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-4 bg-slate-900 px-5 py-4 text-white">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${phase === PHASE.LIVE ? 'bg-brand-500' : 'bg-slate-700'}`}>
          {phase === PHASE.LIVE ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
          ) : (
            <span aria-hidden="true">🎙</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {phase === PHASE.IDLE ? 'Emergency line — ready' : phase === PHASE.LIVE ? 'Agent is listening' : 'Call logged'}
          </p>
          <p className="truncate text-xs text-slate-300">
            {unitLabel ? `Unit ${unitLabel} · ` : ''}
            {phase === PHASE.LIVE ? `${mm}:${ss} on the line` : 'Answer the questions and the engine grades the call'}
          </p>
        </div>
        {phase === PHASE.IDLE ? (
          <button type="button" onClick={onStart} className="btn shrink-0 bg-brand-500 text-white hover:bg-brand-600">
            Start call
          </button>
        ) : null}
      </div>
      <p className="border-t border-slate-200 bg-brand-50 px-5 py-2 text-[11px] text-brand-900">
        Simulated call. The telephony contract that would feed this screen from a phone bridge is documented in{' '}
        <code className="font-mono">docs/conversation-relay.md</code>.
      </p>
    </section>
  );
}

export default function CallPage() {
  const { user, loading } = useSession();
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [seconds, setSeconds] = useState(0);
  const [signals, setSignals] = useState(EMPTY_SIGNALS);
  const [caseDoc, setCaseDoc] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const unitId = user?.unit?._id ?? user?.unit ?? null;
  const unitLabel = user?.unit?.label ?? null;

  useEffect(() => {
    if (!loading && !user) window.location.href = '/login';
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    api.get('/api/cases').then((payload) => setMine(payload.cases)).catch((failure) => setError(failure));
    api.get('/api/mitigation-scripts').then((payload) => setScripts(payload.scripts)).catch(() => setScripts([]));
  }, [user]);

  useEffect(() => {
    if (phase !== PHASE.LIVE) return undefined;
    timer.current = setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => clearInterval(timer.current);
  }, [phase]);

  const change = useCallback((key, value) => setSignals((current) => ({ ...current, [key]: value })), []);
  const changeSummary = useCallback((value) => setSignals((current) => ({ ...current, callerSummary: value })), []);

  async function submitIntake() {
    setError(null);
    setBusy(true);
    try {
      const payload = await api.post('/api/cases', {
        unitId,
        channel: 'voice',
        reporterPhone: user.phone,
        signals: { ...signals, affectedUnits: Number(signals.affectedUnits) || 1 },
      });
      clearInterval(timer.current);
      setCaseDoc(payload.case);
      setPhase(PHASE.RESULT);
      setMine((current) => [payload.case, ...current]);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new Error(failure.message));
    } finally {
      setBusy(false);
    }
  }

  const mutate = useCallback((next) => {
    setCaseDoc(next);
    setMine((current) => current.map((item) => (item._id === next._id ? next : item)));
  }, []);

  async function acknowledge(scriptId) {
    setError(null);
    setBusy(true);
    try {
      mutate((await api.post(`/api/cases/${caseDoc._id}/mitigation/acknowledge`, { scriptId })).case);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(scriptId, stepId) {
    setError(null);
    setBusy(true);
    try {
      mutate((await api.post(`/api/cases/${caseDoc._id}/mitigation/steps`, { scriptId, stepId })).case);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  const sortedMine = useMemo(() => [...mine].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [mine]);

  if (loading || !user) return <Spinner label="Opening the emergency line" />;

  return (
    <div className="space-y-5">
      <CallChrome
        phase={phase}
        seconds={seconds}
        unitLabel={unitLabel}
        onStart={() => setPhase(PHASE.LIVE)}
      />

      {!unitId ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your account is not linked to a unit yet, so a call cannot be raised. Sign out and register with your unit, or ask the
          building dispatcher to link it.
        </p>
      ) : null}

      {phase === PHASE.LIVE ? (
        <IntakeForm
          signals={signals}
          onChange={change}
          onSummaryChange={changeSummary}
          onSubmit={submitIntake}
          busy={busy}
          errorSlot={<ErrorNote error={error} />}
        />
      ) : null}

      {phase === PHASE.RESULT && caseDoc ? (
        <div className="space-y-5">
          <TriagePanel triage={caseDoc.triage} />

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">While you wait</h2>
            <MitigationGuide case={caseDoc} scripts={scripts} onAcknowledge={acknowledge} onConfirm={confirm} busy={busy} />
          </section>

          <EvidenceUploader caseId={caseDoc._id} onUploaded={mutate} onBusyChange={setBusy} />

          <div className="flex flex-wrap gap-3">
            <Link href={`/cases/${caseDoc._id}`} className="btn-ghost flex-1">
              Open the full case record
            </Link>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                setPhase(PHASE.IDLE);
                setSeconds(0);
                setSignals(EMPTY_SIGNALS);
                setCaseDoc(null);
                setError(null);
              }}
            >
              Report another problem
            </button>
          </div>
        </div>
      ) : null}

      {phase === PHASE.IDLE && caseDoc === null ? (
        <p className="card p-4 text-sm text-slate-600">
          Start a call when water is where it should not be. The agent asks thirteen fixed questions, grades the call against the
          ruleset, and tells you which valve to turn before a contractor is on the way.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Your cases</h2>
        {error && phase !== PHASE.LIVE ? <ErrorNote error={error} /> : null}
        {sortedMine.length === 0 ? (
          <p className="card p-4 text-sm text-slate-600">No calls have been raised from this account yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sortedMine.map((item) => (
              <li key={item._id}>
                <CaseCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
