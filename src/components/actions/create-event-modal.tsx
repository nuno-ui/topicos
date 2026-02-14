'use client';

import { useState, useEffect } from 'react';
import { useEventStore } from '@/stores/event-store';
import { toast } from 'sonner';
import {
  X,
  Calendar,
  Loader2,
  ChevronDown,
} from 'lucide-react';

export function CreateEventModal() {
  const {
    isOpen,
    title,
    startDate,
    endDate,
    description,
    attendees,
    accountId,
    closeEvent,
  } = useEventStore();

  const [localTitle, setLocalTitle] = useState(title);
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);
  const [localDesc, setLocalDesc] = useState(description);
  const [localAttendees, setLocalAttendees] = useState(attendees);
  const [localAccountId, setLocalAccountId] = useState(accountId);
  const [accounts, setAccounts] = useState<{ id: string; email: string }[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalTitle(title);
      setLocalStart(startDate);
      setLocalEnd(endDate);
      setLocalDesc(description);
      setLocalAttendees(attendees);
      setLocalAccountId(accountId);
    }
  }, [isOpen, title, startDate, endDate, description, attendees, accountId]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/google/accounts')
        .then((r) => r.json())
        .then((data) => {
          setAccounts(data ?? []);
          if (!localAccountId && data?.length > 0) {
            setLocalAccountId(data[0].id);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!localTitle.trim()) {
      toast.error('Please enter an event title');
      return;
    }
    if (!localStart) {
      toast.error('Please select a start date/time');
      return;
    }
    if (!localAccountId) {
      toast.error('Please select an account');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/actions/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: localAccountId,
          title: localTitle,
          start: localStart,
          end: localEnd || undefined,
          description: localDesc || undefined,
          attendees: localAttendees
            ? localAttendees.split(',').map((e: string) => e.trim()).filter(Boolean)
            : undefined,
        }),
      });
      if (res.ok) {
        toast.success('Event created successfully');
        closeEvent();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to create event');
      }
    } catch {
      toast.error('Network error creating event');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Create Event</h2>
          </div>
          <button
            onClick={closeEvent}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 px-6 py-4">
          {/* Account */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Account</label>
            <div className="relative">
              <select
                value={localAccountId ?? ''}
                onChange={(e) => setLocalAccountId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.email}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Event Title</label>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              placeholder="Meeting with..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date/time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Start</label>
              <input
                type="datetime-local"
                value={localStart}
                onChange={(e) => setLocalStart(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">End</label>
              <input
                type="datetime-local"
                value={localEnd}
                onChange={(e) => setLocalEnd(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Description</label>
            <textarea
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              placeholder="Event details..."
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Attendees</label>
            <input
              type="text"
              value={localAttendees}
              onChange={(e) => setLocalAttendees(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">Comma-separated email addresses</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border px-6 py-4">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
}
