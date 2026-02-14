'use client';

import { useState, useEffect } from 'react';
import { useComposeStore } from '@/stores/compose-store';
import { toast } from 'sonner';
import {
  X,
  Send,
  Save,
  Loader2,
  ChevronDown,
} from 'lucide-react';

export function ComposeEmailModal() {
  const {
    isOpen,
    to,
    cc,
    subject,
    body,
    topicId,
    accountId,
    closeCompose,
  } = useComposeStore();

  const [localTo, setLocalTo] = useState(to);
  const [localCc, setLocalCc] = useState(cc);
  const [localSubject, setLocalSubject] = useState(subject);
  const [localBody, setLocalBody] = useState(body);
  const [localAccountId, setLocalAccountId] = useState(accountId);
  const [accounts, setAccounts] = useState<{ id: string; email: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset locals when store changes
  useEffect(() => {
    if (isOpen) {
      setLocalTo(to);
      setLocalCc(cc);
      setLocalSubject(subject);
      setLocalBody(body);
      setLocalAccountId(accountId);
    }
  }, [isOpen, to, cc, subject, body, accountId]);

  // Fetch accounts
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

  const handleSend = async () => {
    if (!localTo.trim()) {
      toast.error('Please enter a recipient');
      return;
    }
    if (!localAccountId) {
      toast.error('Please select an account');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/actions/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: localAccountId,
          to: localTo,
          cc: localCc || undefined,
          subject: localSubject,
          body: localBody,
          topic_id: topicId || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Email sent successfully');
        closeCompose();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to send email');
      }
    } catch {
      toast.error('Network error sending email');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!localAccountId) {
      toast.error('Please select an account');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/actions/gmail/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: localAccountId,
          to: localTo,
          cc: localCc || undefined,
          subject: localSubject,
          body: localBody,
          topic_id: topicId || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Draft saved');
        closeCompose();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save draft');
      }
    } catch {
      toast.error('Network error saving draft');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Compose Email</h2>
          <button
            onClick={closeCompose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3 px-6 py-4">
          {/* Account selector */}
          <div className="flex items-center gap-3">
            <label className="w-16 text-sm font-medium text-muted-foreground">From</label>
            <div className="relative flex-1">
              <select
                value={localAccountId ?? ''}
                onChange={(e) => setLocalAccountId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.email}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* To */}
          <div className="flex items-center gap-3">
            <label className="w-16 text-sm font-medium text-muted-foreground">To</label>
            <input
              type="text"
              value={localTo}
              onChange={(e) => setLocalTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* CC */}
          <div className="flex items-center gap-3">
            <label className="w-16 text-sm font-medium text-muted-foreground">CC</label>
            <input
              type="text"
              value={localCc}
              onChange={(e) => setLocalCc(e.target.value)}
              placeholder="cc@example.com (optional)"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-3">
            <label className="w-16 text-sm font-medium text-muted-foreground">Subject</label>
            <input
              type="text"
              value={localSubject}
              onChange={(e) => setLocalSubject(e.target.value)}
              placeholder="Email subject..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Body */}
          <textarea
            value={localBody}
            onChange={(e) => setLocalBody(e.target.value)}
            placeholder="Write your email..."
            rows={10}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            onClick={handleSaveDraft}
            disabled={saving || sending}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button
            onClick={handleSend}
            disabled={sending || saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
