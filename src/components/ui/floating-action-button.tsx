'use client';

import { useState } from 'react';
import { useComposeStore } from '@/stores/compose-store';
import { useEventStore } from '@/stores/event-store';
import { Plus, Mail, Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const openCompose = useComposeStore((s) => s.openCompose);
  const openEvent = useEventStore((s) => s.openEvent);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-3">
      {/* Main FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          open && 'rotate-45'
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>

      {/* Sub-actions */}
      {open && (
        <>
          <button
            onClick={() => {
              openCompose();
              setOpen(false);
            }}
            className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2.5 text-sm font-medium text-foreground shadow-lg transition-all hover:border-primary/30 animate-in slide-in-from-bottom-2 fade-in duration-200"
          >
            <Mail className="h-4 w-4 text-red-400" />
            Compose Email
          </button>
          <button
            onClick={() => {
              openEvent();
              setOpen(false);
            }}
            className="flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2.5 text-sm font-medium text-foreground shadow-lg transition-all hover:border-primary/30 animate-in slide-in-from-bottom-2 fade-in duration-150"
          >
            <Calendar className="h-4 w-4 text-blue-400" />
            Create Event
          </button>
        </>
      )}
    </div>
  );
}
