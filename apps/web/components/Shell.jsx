'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ApiError } from '@/lib/api';
import { SessionProvider, useSession } from '@/lib/session';

const NAV = [
  { href: '/call', label: 'Call', roles: ['tenant'] },
  { href: '/dashboard', label: 'Board', roles: ['dispatcher', 'admin'] },
  { href: '/jobs', label: 'My jobs', roles: ['contractor'] },
  { href: '/cases', label: 'Cases', roles: ['dispatcher', 'admin', 'tenant'] },
];

function Chrome({ children }) {
  const { user, signOut } = useSession();
  const pathname = usePathname();

  const links = NAV.filter((item) => user && item.roles.includes(user.role) && item.href !== pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
              TD
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-slate-900">Triage Dispatch</span>
              <span className="block text-[11px] text-slate-500">burst pipe or minor leak?</span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1.5">
            {links.map((item) => (
              <Link key={item.href} href={item.href} className="btn-ghost !min-h-10 px-3 text-xs">
                {item.label}
              </Link>
            ))}
            {user ? (
              <button
                type="button"
                onClick={() => signOut()}
                className="btn-ghost !min-h-10 px-3 text-xs"
                title={`${user.name} · ${user.role}`}
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className="btn-primary !min-h-10 px-3 text-xs">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-5">{children}</main>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
        Ruleset triage-v1 · every classification is explainable and every action is logged
      </footer>
    </div>
  );
}

export function Shell({ children }) {
  return <SessionProvider>{children ? <Chrome>{children}</Chrome> : null}</SessionProvider>;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  const details = error instanceof ApiError ? error.details : null;
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
      <p className="font-semibold">{error instanceof ApiError ? error.message : String(error)}</p>
      {Array.isArray(details) && details.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          {details.map((detail) => (
            <li key={detail.field}>
              <span className="font-mono">{detail.field}</span>: {detail.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
