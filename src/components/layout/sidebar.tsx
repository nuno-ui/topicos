'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, Search, Users, Settings,
  LogOut, Keyboard, Command, Sparkles, Inbox,
  PanelLeftClose, PanelLeftOpen, Menu, X
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

/** Mobile hamburger button -- rendered outside the sidebar, visible only on small screens */
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-3 left-3 z-40 md:hidden p-2 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
      aria-label="Open navigation menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Collapsed state persisted in localStorage
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Memoized avatar color and initials
  const initials = useMemo(() => getInitials(user.email || 'U'), [user.email]);
  const avatarColor = useMemo(() => getAvatarColor(user.email || ''), [user.email]);

  // Fetch follow-up count for contacts badge
  useEffect(() => {
    const fetchFollowUpCount = async () => {
      try {
        const supabase = createClient();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gt('interaction_count', 0)
          .lt('last_interaction_at', thirtyDaysAgo);
        setFollowUpCount(count || 0);
      } catch { /* ignore */ }
    };
    fetchFollowUpCount();
    const interval = setInterval(fetchFollowUpCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user.id]);

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

  // ---------- Focus trapping for shortcuts modal ----------
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showShortcuts) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableSelector =
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));

    // Focus the first focusable element when modal opens
    const focusable = getFocusable();
    if (focusable.length > 0) focusable[0].focus();

    const handleTrap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const elements = getFocusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTrap);
    return () => document.removeEventListener('keydown', handleTrap);
  }, [showShortcuts]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

  // ---------- Shared sidebar content ----------
  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo / Brand */}
      <div className={cn('p-5 pb-4', collapsed && !isMobile && 'px-3 py-4')}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 brand-gradient rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-extrabold brand-gradient-text tracking-tight leading-tight">TopicOS</h1>
              <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">Search-First Productivity</p>
            </div>
          )}
          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 px-3 space-y-0.5', collapsed && !isMobile && 'px-2')}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const showCollapsed = collapsed && !isMobile;
          return (
            <div key={item.href} className="relative group/nav">
              <Link
                href={item.href}
                onClick={() => isMobile && setMobileOpen(false)}
                className={cn(
                  'flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
                  showCollapsed ? 'justify-center px-0' : 'justify-between',
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm border-l-[3px]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-[3px] border-transparent'
                )}
                style={isActive ? { borderImage: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) 1' } : undefined}
              >
                <div className={cn('flex items-center', showCollapsed ? 'gap-0' : 'gap-3')}>
                  <item.icon className={cn(
                    'w-[18px] h-[18px] flex-shrink-0',
                    isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  )} />
                  {!showCollapsed && (
                    <>
                      {item.label}
                      {item.href === '/contacts' && followUpCount > 0 && (
                        <span
                          className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full font-bold min-w-[18px] text-center leading-tight cursor-default"
                          title={followUpCount > 9 ? `${followUpCount} contacts need follow-up` : undefined}
                        >
                          {followUpCount > 9 ? '9+' : followUpCount}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {!showCollapsed && (
                  <kbd className={cn(
                    'hidden group-hover:inline-block text-[10px] px-1.5 py-0.5 rounded-md border font-mono',
                    isActive ? 'border-blue-200 text-blue-400 bg-blue-50' : 'border-gray-200 text-gray-400 bg-gray-50'
                  )}>{item.shortcut}</kbd>
                )}
              </Link>
              {/* Tooltip on collapsed hover */}
              {showCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity z-50 shadow-lg">
                  {item.label}
                  {item.href === '/contacts' && followUpCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 rounded-full text-[10px] font-bold">
                      {followUpCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Keyboard shortcuts hint */}
      {(!collapsed || isMobile) ? (
        <div className="px-3 pb-2 border-t border-gray-100 pt-2 space-y-1">
          <button
            onClick={() => setShowShortcuts(prev => !prev)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Keyboard className="w-3 h-3" />
            Press ? for shortcuts
          </button>
          <div className="flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] text-gray-300">
            <Command className="w-2.5 h-2.5" />
            <span>⌘K for command palette</span>
          </div>
        </div>
      ) : (
        <div className="px-2 pb-2 border-t border-gray-100 pt-2">
          <button
            onClick={() => setShowShortcuts(prev => !prev)}
            className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group/kb relative"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
            <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/kb:opacity-100 transition-opacity z-50 shadow-lg">
              Keyboard shortcuts
            </div>
          </button>
        </div>
      )}

      {/* User section */}
      <div className={cn('p-3 border-t border-gray-100', collapsed && !isMobile && 'p-2')}>
        {(!collapsed || isMobile) ? (
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
        ) : (
          <div className="flex flex-col items-center gap-2 group/user relative">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold', avatarColor)}>
              {initials}
            </div>
            <button onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
            <div className="absolute left-full top-0 ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/user:opacity-100 transition-opacity z-50 shadow-lg">
              {displayName}
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle -- desktop only */}
      {!isMobile && (
        <div className="px-3 pb-3">
          <button
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center gap-2 p-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <MobileMenuButton onClick={() => setMobileOpen(true)} />

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          {/* Sliding sidebar */}
          <aside className="absolute inset-y-0 left-0 w-72 bg-white border-r border-gray-200 flex flex-col shadow-2xl sidebar-slide-in">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}>
        {sidebarContent(false)}
      </aside>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl w-96 p-6 border border-gray-100 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
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
                <div className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700 flex items-center gap-2.5">
                    <Command className="w-4 h-4 text-gray-400" />
                    Command Palette
                  </span>
                  <kbd className="text-xs px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg font-mono text-gray-600 shadow-sm">⌘K</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
