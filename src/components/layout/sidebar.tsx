'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Search, Users, Settings, LogOut, Keyboard, Command } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: '1' },
  { href: '/topics', label: 'Topics', icon: FolderKanban, shortcut: '2' },
  { href: '/search', label: 'Search', icon: Search, shortcut: '3' },
  { href: '/contacts', label: 'Contacts', icon: Users, shortcut: '4' },
  { href: '/settings', label: 'Settings', icon: Settings, shortcut: '5' },
];

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case '1': router.push('/dashboard'); break;
        case '2': router.push('/topics'); break;
        case '3': router.push('/search'); break;
        case '4': router.push('/contacts'); break;
        case '5': router.push('/settings'); break;
        case '?': setShowShortcuts(prev => !prev); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">TopicOS</h1>
          <p className="text-xs text-gray-400 mt-0.5">Search-first productivity</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </div>
                <kbd className={cn(
                  'hidden group-hover:inline-block text-[10px] px-1.5 py-0.5 rounded border font-mono',
                  isActive ? 'border-blue-200 text-blue-500' : 'border-gray-200 text-gray-400'
                )}>{item.shortcut}</kbd>
              </Link>
            );
          })}
        </nav>

        {/* Keyboard shortcuts hint */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowShortcuts(prev => !prev)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Keyboard className="w-3 h-3" />
            Press ? for shortcuts
          </button>
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <span className="text-sm text-gray-600 truncate block">{user.email}</span>
            </div>
            <button onClick={handleLogout} className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-96 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Command className="w-5 h-5" /> Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-gray-600 text-lg">
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Navigation</p>
              {navItems.map(item => (
                <div key={item.href} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <item.icon className="w-4 h-4 text-gray-400" />
                    {item.label}
                  </span>
                  <kbd className="text-xs px-2 py-1 bg-gray-100 border border-gray-200 rounded font-mono text-gray-600">{item.shortcut}</kbd>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">General</p>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700">Toggle shortcuts</span>
                  <kbd className="text-xs px-2 py-1 bg-gray-100 border border-gray-200 rounded font-mono text-gray-600">?</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
