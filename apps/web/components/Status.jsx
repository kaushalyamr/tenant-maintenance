import { severityStyles, statusLabel } from '@/lib/api';

export function Severity({ severity, windowMinutes }) {
  return (
    <span className={`chip ${severityStyles(severity)}`}>
      {severity}
      {windowMinutes ? <span className="font-normal">· {formatWindow(windowMinutes)}</span> : null}
    </span>
  );
}

export function StatusChip({ status }) {
  const tone =
    status === 'closed'
      ? 'bg-slate-100 text-slate-600'
      : status === 'in_progress' || status === 'dispatched'
        ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-100'
        : 'bg-white text-slate-700 ring-1 ring-slate-300';
  return <span className={`chip ${tone}`}>{statusLabel(status)}</span>;
}

export function EscalatedChip() {
  return (
    <span className="chip bg-violet-100 text-violet-800 ring-1 ring-violet-300" title="Auto-escalated to a human dispatcher">
      Human review
    </span>
  );
}

export function Confidence({ value }) {
  const percent = Math.round(value * 100);
  const tone = percent >= 80 ? 'bg-brand-500' : percent >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-600">Engine confidence</span>
        <span className="tabular-nums text-slate-500">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${percent} percent confidence`}>
        <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function formatWindow(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}
