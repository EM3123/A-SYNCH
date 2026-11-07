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
      <head>
        {/* The design's three faces: editorial serif, readable sans, telemetry mono. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <meta name="theme-color" content="#030F18" />
      </head>
      <body>{children}</body>
    </html>
  );
}
