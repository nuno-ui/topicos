'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, FolderKanban, UserPlus, StickyNote, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  { label: 'New Topic', icon: FolderKanban, href: '/topics?create=true', color: 'bg-blue-500' },
  { label: 'New Contact', icon: UserPlus, href: '/contacts?create=true', color: 'bg-teal-500' },
  { label: 'Quick Note', icon: StickyNote, href: '/topics?note=true', color: 'bg-amber-500' },
  { label: 'Search', icon: Search, href: '/search', color: 'bg-purple-500' },
];

export function MobileFAB() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={menuRef} className="fixed bottom-6 left-6 z-30 md:hidden">
      {/* Action items (stacked above FAB when open) */}
      {open && (
        <div className="absolute bottom-14 left-0 space-y-2 animate-float-up">
          {actions.map((action, i) => (
            <button
              key={action.label}
              onClick={() => {
                setOpen(false);
                router.push(action.href);
              }}
              className="flex items-center gap-2.5 pl-2 pr-4 py-2 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-all"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white', action.color)}>
                <action.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all',
          open
            ? 'bg-gray-700 hover:bg-gray-800 rotate-45'
            : 'brand-gradient hover:opacity-90'
        )}
        aria-label={open ? 'Close quick actions' : 'Quick actions'}
        aria-expanded={open}
      >
        {open ? <X className="w-5 h-5 -rotate-45" /> : <Plus className="w-5 h-5" />}
      </button>
    </div>
  );
}
