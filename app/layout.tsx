import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/web/src/App.css';

export const metadata: Metadata = {
  title: 'A-SYNCH — Ask the team, even when they are away',
  description: 'Get a source-backed situation brief or speak directly with a teammate context agent.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
