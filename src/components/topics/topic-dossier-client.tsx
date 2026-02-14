'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Topic, Item, Task, TopicLink, Area, TaskStatus, ItemSource, Contact, EmailDraft } from '@/types/database';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Pencil,
  Sparkles,
  Plus,
  Mail,
  Calendar,
  FileText,
  StickyNote,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Users,
  Gauge,
  ListChecks,
  Bot,
  ChevronDown,
  ChevronRight,
  FileEdit,
  Building2,
  UserCircle,
  MailPlus,
  Zap,
  X,
  Search,
  Link2,
  Save,
} from 'lucide-react';
import Link from 'next/link';

/* ---------- constants ---------- */

const AREA_COLORS: Record<Area, { badge: string; hex: string }> = {
  personal: {
    badge: 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20',
    hex: '#8b5cf6',
  },
  career: {
    badge: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
    hex: '#3b82f6',
  },
  work: {
    badge: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
    hex: '#f97316',
  },
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const TASK_STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  done: {
    label: 'Done',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
};

const SOURCE_ICONS: Record<ItemSource, React.ElementType> = {
  gmail: Mail,
  calendar: Calendar,
  drive: FileText,
  manual: StickyNote,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

/* ---------- types ---------- */

interface LinkedItem {
  link: TopicLink;
  item: Item;
}

interface TopicDossierClientProps {
  topic: Topic;
  linkedItems: LinkedItem[];
  tasks: Task[];
  contacts: Contact[];
  accounts: { id: string; email: string }[];
  drafts: EmailDraft[];
}

/* ---------- helpers ---------- */

function getUrgencyColor(score: number | null) {
  if (score == null) return { bar: 'bg-zinc-600', text: 'text-zinc-400', label: 'Not scored' };
  if (score >= 80) return { bar: 'bg-red-500', text: 'text-red-400', label: 'Critical' };
  if (score >= 60) return { bar: 'bg-orange-500', text: 'text-orange-400', label: 'High' };
  if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-400', label: 'Medium' };
  if (score >= 20) return { bar: 'bg-blue-500', text: 'text-blue-400', label: 'Low' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'Minimal' };
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ---------- component ---------- */

export function TopicDossierClient({
  topic,
  linkedItems,
  tasks: initialTasks,
  contacts,
  accounts,
  drafts,
}: TopicDossierClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(topic.summary);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Add task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Collapsible sections
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [draftsOpen, setDraftsOpen] = useState(true);

  // Compose state
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(topic.title);
  const [editDescription, setEditDescription] = useState(topic.description ?? '');
  const [saving, setSaving] = useState(false);

  // Connect items search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  const router = useRouter();

  const areaColor = AREA_COLORS[topic.area];
  const urgency = getUrgencyColor(topic.urgency_score);

  // Sort linked items chronologically (oldest first)
  const sortedItems = [...linkedItems].sort(
    (a, b) =>
      new Date(a.item.occurred_at).getTime() - new Date(b.item.occurred_at).getTime()
  );

  // Merge people from topic.people and contacts
  const allPeople = [
    ...(topic.people ?? []).map((p) => ({
      name: p.name,
      email: p.email ?? null,
      role: p.role ?? null,
      organization: p.organization ?? null,
      isContact: false,
      contactId: null as string | null,
    })),
    ...contacts
      .filter((c) => !(topic.people ?? []).some((p) => p.email === c.email))
      .map((c) => ({
        name: c.name ?? c.email,
        email: c.email,
        role: c.role,
        organization: c.organization,
        isContact: true,
        contactId: c.id,
      })),
  ];

  /* ---------- handlers ---------- */

  const handleGenerateSummary = async () => {
    setSummarizing(true);
    setSummaryError(null);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topic.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSummaryError(body.error ?? 'Failed to generate summary');
        return;
      }

      const data = await res.json();
      setSummary(data.summary ?? data.output ?? null);
    } catch {
      setSummaryError('Network error. Please try again.');
    } finally {
      setSummarizing(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);
    setCreatingTask(true);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          topic_id: topic.id,
          due_at: taskDue || undefined,
          created_by: 'user',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTaskError(body.error ?? 'Failed to create task');
        return;
      }

      const newTask: Task = await res.json();
      setTasks((prev) => [newTask, ...prev]);
      setTaskTitle('');
      setTaskDue('');
      setShowTaskForm(false);
    } catch {
      setTaskError('Network error. Please try again.');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      pending: 'in_progress',
      in_progress: 'done',
      done: 'pending',
    };
    const newStatus = nextStatus[task.status];

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const updated: Task = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      }
    } catch {
      // silently ignore
    }
  };

  const handleSmartCompose = async () => {
    if (!accounts.length) {
      setComposeError('No Google account connected. Connect one in Settings.');
      return;
    }
    setComposing(true);
    setComposeError(null);
    try {
      const res = await fetch('/api/agents/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topic.id }),
      });
      if (res.ok) {
        toast.success('Smart compose draft created');
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setComposeError(body.error ?? 'Failed to compose draft');
      }
    } catch {
      setComposeError('Network error. Please try again.');
    } finally {
      setComposing(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
        }),
      });
      if (res.ok) {
        toast.success('Topic updated');
        setEditing(false);
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? 'Failed to update topic');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchItems = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/items?q=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const linkedIds = new Set(linkedItems.map((li) => li.item.id));
        setSearchResults(
          (data.items ?? data).filter((i: Item) => !linkedIds.has(i.id))
        );
      }
    } catch {
      // silently ignore search errors
    } finally {
      setSearching(false);
    }
  };

  const handleLinkItem = async (itemId: string) => {
    setLinking(itemId);
    try {
      const res = await fetch('/api/topic-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topic.id,
          item_id: itemId,
          created_by: 'user',
        }),
      });
      if (res.ok) {
        toast.success('Item linked to topic');
        setSearchQuery('');
        setSearchResults([]);
        router.refresh();
      } else {
        toast.error('Failed to link item');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLinking(null);
    }
  };

  const handleUnlinkItem = async (linkId: string) => {
    try {
      const res = await fetch(`/api/topic-links?id=${linkId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Item unlinked');
        router.refresh();
      } else {
        toast.error('Failed to unlink');
      }
    } catch {
      toast.error('Network error');
    }
  };

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/topics"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Topics
      </Link>

      {/* Header with urgency */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium capitalize',
                  areaColor.badge
                )}
              >
                {topic.area}
              </span>
              <span
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium capitalize',
                  STATUS_STYLES[topic.status]
                )}
              >
                {topic.status}
              </span>
              {topic.priority > 0 && (
                <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                  Priority: {topic.priority}
                </span>
              )}
              {topic.last_agent_update_at && (
                <span className="flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-xs font-medium text-purple-400">
                  <Bot className="h-3 w-3" />
                  AI updated {formatRelativeTime(topic.last_agent_update_at)}
                </span>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xl font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Topic description..."
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditTitle(topic.title);
                      setEditDescription(topic.description ?? '');
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground">{topic.title}</h1>
                {topic.description && (
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {topic.description}
                  </p>
                )}
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Urgency Score Meter */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">Urgency</span>
              <span className={cn('text-xs font-medium', urgency.text)}>{urgency.label}</span>
            </div>
            <span className={cn('text-sm font-bold tabular-nums', urgency.text)}>
              {topic.urgency_score != null ? `${topic.urgency_score}/100` : '\u2014'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background">
            <div
              className={cn('h-full rounded-full transition-all duration-500', urgency.bar)}
              style={{ width: `${topic.urgency_score ?? 0}%` }}
            />
          </div>
        </div>

        {/* Area accent bar */}
        <div
          className="mt-4 h-1 w-full rounded-full opacity-40"
          style={{ backgroundColor: areaColor.hex }}
        />
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSmartCompose}
          disabled={composing}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-purple-500/30 hover:text-purple-400"
        >
          {composing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MailPlus className="h-4 w-4" />
          )}
          Smart Compose
        </button>
        <button
          onClick={handleGenerateSummary}
          disabled={summarizing}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-cyan-500/30 hover:text-cyan-400"
        >
          {summarizing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {summary ? 'Refresh Summary' : 'Generate Summary'}
        </button>
        {accounts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            via {accounts.map((a) => a.email).join(', ')}
          </span>
        )}
        {composeError && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3" />
            {composeError}
          </span>
        )}
      </div>

      {/* Connect Items */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold text-foreground mb-3">
          <Link2 className="h-4 w-4" />
          Connect Items
        </h3>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchItems(e.target.value)}
              placeholder="Search emails, events, files to link..."
              className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-card shadow-lg z-50 max-h-64 overflow-auto">
              {searchResults.map((item) => {
                const Icon = SOURCE_ICONS[item.source] ?? StickyNote;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.snippet?.slice(0, 80)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLinkItem(item.id)}
                      disabled={linking === item.id}
                      className="ml-2 shrink-0 rounded px-2 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {linking === item.id ? 'Linking...' : 'Link'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-border bg-card shadow-lg z-50 p-3 text-center text-sm text-muted-foreground">
              No matching items found
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {linkedItems.length} item{linkedItems.length !== 1 ? 's' : ''} connected
          {linkedItems.length > 0 ? ' \u00b7 ' : ' \u2014 '}
          Search to add more
        </p>
      </div>

      {/* Linked Items / Timeline section -- prominent, default expanded */}
      <div className="rounded-lg border-2 border-primary/20 bg-card p-6">
        <button
          onClick={() => setTimelineOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-foreground">
                Linked Items
              </h2>
              <p className="text-sm text-muted-foreground">
                {sortedItems.length} item{sortedItems.length !== 1 ? 's' : ''} in chronological order
              </p>
            </div>
          </div>
          {timelineOpen ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {timelineOpen && (
          <>
            {sortedItems.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-border bg-background p-6 text-center">
                <Link2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No linked items yet. Use the search box above to connect emails, events, and files to this topic.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-1">
                {sortedItems.map(({ link, item }) => {
                  const SourceIcon = SOURCE_ICONS[item.source as ItemSource] ?? StickyNote;
                  return (
                    <div
                      key={link.id}
                      className="flex items-center gap-4 rounded-md border border-border bg-background px-4 py-3 transition-colors hover:border-primary/20"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                        style={{
                          backgroundColor: `${areaColor.hex}15`,
                          color: areaColor.hex,
                        }}
                      >
                        <SourceIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline hover:text-primary transition-colors"
                              >
                                {item.title}
                              </a>
                            ) : (
                              item.title
                            )}
                          </p>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {item.snippet && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.snippet}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        {link.confidence != null && (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-medium',
                              link.confidence >= 0.8
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : link.confidence >= 0.5
                                  ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-zinc-500/10 text-zinc-400'
                            )}
                          >
                            {Math.round(link.confidence * 100)}%
                          </span>
                        )}
                        {link.created_by !== 'user' && (
                          <span className="flex items-center gap-0.5 text-purple-400">
                            <Bot className="h-3 w-3" />
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(item.occurred_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => handleUnlinkItem(link.id)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                          title="Unlink from topic"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Two-column layout for side-by-side info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* People Involved */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">People Involved</h2>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {allPeople.length}
            </span>
          </div>

          {allPeople.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No people identified yet. The Curator Agent will extract contacts automatically.
            </p>
          ) : (
            <div className="space-y-3">
              {allPeople.map((person, i) => (
                <div key={person.email ?? `person-${i}`} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-medium text-muted-foreground">
                    {person.name?.[0]?.toUpperCase() ?? <UserCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {person.name}
                      </span>
                      {person.isContact && (
                        <span className="rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                          Contact
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {person.email && <span className="truncate">{person.email}</span>}
                      {person.role && (
                        <span className="flex items-center gap-1">
                          <span className="text-border">&middot;</span> {person.role}
                        </span>
                      )}
                      {person.organization && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {person.organization}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Next Steps */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">AI Next Steps</h2>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {(topic.next_steps ?? []).length}
            </span>
          </div>

          {(topic.next_steps ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No AI-generated next steps yet. Run the Curator Agent to generate recommendations.
            </p>
          ) : (
            <div className="space-y-3">
              {(topic.next_steps ?? []).map((step, i) => (
                <div
                  key={`step-${i}`}
                  className="flex items-start gap-3 rounded-md border border-border bg-background px-4 py-3"
                >
                  <Zap className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{step.action}</p>
                    {step.rationale && (
                      <p className="mt-1 text-xs text-muted-foreground">{step.rationale}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium capitalize',
                      PRIORITY_COLORS[step.priority] ?? PRIORITY_COLORS.medium
                    )}
                  >
                    {step.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">AI Summary</h2>
        </div>

        {summaryError && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {summaryError}
          </div>
        )}

        <div className="mt-4">
          {summary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {summary}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No AI summary yet. Click &quot;Generate Summary&quot; above to create one.
            </p>
          )}
        </div>
      </div>

      {/* Email Drafts section */}
      {drafts.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <button
            onClick={() => setDraftsOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Email Drafts</h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {drafts.length}
              </span>
            </div>
            {draftsOpen ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {draftsOpen && (
            <div className="mt-4 space-y-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-md border border-border bg-background px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {draft.subject || '(no subject)'}
                        </p>
                        {draft.agent_generated && (
                          <span className="flex items-center gap-1 rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                            <Bot className="h-2.5 w-2.5" /> AI
                          </span>
                        )}
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize',
                            draft.status === 'sent'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : draft.status === 'failed'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          )}
                        >
                          {draft.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        To: {draft.to_addresses.join(', ')}
                        {draft.cc_addresses.length > 0 && ` \u00b7 CC: ${draft.cc_addresses.join(', ')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(draft.created_at)}
                      </span>
                      {draft.status === 'draft' && draft.gmail_draft_id && (
                        <a
                          href={`https://mail.google.com/mail/#drafts/${draft.gmail_draft_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                  {draft.body_text && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {draft.body_text.slice(0, 200)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} for this topic
            </p>
          </div>
          <button
            onClick={() => setShowTaskForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            {showTaskForm ? (
              'Cancel'
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Task
              </>
            )}
          </button>
        </div>

        {/* Add Task form */}
        {showTaskForm && (
          <form
            onSubmit={handleAddTask}
            className="mt-4 space-y-3 rounded-md border border-border bg-background p-4"
          >
            {taskError && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {taskError}
              </div>
            )}

            <div className="flex gap-3">
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title..."
                className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={creatingTask}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {creatingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Add'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Task list */}
        {tasks.length === 0 && !showTaskForm ? (
          <div className="mt-4 rounded-md border border-border bg-background p-6 text-center text-sm text-muted-foreground">
            No tasks yet. Click &quot;Add Task&quot; to create one.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {tasks.map((task) => {
              const statusInfo = TASK_STATUS_STYLES[task.status];
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 rounded-md border border-border bg-background px-4 py-3"
                >
                  <button
                    onClick={() => handleToggleTaskStatus(task)}
                    className="shrink-0"
                    title={`Status: ${statusInfo.label}. Click to cycle.`}
                  >
                    <CheckCircle2
                      className={cn(
                        'h-5 w-5 transition-colors',
                        task.status === 'done'
                          ? 'text-emerald-400'
                          : task.status === 'in_progress'
                            ? 'text-blue-400'
                            : 'text-muted-foreground'
                      )}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          task.status === 'done'
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground'
                        )}
                      >
                        {task.title}
                      </p>
                      {task.created_by !== 'user' && (
                        <span className="flex items-center gap-0.5 rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
                          <Bot className="h-2.5 w-2.5" />
                          {task.created_by}
                        </span>
                      )}
                    </div>
                    {task.rationale && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {task.rationale}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {task.due_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(task.due_at).toLocaleDateString()}
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs font-medium',
                        statusInfo.className
                      )}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
