'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Users, X, ChevronDown, Search } from 'lucide-react';

export interface ContactOption {
  id: string;
  name: string;
  email: string | null;
  organization: string | null;
  area: string | null;
}

interface ContactPickerProps {
  contacts: ContactOption[];
  value: string | null; // contact id
  onChange: (contactId: string | null, contactName: string) => void;
  placeholder?: string;
  compact?: boolean; // smaller variant for inline task forms
  className?: string;
}

export function ContactPicker({ contacts, value, onChange, placeholder = 'Assign contact...', compact = false, className = '' }: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedContact = useMemo(() => {
    if (!value) return null;
    return contacts.find(c => c.id === value) || null;
  }, [value, contacts]);

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.organization && c.organization.toLowerCase().includes(q))
    );
  }, [contacts, query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (contact: ContactOption) => {
    onChange(contact.id, contact.name);
    setOpen(false);
    setQuery('');
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, '');
    setOpen(false);
    setQuery('');
  };

  const areaColors: Record<string, string> = {
    work: 'bg-blue-100 text-blue-600',
    personal: 'bg-green-100 text-green-600',
    career: 'bg-purple-100 text-purple-600',
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={`w-full flex items-center gap-1.5 border rounded-lg bg-white text-left transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        } ${open ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-gray-200'}`}
      >
        <Users className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-gray-400 flex-shrink-0`} />
        {selectedContact ? (
          <span className="flex-1 truncate text-gray-900">{selectedContact.name}</span>
        ) : (
          <span className="flex-1 truncate text-gray-400">{placeholder}</span>
        )}
        {selectedContact ? (
          <X className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-gray-400 hover:text-red-500 cursor-pointer`} onClick={clear} />
        ) : (
          <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-gray-400`} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {/* Search */}
          <div className="p-1.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded">
              <Search className="w-3 h-3 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search contacts..."
                className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
                onKeyDown={e => {
                  if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                  if (e.key === 'Enter' && filtered.length === 1) { select(filtered[0]); }
                }}
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">No contacts found</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                    value === c.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">{c.name}</div>
                    {(c.email || c.organization) && (
                      <div className="text-[10px] text-gray-400 truncate">
                        {c.organization && <span>{c.organization}</span>}
                        {c.organization && c.email && <span> · </span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                    )}
                  </div>
                  {c.area && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${areaColors[c.area] || 'bg-gray-100 text-gray-600'}`}>
                      {c.area}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
