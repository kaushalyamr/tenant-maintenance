import './globals.css';

import { Shell } from '@/components/Shell';

export const metadata = {
  title: 'Triage Dispatch — tenant maintenance',
  description:
    'Emergency tenant calls triaged against a versioned ruleset, with guided shutoff steps and licensed contractor dispatch.',
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
