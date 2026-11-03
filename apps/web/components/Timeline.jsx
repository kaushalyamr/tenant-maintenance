const LABELS = {
  'case.created': 'Call opened',
  'triage.completed': 'Triaged by the engine',
  'triage.reassessed': 'Re-triaged after new evidence',
  'triage.compared': 'Classification compared',
  'mitigation.acknowledged': 'Safety guidance accepted',
  'mitigation.step_done': 'Step confirmed by the caller',
  'mitigation.result_observed': 'Result observed by the caller',
  'evidence.added': 'Evidence recorded',
  'case.escalated': 'Escalated to a human',
  'case.triage': 'Case triaged',
  'case.start_mitigation': 'Caller guidance started',
  'case.dispatch': 'Contractor dispatched',
  'case.accept_job': 'Contractor accepted the job',
  'case.withdraw': 'Dispatch withdrawn',
  'case.resolve': 'Work reported complete',
  'case.reopen': 'Work reopened',
  'case.close': 'Case closed',
  'case.cancel': 'Case cancelled',
};

function describe(event) {
  const data = event.data ?? {};
  switch (event.type) {
    case 'triage.completed':
    case 'triage.reassessed':
      return `${data.classification?.replaceAll('_', ' ')} · ${data.severity} · ${Math.round((data.confidence ?? 0) * 100)}% confidence · rules ${data.matchedRuleIds?.join(', ')}`;
    case 'triage.compared':
      return `${data.before} → ${data.after}`;
    case 'mitigation.acknowledged':
      return `Script ${data.scriptId}`;
    case 'mitigation.step_done':
    case 'mitigation.result_observed':
      return `“${data.instruction}”`;
    case 'evidence.added':
      return `${data.kind} · ${Math.round((data.bytes ?? 0) / 1024)} KB · sha256 ${String(data.sha256).slice(0, 12)}… · ${data.description}`;
    case 'case.escalated':
      return data.reason;
    case 'case.dispatch':
      return `${data.contractorName} due by ${data.dueAt ? new Date(data.dueAt).toLocaleString() : '—'}`;
    case 'case.accept_job':
    case 'case.withdraw':
      return `Job ${data.jobId?.slice(-6)}${data.reason ? ` · ${data.reason}` : ''}`;
    case 'case.created':
      return `Unit ${data.unit} (${data.zone}) · ${data.channel} · “${data.summary ?? 'no summary'}”`;
    case 'case.cancel':
      return data.reason;
    default:
      return data.to ? `${data.from ?? ''} → ${data.to}` : null;
  }
}

export function Timeline({ events }) {
  if (!events?.length) return <p className="text-sm text-slate-500">Nothing logged yet.</p>;

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {events.map((event, index) => (
        <li key={event._id ?? index} className="relative">
          <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
          <p className="text-sm font-semibold text-slate-800">{LABELS[event.type] ?? event.type}</p>
          {describe(event) ? <p className="mt-0.5 text-xs break-words text-slate-600">{describe(event)}</p> : null}
          <p className="mt-0.5 text-[11px] text-slate-400">
            {new Date(event.at).toLocaleString()} · {event.actor?.name ?? 'system'} ({event.actor?.role ?? 'system'})
          </p>
        </li>
      ))}
    </ol>
  );
}
