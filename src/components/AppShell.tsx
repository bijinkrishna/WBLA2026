'use client';

import Sidebar from '@/components/Sidebar';
import { useState } from 'react';
import { Menu } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 right-0 left-0 h-14 bg-white border-b border-gray-200 z-40 flex items-center gap-3 px-4">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="font-semibold text-gray-900 truncate">WBLA 2026</span>
      </div>
      <main className="pt-14 lg:pt-0 lg:ml-[260px] transition-all duration-300 min-h-screen">
        {children}
      </main>
    </div>
  );
}
