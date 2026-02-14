'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Item, Topic, ItemSource } from '@/types/database';
import { cn } from '@/lib/utils';
import { AccountBadge, AccountFilter } from '@/components/ui/account-badge';
import { toast } from 'sonner';
import {
  Mail,
  Calendar,
  FileText,
  StickyNote,
  Search,
  Link2,
  Plus,
  Check,
  Inbox,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Filter,
  CheckSquare,
  Square,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';

/* ---------- Source icon & color mapping ---------- */

const SOURCE_ICONS: Record<ItemSource, React.ElementType> = {
  gmail: Mail,
  calendar: Calendar,
  drive: FileText,
  manual: StickyNote,
  slack: MessageSquare,
};

const SOURCE_COLORS: Record<ItemSource, string> = {
  gmail: 'text-red-400',
  calendar: 'text-blue-400',
  drive: 'text-yellow-400',
  manual: 'text-emerald-400',
  slack: 'text-purple-400',
};

const SOURCE_LABELS: Record<ItemSource, string> = {
  gmail: 'Emails',
  calendar: 'Events',
  drive: 'Files',
  manual: 'Notes',
  slack: 'Chats',
};

type TabKey = 'all' | ItemSource;

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'gmail', label: 'Emails', icon: Mail },
  { key: 'calendar', label: 'Events', icon: Calendar },
  { key: 'drive', label: 'Files', icon: FileText },
  { key: 'slack', label: 'Chats', icon: MessageSquare },
  { key: 'manual', label: 'Notes', icon: StickyNote },
];

type TriageFilter = 'untriaged' | 'all' | 'relevant' | 'low_relevance' | 'noise';

/* ---------- Props ---------- */

interface InboxClientProps {
  items: Item[];
  linkedItemIds: string[];
  topics: Topic[];
  accounts: { id: string; email: string }[];
  /** Custom page title (e.g. "Emails", "Events") */
  pageTitle?: string;
  /** Custom page description */
  pageDescription?: string;
  /** Default source tab to show */
  defaultSource?: TabKey;
  /** Hide the source tabs row (when showing a single-source page) */
  hideTabs?: boolean;
}

export function InboxClient({
  items: initialItems,
  linkedItemIds: initialLinkedIds,
  topics,
  accounts,
  pageTitle,
  pageDescription,
  defaultSource,
  hideTabs = false,
}: InboxClientProps) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(initialLinkedIds));
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>(defaultSource ?? 'all');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [linkDropdownOpen, setLinkDropdownOpen] = useState<string | null>(null);
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [linkedItemId, setLinkedItemId] = useState<string | null>(null);
  const [topicSearch, setTopicSearch] = useState('');
  const [showLinked, setShowLinked] = useState(false);
  const [curatorRunning, setCuratorRunning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Build an account email map for badges
  const accountMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const acc of accounts) {
      map[acc.id] = acc.email;
    }
    return map;
  }, [accounts]);

  // Filter items by all criteria
  const filtered = useMemo(() => {
    return items.filter((item) => {
      // Tab filter
      if (activeTab !== 'all' && item.source !== activeTab) return false;

      // Account filter
      if (selectedAccountId && item.account_id !== selectedAccountId) return false;

      // Triage/linked filter
      const isLinked = linkedIds.has(item.id);
      if (triageFilter === 'untriaged') {
        if (isLinked && !showLinked) return false;
      } else if (triageFilter === 'relevant') {
        if (item.triage_status !== 'relevant') return false;
      } else if (triageFilter === 'low_relevance') {
        if (item.triage_status !== 'low_relevance') return false;
      } else if (triageFilter === 'noise') {
        if (item.triage_status !== 'noise') return false;
      }

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        if (
          !item.title.toLowerCase().includes(q) &&
          !(item.snippet?.toLowerCase().includes(q) ?? false)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [items, activeTab, selectedAccountId, triageFilter, search, linkedIds, showLinked]);

  // Count items per tab
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: 0, gmail: 0, calendar: 0, drive: 0, manual: 0, slack: 0 };
    for (const item of items) {
      const isLinked = linkedIds.has(item.id);
      if (triageFilter === 'untriaged' && isLinked && !showLinked) continue;
      if (selectedAccountId && item.account_id !== selectedAccountId) continue;
      counts.all++;
      counts[item.source]++;
    }
    return counts;
  }, [items, linkedIds, triageFilter, selectedAccountId, showLinked]);

  // Group recurring calendar events: show only the latest instance with a count badge
  const { displayItems, recurringCounts } = useMemo(() => {
    const isCalendarView = activeTab === 'calendar' || defaultSource === 'calendar';
    if (!isCalendarView) {
      return { displayItems: filtered, recurringCounts: new Map<string, number>() };
    }

    // Group by recurringEventId
    const groups = new Map<string, Item[]>();
    const nonRecurring: Item[] = [];

    for (const item of filtered) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = item.metadata as any;
      const recurringId = meta?.recurringEventId;
      if (recurringId) {
        const existing = groups.get(recurringId) || [];
        existing.push(item);
        groups.set(recurringId, existing);
      } else {
        nonRecurring.push(item);
      }
    }

    // For each group, keep only the most recent (first since sorted desc)
    const result: Item[] = [...nonRecurring];
    const counts = new Map<string, number>();

    for (const [recurringId, groupItems] of groups) {
      // Items are already sorted by occurred_at desc, so first is most recent
      result.push(groupItems[0]);
      if (groupItems.length > 1) {
        counts.set(groupItems[0].id, groupItems.length);
      }
    }

    // Re-sort by date desc
    result.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

    return { displayItems: result, recurringCounts: counts };
  }, [filtered, activeTab, defaultSource]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLinkDropdownOpen(null);
        setTopicSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (linkDropdownOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < displayItems.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'l' && selectedIndex >= 0) {
        const target = document.activeElement?.tagName;
        if (target === 'INPUT' || target === 'TEXTAREA') return;
        e.preventDefault();
        const item = displayItems[selectedIndex];
        if (item) setLinkDropdownOpen(item.id);
      } else if (e.key === 'Escape') {
        setLinkDropdownOpen(null);
        setTopicSearch('');
      }
    },
    [displayItems, selectedIndex, linkDropdownOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Link item to topic
  const handleLinkToTopic = async (itemId: string, topicId: string) => {
    setLinkingItemId(itemId);
    try {
      const res = await fetch('/api/topic-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, topic_id: topicId }),
      });

      if (!res.ok) {
        const body = await res.json();
        console.error('Failed to link item:', body.error);
        return;
      }

      setLinkedItemId(itemId);
      setTimeout(() => {
        setLinkedIds((prev) => new Set([...prev, itemId]));
        setLinkedItemId(null);
        setLinkDropdownOpen(null);
        setTopicSearch('');
        if (!showLinked) {
          setItems((prev) => prev.filter((i) => i.id !== itemId));
        }
      }, 400);
    } catch {
      console.error('Network error linking item');
    } finally {
      setLinkingItemId(null);
    }
  };

  // Create topic & link
  const handleCreateTopicAndLink = async (itemId: string) => {
    const topicTitle = topicSearch.trim() || 'Untitled Topic';
    setLinkingItemId(itemId);
    try {
      const topicRes = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: topicTitle, area: 'personal', description: '' }),
      });
      if (!topicRes.ok) return;
      const newTopic = await topicRes.json();
      await handleLinkToTopic(itemId, newTopic.id);
    } catch {
      console.error('Network error creating topic');
    } finally {
      setLinkingItemId(itemId);
    }
  };

  // Run Curator Agent
  const handleRunCurator = async () => {
    setCuratorRunning(true);
    try {
      const res = await fetch('/api/agents/curator', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = (data as any).output ?? (data as any).output_json ?? {};

      if (res.ok && data.success !== false) {
        const processed = output.items_processed ?? 0;
        const created = output.topics_created ?? 0;
        const contacts = output.contacts_found ?? 0;
        if (processed === 0 && output.message) {
          toast.info(output.message);
        } else {
          toast.success(
            `Curator: ${processed} items processed, ${created} topics created, ${contacts} contacts found`
          );
        }
        router.refresh();
      } else {
        toast.error(data.error || output.error || 'Curator agent failed');
      }
    } catch {
      toast.error('Network error running curator');
    } finally {
      setCuratorRunning(false);
    }
  };

  // Bulk selection helpers
  const handleToggleSelect = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === displayItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayItems.map((i) => i.id)));
    }
  };

  const handleBulkMarkNoise = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) =>
          fetch('/api/items/triage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: id, triage_status: 'noise' }),
          })
        )
      );
      toast.success(`Marked ${ids.length} items as noise`);
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      toast.error('Failed to mark items');
    }
  };

  // Format date relative
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    const isFuture = diffMs < 0;

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return isFuture ? 'Tomorrow' : 'Yesterday';
    if (diffDays < 7) return isFuture ? `in ${diffDays}d` : `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Filter topics in dropdown
  const filteredTopics = topics.filter((t) =>
    t.title.toLowerCase().includes(topicSearch.toLowerCase())
  );

  const triageStatusLabel = (status: string | null) => {
    switch (status) {
      case 'relevant': return { text: 'Relevant', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'low_relevance': return { text: 'Low', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'noise': return { text: 'Noise', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
      default: return { text: 'Pending', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pageTitle ?? 'Inbox'}</h1>
          <p className="text-sm text-muted-foreground">
            {pageDescription ?? `${displayItems.length} item${displayItems.length !== 1 ? 's' : ''} · Organize with AI or link manually`}
          </p>
        </div>
        <button
          onClick={handleRunCurator}
          disabled={curatorRunning}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {curatorRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Organizing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              AI Organize
            </>
          )}
        </button>
      </div>

      {/* Account filter */}
      <AccountFilter
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelect={setSelectedAccountId}
      />

      {/* Source tabs (hidden on single-source pages) */}
      {!hideTabs && (
        <div className="flex items-center gap-1 border-b border-border">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const count = tabCounts[tab.key];
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedIndex(-1);
                }}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Search + Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Triage filter dropdown */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={triageFilter}
            onChange={(e) => setTriageFilter(e.target.value as TriageFilter)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="untriaged">Untriaged</option>
            <option value="all">All Items</option>
            <option value="relevant">Relevant</option>
            <option value="low_relevance">Low Relevance</option>
            <option value="noise">Noise</option>
          </select>
        </div>

        {/* Show linked toggle */}
        <button
          onClick={() => setShowLinked(!showLinked)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
            showLinked
              ? 'border-primary/30 bg-primary/5 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
          title={showLinked ? 'Hide linked items' : 'Show linked items'}
        >
          {showLinked ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          Linked
        </button>
      </div>

      {/* Keyboard hints + select all */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>{' '}
            navigate
          </span>
          <span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">l</kbd>{' '}
            link
          </span>
          <span>
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>{' '}
            close
          </span>
        </div>
        {displayItems.length > 0 && (
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {selectedIds.size === displayItems.length ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            Select all
          </button>
        )}
      </div>

      {/* Bulk select bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkMarkNoise}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Mark as Noise
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-foreground">
              {items.length === 0 ? 'No items yet' : 'No matching items'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length === 0
                ? 'Sync your accounts to import emails, events, and files.'
                : 'Try adjusting your filters or search.'}
            </p>
            {items.length === 0 && (
              <a
                href="/settings"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Connect &amp; Sync
              </a>
            )}
          </div>
        ) : (
          displayItems.map((item, index) => {
            const SourceIcon = SOURCE_ICONS[item.source];
            const isSelected = index === selectedIndex;
            const isLinked = linkedItemId === item.id;
            const isLinking = linkingItemId === item.id;
            const isDropdownOpen = linkDropdownOpen === item.id;
            const recurringCount = recurringCounts.get(item.id);
            const accountEmail = item.account_id ? accountMap[item.account_id] : null;
            const triage = triageStatusLabel(item.triage_status);
            const isLinkedToTopic = linkedIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'relative flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-all',
                  isSelected && 'border-primary/40 bg-primary/5',
                  isLinked && 'scale-95 opacity-0 transition-all duration-300',
                  isLinkedToTopic && 'opacity-60'
                )}
              >
                {/* Bulk checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(item.id);
                  }}
                  className="mt-1 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                >
                  {selectedIds.has(item.id) ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>

                {/* Source icon */}
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background',
                    SOURCE_COLORS[item.source]
                  )}
                >
                  <SourceIcon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-medium text-foreground">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary hover:underline transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.title}
                          <ExternalLink className="ml-1 inline h-3 w-3 opacity-50" />
                        </a>
                      ) : (
                        item.title
                      )}
                    </h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(item.occurred_at)}
                    </span>
                  </div>
                  {item.snippet && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {item.snippet}
                    </p>
                  )}
                  {/* Body preview */}
                  {item.body && !item.snippet && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">
                      {(item.body as string).slice(0, 120)}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize',
                        'bg-background text-muted-foreground border-border'
                      )}
                    >
                      {SOURCE_LABELS[item.source]}
                    </span>
                    {/* Triage status badge */}
                    <span
                      className={cn(
                        'rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                        triage.className
                      )}
                    >
                      {triage.text}
                    </span>
                    {/* Triage score */}
                    {item.triage_score != null && (
                      <span className="text-[10px] text-muted-foreground">
                        score: {(item.triage_score * 100).toFixed(0)}%
                      </span>
                    )}
                    {/* Recurring event badge */}
                    {recurringCount && recurringCount > 1 && (
                      <span className="flex items-center gap-0.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                        <RefreshCw className="h-2.5 w-2.5" />
                        {recurringCount} occurrences
                      </span>
                    )}
                    {/* Account badge */}
                    {accountEmail && <AccountBadge email={accountEmail} size="sm" />}
                    {/* Linked indicator */}
                    {isLinkedToTopic && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                        <Link2 className="h-3 w-3" />
                        Linked
                      </span>
                    )}
                  </div>
                </div>

                {/* Link to Topic button + dropdown */}
                {!isLinkedToTopic && (
                  <div className="relative shrink-0" ref={isDropdownOpen ? dropdownRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLinkDropdownOpen(isDropdownOpen ? null : item.id);
                        setTopicSearch('');
                      }}
                      disabled={isLinking}
                      className={cn(
                        'flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors',
                        'text-muted-foreground hover:border-primary/30 hover:text-foreground',
                        isDropdownOpen && 'border-primary/30 text-foreground',
                        isLinking && 'opacity-50'
                      )}
                    >
                      <Link2 className="h-3 w-3" />
                      Link
                      <ChevronDown className="h-3 w-3" />
                    </button>

                    {/* Topic dropdown */}
                    {isDropdownOpen && (
                      <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border bg-card shadow-xl">
                        <div className="border-b border-border p-2">
                          <input
                            type="text"
                            placeholder="Search topics or type new name..."
                            value={topicSearch}
                            onChange={(e) => setTopicSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto p-1">
                          {filteredTopics.map((topic) => (
                            <button
                              key={topic.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLinkToTopic(item.id, topic.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-primary/10"
                            >
                              <Check className="h-3.5 w-3.5 shrink-0 text-transparent" />
                              <span className="truncate">{topic.title}</span>
                              <span className="ml-auto shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                                {topic.area}
                              </span>
                            </button>
                          ))}

                          {filteredTopics.length === 0 && !topicSearch && (
                            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                              No topics yet. Type a name to create one.
                            </p>
                          )}
                        </div>

                        <div className="border-t border-border p-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateTopicAndLink(item.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-primary/10"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              Create{topicSearch ? ` "${topicSearch}"` : ' new topic'} &amp; link
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
