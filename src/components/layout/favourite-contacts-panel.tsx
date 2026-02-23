'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, X, ChevronRight } from 'lucide-react';

interface FavContact {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
}

const avatarGradients = [
  'from-blue-400 to-purple-500',
  'from-green-400 to-cyan-500',
  'from-purple-400 to-pink-500',
  'from-amber-400 to-red-500',
  'from-pink-400 to-purple-500',
  'from-cyan-400 to-blue-500',
];

function getGradient(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return avatarGradients[hash % avatarGradients.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function FavouriteContactsPanel() {
  const [contacts, setContacts] = useState<FavContact[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Don't show on contacts pages (sidebar already shows favourites there)
  const isContactsPage = pathname.startsWith('/contacts');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/contacts?favorites=true&limit=8');
        const data = await res.json();
        if (data.contacts) setContacts(data.contacts.slice(0, 8));
      } catch { /* ignore */ }
    };
    load();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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

  // Close panel on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (contacts.length === 0 || isContactsPage) return null;

  return (
    <div ref={panelRef} className="fixed bottom-20 right-4 z-30">
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          title="Favourite contacts"
        >
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-teal-400 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {contacts.length}
          </span>
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%)' }}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-semibold text-gray-900">People</span>
              <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-bold">{contacts.length}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contact list */}
          <div className="py-1.5 max-h-80 overflow-y-auto">
            {contacts.map(c => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group"
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getGradient(c.name)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-[10px] font-bold text-white">{getInitials(c.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-teal-700 transition-colors">{c.name}</p>
                  {c.organization && <p className="text-[11px] text-gray-400 truncate">{c.organization}</p>}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <Link
              href="/contacts"
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-800 transition-colors"
            >
              View all contacts
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
