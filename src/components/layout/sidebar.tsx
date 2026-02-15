'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, Search, Users, Settings, LogOut, Keyboard, Command, Sparkles } from 'lucide-react';
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

function getInitials(email: string): string {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(email: string): string {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-indigo-500', 'bg-cyan-500',
    'bg-teal-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

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
        case 'Escape': setShowShortcuts(false); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const initials = getInitials(user.email || 'U');
  const avatarColor = getAvatarColor(user.email || '');

  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo / Brand */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 brand-gradient rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold brand-gradient-text tracking-tight leading-tight">TopicOS</h1>
              <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">Search-First Productivity</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-600 rounded-r-full" />
                  )}
                  <item.icon className={cn('w-[18px] h-[18px]', isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600')} />
                  {item.label}
                </div>
                <kbd className={cn(
                  'hidden group-hover:inline-block text-[10px] px-1.5 py-0.5 rounded-md border font-mono',
                  isActive ? 'border-blue-200 text-blue-400 bg-blue-50' : 'border-gray-200 text-gray-400 bg-gray-50'
                )}>{item.shortcut}</kbd>
              </Link>
            );
          })}
        </nav>

        {/* Keyboard shortcuts hint */}
        <div className="px-3 pb-2 border-t border-gray-100 pt-2">
          <button
            onClick={() => setShowShortcuts(prev => !prev)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Keyboard className="w-3 h-3" />
            Press ? for shortcuts
          </button>
        </div>

        {/* User section */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold', avatarColor)}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
            </div>
            <button onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-96 p-6 border border-gray-100 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Command className="w-4 h-4 text-gray-600" />
                </div>
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Navigation</p>
              {navItems.map(item => (
                <div key={item.href} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700 flex items-center gap-2.5">
                    <item.icon className="w-4 h-4 text-gray-400" />
                    {item.label}
                  </span>
                  <kbd className="text-xs px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg font-mono text-gray-600 shadow-sm">{item.shortcut}</kbd>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 mt-3">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">General</p>
                <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700">Toggle shortcuts</span>
                  <kbd className="text-xs px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg font-mono text-gray-600 shadow-sm">?</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
