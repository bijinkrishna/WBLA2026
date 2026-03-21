'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import {
  LayoutDashboard,
  Building2,
  ListChecks,
  GanttChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cells', label: 'Cells', icon: Building2 },
  { href: '/activities', label: 'Activities', icon: ListChecks },
  { href: '/gantt', label: 'Gantt Chart', icon: GanttChart },
  { href: '/settings', label: 'Election Dates', icon: Settings },
];

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleNavClick = () => {
    onMobileClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {onMobileClose && (
        <div
          className={cn(
            'lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-brand-500 text-white z-50 flex flex-col transition-all duration-300',
          collapsed ? 'w-[68px]' : 'w-[260px]',
          // Mobile: drawer behavior
          onMobileClose && !mobileOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile close button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden absolute top-4 right-4 p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Ashoka Chakra inspired icon */}
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 rounded-full border-2 border-saffron-400 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-saffron-400" />
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-sm leading-tight tracking-wide">WBLA 2026</h1>
              <p className="text-[11px] text-white/60 leading-tight mt-0.5">Paschim Medinipur</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon size={20} className="flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only when in overlay mode) + Logout */}
      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-sm transition-all',
            onMobileClose && 'hidden lg:flex'
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-red-500/20 hover:text-red-200 text-sm transition-all"
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 pb-4 text-[10px] text-white/30 leading-relaxed">
          District Election Office<br />
          Paschim Medinipur, WB<br />
          <span className="text-white/20">v{process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0'}</span>
        </div>
      )}
    </aside>
    </>
  );
}
