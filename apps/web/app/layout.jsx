import './globals.css';

import { Shell } from '@/components/Shell';

export const metadata = {
  title: 'Triage Dispatch — emergency maintenance for rental homes',
  description:
    'Turn a tenant water call into a licensed repair: deterministic P1–P4 triage, guided shutoff steps, photo evidence and compliance-checked dispatch.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
