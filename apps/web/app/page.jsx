'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Spinner } from '@/components/Shell';
import { homeFor, useSession } from '@/lib/session';

export default function Home() {
  const { user, loading } = useSession();

  useEffect(() => {
    if (user) window.location.href = homeFor(user);
  }, [user]);

  if (loading) return <Spinner label="Checking your session" />;
  if (user) return null;

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-brand-700 px-5 py-8 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-100">Tenant maintenance</p>
          <h1 className="mt-2 text-3xl leading-tight font-bold">Triage &amp; dispatch for emergency water calls</h1>
          <p className="mt-2 text-sm text-brand-100">
            Takes the call, separates a burst pipe from a minor leak, walks the tenant through the shutoff valve, keeps the
            photo evidence, and books a contractor whose licence and insurance are still valid.
          </p>
          <Link href="/login" className="btn mt-4 w-full bg-white text-brand-900 hover:bg-brand-50">
            Sign in
          </Link>
        </div>

        <ul className="divide-y divide-slate-200">
          {[
            ['Deterministic triage', 'A versioned ruleset grades every call P1–P4 with the rules that fired, so a decision can be defended.'],
            ['Guided shutoff', 'Step-by-step scripts with per-step confirmation, including the result the caller must watch for.'],
            ['Compliance-aware dispatch', 'Expired licences, lapsed insurance, full capacity and slow responders are removed before a name is offered.'],
            ['Human fallback', 'Low confidence, an unknown classification or a P1 goes to a dispatcher instead of being guessed at.'],
          ].map(([title, body]) => (
            <li key={title} className="p-5">
              <h2 className="text-sm font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-slate-500">
        Need an account? <Link href="/login" className="font-semibold text-brand-700 underline">Sign in and register a unit</Link>.
      </p>
    </div>
  );
}
