'use client';

// What the caller has to attest to: 'done' is an action, 'observed' is a result
// they watched for — the second one is the evidence a claim rests on.
const SEEN_LABEL = {
  done: 'Action confirmed by the caller',
  observed: 'Result seen by the caller',
};

function StepRow({ step, recorded, disabled, onConfirm, busy }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
          recorded ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}
        aria-hidden="true"
      >
        {recorded ? '✓' : '·'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800">{step.instruction}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {SEEN_LABEL[step.confirmation]}
          {recorded ? ` · recorded ${new Date(recorded.confirmedAt).toLocaleTimeString()} by ${recorded.confirmedBy?.name}` : ''}
        </p>
      </div>
      {!recorded ? (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => onConfirm(step.id)}
          className="btn-ghost !min-h-9 shrink-0 px-3 text-xs"
        >
          {step.confirmation === 'observed' ? 'I can see it' : 'Done'}
        </button>
      ) : null}
    </li>
  );
}

export function MitigationGuide({ case: caseDoc, scripts, onAcknowledge, onConfirm, busy }) {
  const recommended = caseDoc.triage?.mitigationScriptIds ?? [];
  if (!recommended.length) {
    return <p className="text-sm text-slate-500">No immediate safety guidance was recommended for this call.</p>;
  }

  return (
    <div className="space-y-4">
      {recommended.map((scriptId) => {
        const script = scripts.find((candidate) => candidate.id === scriptId);
        if (!script) return null;
        const opened = caseDoc.mitigation?.find((entry) => entry.scriptId === scriptId);

        return (
          <section key={scriptId} className="card overflow-hidden">
            <header className="border-b border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900">{script.title}</h3>
              <p className="mt-1 text-xs text-slate-600">{script.acknowledgement}</p>
            </header>

            {!opened ? (
              <div className="p-4">
                <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => onAcknowledge(scriptId)}>
                  I accept — walk me through it
                </button>
              </div>
            ) : (
              <ol className="space-y-2 p-4">
                {script.steps.map((step, index) => {
                  const recorded = opened.steps.find((entry) => entry.stepId === step.id);
                  const previousMissing = index > 0 && !opened.steps.some((entry) => entry.stepId === script.steps[index - 1].id);
                  return (
                    <StepRow
                      key={step.id}
                      step={step}
                      recorded={recorded}
                      disabled={previousMissing || busy}
                      onConfirm={(stepId) => onConfirm(scriptId, stepId)}
                      busy={busy}
                    />
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
