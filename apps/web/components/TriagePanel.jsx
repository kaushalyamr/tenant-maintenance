import { humanList } from '@/lib/api';
import { Confidence, Severity } from './Status';

const PLAIN = {
  burst_pipe: 'A supply line has failed. Water is under pressure, so the building must be isolated now.',
  active_leak: 'Water is escaping faster than it can be contained, but not under full pressure.',
  slow_leak: 'Water is escaping slowly. It needs a plumber, but it is not an emergency.',
  sewage_backup: 'Foul water is coming back up. This is a health hazard, not a leak.',
  electrical_hazard: 'Water and electricity are in the same place. Isolate power before touching anything.',
  not_water: 'This is not a water emergency. It goes to the routine maintenance queue.',
  life_safety: 'Gas or smoke was reported. Evacuate and call emergency services first.',
  unknown: 'The answers are not enough to classify this call automatically.',
};

export function TriagePanel({ triage }) {
  if (!triage) return null;

  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Severity severity={triage.severity} windowMinutes={triage.dispatchWindowMinutes} />
        <span className="chip bg-slate-100 text-slate-700">{triage.version}</span>
        {triage.escalateToHuman ? (
          <span className="chip bg-violet-100 text-violet-800">Sent to a human dispatcher</span>
        ) : (
          <span className="chip bg-brand-50 text-brand-900">Automated decision</span>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold capitalize text-slate-900">{triage.classification.replaceAll('_', ' ')}</h2>
        <p className="text-sm text-slate-600">{PLAIN[triage.classification]}</p>
      </div>

      <Confidence value={triage.confidence} />

      <div>
        <p className="label">Why the engine decided this</p>
        <ul className="space-y-2">
          {triage.reasons.map((reason) => (
            <li key={reason.ruleId} className="text-sm text-slate-700">
              <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                {reason.ruleId}
              </span>
              {reason.text}
            </li>
          ))}
        </ul>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold text-slate-500">Contractor trades needed</dt>
          <dd className="capitalize text-slate-800">{humanList(triage.requiredTrades)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">On site within</dt>
          <dd className="text-slate-800 tabular-nums">{triage.dispatchWindowMinutes} minutes</dd>
        </div>
      </dl>

      {triage.followUpQuestions?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Ask the caller</p>
          <ul className="mt-1.5 space-y-1.5 text-sm text-amber-900">
            {triage.followUpQuestions.map((question) => (
              <li key={question}>· {question}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
