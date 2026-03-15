import type { Metadata } from 'next';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'WBLA 2026 | Paschim Medinipur',
  description: 'District Election Activity Tracking System - Paschim Medinipur, West Bengal Legislative Assembly Elections 2026',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
