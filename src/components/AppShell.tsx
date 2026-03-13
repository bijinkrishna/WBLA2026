'use client';

import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="ml-[260px] transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
