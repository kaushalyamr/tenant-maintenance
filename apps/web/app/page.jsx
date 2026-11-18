'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Spinner } from '@/components/Shell';
import { homeFor, useSession } from '@/lib/session';

const STEPS = [
  {
    title: 'Tell us which unit is calling',
    body: 'Register with your name, phone and unit. The address, zone and building are already on file, so there is nothing else to type.',
  },
  {
    title: 'Answer six plain questions',
    body: 'Is water spraying, where is it coming from, is anyone at risk. No jargon, no hold music, no guessing at what the call centre needs.',
  },
  {
    title: 'Do the right thing next',
    body: 'The shutoff script is specific to your home, with one step at a time and a confirmation before the next. The result you should see is spelled out.',
  },
  {
    title: 'We send a licensed contractor',
    body: 'A burst pipe is dispatched straight away. Anything smaller is scheduled. Either way you can see who is coming and what happens next.',
  },
];

const SETUP = [
  {
    label: 'Create your account',
    time: '2 minutes',
    body: 'Email, phone, password and the unit you live in. Your account is tied to that unit, so the next call already knows where you are.',
  },
  {
    label: 'Check your shutoff points',
    time: '1 minute',
    body: 'Your unit page shows where the water and power isolators are. Look at them once now, while the floor is dry.',
  },
  {
    label: 'Save the line',
    time: '30 seconds',
    body: 'Bookmark this site on your phone. If water starts moving, the call screen is one tap away, with no app to install.',
  },
];

const PERSONAS = [
  {
    title: 'For tenants',
    body: 'One place to report a water problem, follow the shutoff steps and track the repair without calling the building manager at midnight.',
    points: ['No app install', 'Photos attached to the case', 'Full history in one place'],
  },
  {
    title: 'For property teams',
    body: 'A live board of emergencies, a compliance filter that refuses unlicensed or uninsured firms, and an audit trail for every decision.',
    points: ['Explainable P1–P4 grades', 'Licence and insurance checks', 'Every action logged'],
  },
  {
    title: 'For contractors',
    body: 'Work orders that match your trade and coverage, with the evidence already attached so the first visit is the right visit.',
    points: ['Accept or decline in one tap', 'Capacity-aware offers', 'Close-out with a record'],
  },
];

const FEATURES = [
  ['Deterministic triage', 'A versioned ruleset grades every call P1–P4 and names the rules that fired, so a decision can be defended later.'],
  ['Guided shutoff', 'Step-by-step scripts with per-step confirmation and the result the caller must watch for. Out-of-order taps are refused.'],
  ['Compliance-aware dispatch', 'Expired licences, lapsed insurance, full capacity and slow responders are removed before a name is offered.'],
  ['Human fallback', 'Low confidence, an unknown classification or a P1 goes to a dispatcher instead of being guessed at.'],
];

const FAQ = [
  ['Do I need to install anything?', 'No. The emergency line runs in the browser on your phone or laptop. Sign in, pick your unit and start the call.'],
  ['What counts as an emergency?', 'Spraying or pooling water, water near electrics, a sewage backup and a burst supply line are treated as P1. A slow drip is scheduled.'],
  ['What happens if the system is unsure?', 'The case is handed to a human dispatcher with the answers and evidence attached. It is never dispatched on a guess.'],
  ['Who can see my photos?', 'Only the people assigned to your case: you, the dispatch team and the contractor who accepts the work order.'],
];

function Icon({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function Home() {
  const { user, loading } = useSession();

  useEffect(() => {
    if (user) window.location.href = homeFor(user);
  }, [user]);

  if (loading) return <Spinner label="Checking your session" />;
  if (user) return null;

  return (
    <div className="space-y-10 pb-4">
      <section className="relative overflow-hidden rounded-3xl bg-brand-900 text-white shadow-lg shadow-brand-900/10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />

        <div className="relative grid gap-9 px-5 py-9 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:py-12">
          <div>
            <span className="chip bg-white/10 text-brand-100 ring-1 ring-white/20">Tenant emergency line · working demo</span>
            <h1 className="mt-4 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl">
              Standing water should not wait for office hours.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-100">
              Triage Dispatch takes the call, works out whether it is a burst pipe or a slow leak, walks you through the shutoff,
              keeps the photo evidence and sends a contractor whose licence and insurance still check out.
            </p>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/login?mode=register" className="btn bg-white text-brand-900 hover:bg-brand-50">
                Create a tenant account
              </Link>
              <Link href="/login" className="btn border border-white/30 text-white hover:bg-white/10">
                Explore the demo workspace
              </Link>
            </div>

            <dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/15 pt-5 text-sm sm:grid-cols-4">
              {[
                ['P1–P4', 'in one call'],
                ['100%', 'rules explained'],
                ['Vetted', 'licence and insurance'],
                ['Kept', 'photo evidence'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-lg font-bold text-white">{value}</dt>
                  <dd className="text-[11px] leading-snug text-brand-100">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl bg-white/10 p-2 ring-1 ring-white/20 backdrop-blur">
            <div className="rounded-xl bg-white p-4 text-slate-900 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Live call · Unit 4B</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">Kitchen supply line</p>
                </div>
                <span className="chip bg-rose-100 text-rose-700">P1 emergency</span>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <div className="flex items-end justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Burst pipe</span>
                  <span className="text-xs font-bold text-brand-700">88% confidence</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[88%] rounded-full bg-brand-600" />
                </div>
                <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    Water spraying near a socket <span className="ml-auto font-mono text-[10px] text-slate-400">r-socket</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    Spreading across the floor <span className="ml-auto font-mono text-[10px] text-slate-400">r-spread</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    No single shutoff found <span className="ml-auto font-mono text-[10px] text-slate-400">r-valve</span>
                  </li>
                </ul>
              </div>

              <div className="mt-3 space-y-2 text-[11px] font-medium text-slate-600">
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Shutoff guided · 3 of 4 steps confirmed
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Rapid Reroute · licence and insurance valid
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-it-works">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">How it works</p>
            <h2 id="how-it-works" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              From a panicked call to a booked repair
            </h2>
          </div>
          <p className="max-w-sm text-sm text-slate-600">Four steps, no forms to chase and no number to remember.</p>
        </div>

        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
                {index + 1}
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Onboarding</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Ready before the first emergency</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Set your account up while the floor is dry. It takes less than five minutes and means the next call starts with the
            right unit, the right address and the right person.
          </p>
        </div>

        <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
          {SETUP.map((step) => (
            <div key={step.label} className="bg-white p-5 sm:p-6">
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-100">{step.time}</span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">{step.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-slate-600">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-brand-700 underline">
              Sign in to your unit
            </Link>
          </p>
          <Link href="/login?mode=register" className="btn-primary">
            Start onboarding
          </Link>
        </div>
      </section>

      <section aria-labelledby="who-it-is-for">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Who it is for</p>
        <h2 id="who-it-is-for" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          One emergency line, three points of view
        </h2>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {PERSONAS.map((persona) => (
            <article key={persona.title} className="card flex flex-col p-5">
              <h3 className="text-sm font-bold text-slate-900">{persona.title}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{persona.body}</p>
              <ul className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-xs text-slate-600">
                {persona.points.map((point) => (
                  <li key={point} className="flex items-center gap-2">
                    <Icon>
                      <path d="m5 12 4 4L19 6" />
                    </Icon>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="behind-the-call" className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Behind the call</p>
          <h2 id="behind-the-call" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            A decision you can defend afterwards
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Every grade comes with the rules that produced it, a confidence score and an audit trail. Nothing is sent to a
            contractor on a hunch.
          </p>
          <Link href="/login?mode=register" className="btn-ghost mt-4">
            Create your account
          </Link>
        </div>

        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {FEATURES.map(([title, body]) => (
            <li key={title} className="flex gap-3 p-4">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <Icon>
                  <path d="M12 3v18M5 8l7-5 7 5v8l-7 5-7-5V8Z" />
                </Icon>
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq" className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Before you start</p>
          <h2 id="faq" className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Common questions
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Just evaluating the project? Open the{' '}
            <Link href="/login" className="font-semibold text-brand-700 underline">
              demo workspace
            </Link>{' '}
            and use one of the seeded sign-ins. No account needed.
          </p>
        </div>

        <div className="space-y-2">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="group rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                {question}
                <span aria-hidden="true" className="text-lg leading-none text-slate-400 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl bg-brand-700 px-5 py-8 text-white sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Set your unit up now, while it is dry.</h2>
            <p className="mt-1 max-w-xl text-sm text-brand-100">
              Registration is free, takes two minutes and makes the next water call start in the right place.
            </p>
          </div>
          <Link href="/login?mode=register" className="btn shrink-0 bg-white text-brand-900 hover:bg-brand-50">
            Create a tenant account
          </Link>
        </div>
      </section>
    </div>
  );
}
