'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ErrorNote } from '@/components/Shell';
import { ApiError, api } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';

const DEMO = [
  ['Tenant — Nimali Perera', 'nimali@greenmeadows.test'],
  ['Dispatcher — Dilhani J.', 'dispatcher@greenmeadows.test'],
  ['Contractor — Rapid Reroute', 'desk@rapidreroute.test'],
  ['Admin', 'admin@greenmeadows.test'],
];
const DEMO_PASSWORD = 'tenant1234';

export default function LoginPage() {
  const { user, signIn, signUp } = useSession();
  const [mode, setMode] = useState('signin');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '', unitId: '' });

  useEffect(() => {
    if (user) window.location.href = homeFor(user);
  }, [user]);

  useEffect(() => {
    if (mode !== 'register') return;
    api
      .get('/api/units')
      .then((payload) => setUnits(payload.units))
      .catch((failure) => setError(failure));
  }, [mode]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const groupedUnits = useMemo(() => {
    const map = new Map();
    for (const unit of units) {
      const name = unit.property?.name ?? 'Unknown property';
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(unit);
    }
    return [...map.entries()];
  }, [units]);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(form.email.trim(), form.password);
      else await signUp({ ...form, email: form.email.trim(), unitId: form.unitId });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new Error(failure.message));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex rounded-xl bg-slate-100 p-1">
        {['signin', 'register'].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={`min-h-10 flex-1 rounded-lg text-sm font-semibold transition ${
              mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {value === 'signin' ? 'Sign in' : 'New tenant account'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="card space-y-3 p-4">
        {mode === 'register' ? (
          <>
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" className="input" value={form.name} onChange={set('name')} required minLength="2" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <input id="phone" className="input" value={form.phone} onChange={set('phone')} required placeholder="+94 71 442 8890" />
            </div>
            <div>
              <label className="label" htmlFor="unit">Your unit</label>
              <select id="unit" className="input" value={form.unitId} onChange={set('unitId')} required>
                <option value="">Select the unit you live in</option>
                {groupedUnits.map(([property, rows]) => (
                  <optgroup key={property} label={property}>
                    {rows.map((unit) => (
                      <option key={unit._id} value={unit._id}>
                        {unit.label} · {unit.zone}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </>
        ) : null}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={form.email} onChange={set('email')} required autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            value={form.password}
            onChange={set('password')}
            required
            minLength={mode === 'signin' ? 8 : 10}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder={mode === 'register' ? 'At least 10 characters' : undefined}
          />
        </div>

        <ErrorNote error={error} />

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <section className="card p-4">
        <h2 className="text-sm font-bold text-slate-900">Demo logins</h2>
        <p className="mt-1 text-xs text-slate-500">
          Seeded by <code className="font-mono">npm run seed</code>. Password for all of them: <code className="font-mono">{DEMO_PASSWORD}</code>.
        </p>
        <ul className="mt-3 space-y-2">
          {DEMO.map(([label, email]) => (
            <li key={email}>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, email, password: DEMO_PASSWORD }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-brand-500 hover:bg-brand-50"
              >
                <span className="block text-xs font-semibold text-slate-700">{label}</span>
                <span className="block font-mono text-[11px] text-slate-500">{email}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Contractor desks: <code className="font-mono">desk@rapidreroute.test</code>,{' '}
          <code className="font-mono">dispatch@drainworks.test</code>, <code className="font-mono">sos@metroemergency.test</code> and{' '}
          <code className="font-mono">orders@oldtown.test</code>. Tenants <code className="font-mono">farhan@</code>,{' '}
          <code className="font-mono">amara@</code>, <code className="font-mono">kasun@</code> and <code className="font-mono">priya@</code>{' '}
          all use <code className="font-mono">greenmeadows.test</code>.
        </p>
      </section>

      <p className="text-center text-xs text-slate-500">
        <Link href="/" className="underline">Back to the overview</Link>
      </p>
    </div>
  );
}
