import Link from 'next/link';

import { minutesSince } from '@/lib/api';
import { Confidence } from './Status';
import { EscalatedChip, Severity, StatusChip } from './Status';

export function CaseCard({ item }) {
  const unit = item.unit?.label ?? '—';
  const property = item.property?.name ?? '';
  const classification = item.triage?.classification?.replaceAll('_', ' ') ?? 'untitled';

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {item.triage?.severity ? <Severity severity={item.triage.severity} windowMinutes={item.triage.dispatchWindowMinutes} /> : null}
        <StatusChip status={item.status} />
        {item.triage?.escalateToHuman ? <EscalatedChip /> : null}
        <span className="ml-auto font-mono text-[11px] text-slate-400">{item.reference}</span>
      </div>

      <h3 className="mt-3 text-base font-bold capitalize text-slate-900">{classification}</h3>
      <p className="text-sm text-slate-600">
        {unit}
        {property ? ` · ${property}` : ''} · reported by {item.reportedByName}
      </p>
      {item.intake?.callerSummary ? (
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">“{item.intake.callerSummary}”</p>
      ) : null}

      {typeof item.triage?.confidence === 'number' ? (
        <div className="mt-3">
          <Confidence value={item.triage.confidence} />
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          {item.evidence?.length ? `${item.evidence.length} evidence item${item.evidence.length > 1 ? 's' : ''} · ` : ''}
          {item.mitigation?.length ? `${item.mitigation.length} script${item.mitigation.length > 1 ? 's' : ''} opened · ` : ''}
          {minutesSince(item.createdAt)}
        </span>
        <Link href={`/cases/${item._id}`} className="btn-ghost !min-h-10 px-3 text-xs">
          Open
        </Link>
      </div>
    </article>
  );
}
