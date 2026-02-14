'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Item, Topic, ItemSource } from '@/types/database';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

/* ---------- Source icon mapping ---------- */

const SOURCE_ICONS: Record<ItemSource, React.ElementType> = {
  gmail: Mail,
  calendar: Calendar,
  drive: FileText,
  manual: StickyNote,
};

const SOURCE_COLORS: Record<ItemSource, string> = {
  gmail: 'text-red-400',
  calendar: 'text-blue-400',
  drive: 'text-yellow-400',
  manual: 'text-emerald-400',
};

/* ---------- Props ---------- */

interface InboxClientProps {
  items: Item[];
  topics: Topic[];
}

export function InboxClient({ items: initialItems, topics }: InboxClientProps) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [linkDropdownOpen, setLinkDropdownOpen] = useState<string | null>(null);
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [linkedItemId, setLinkedItemId] = useState<string | null>(null);
  const [topicSearch, setTopicSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter items client-side by search query
  const filtered = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.snippet?.toLowerCase().includes(q) ?? false)
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
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
      if (linkDropdownOpen) return; // Don't navigate while dropdown is open

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'l' && selectedIndex >= 0) {
        const target = document.activeElement?.tagName;
        if (target === 'INPUT' || target === 'TEXTAREA') return;
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) {
          setLinkDropdownOpen(item.id);
        }
      } else if (e.key === 'Escape') {
        setLinkDropdownOpen(null);
        setTopicSearch('');
      }
    },
    [filtered, selectedIndex, linkDropdownOpen]
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

      // Optimistic update: show brief success then remove item
      setLinkedItemId(itemId);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setLinkedItemId(null);
        setLinkDropdownOpen(null);
        setTopicSearch('');
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
      // 1. Create the topic
      const topicRes = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: topicTitle,
          area: 'personal',
          description: '',
        }),
      });

      if (!topicRes.ok) {
        const body = await topicRes.json();
        console.error('Failed to create topic:', body.error);
        return;
      }

      const newTopic = await topicRes.json();

      // 2. Link item to new topic
      await handleLinkToTopic(itemId, newTopic.id);
    } catch {
      console.error('Network error creating topic');
    } finally {
      setLinkingItemId(null);
    }
  };

  // Format date relative
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Filter topics in dropdown
  const filteredTopics = topics.filter((t) =>
    t.title.toLowerCase().includes(topicSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} untriaged item{filtered.length !== 1 ? 's' : ''} waiting to be linked to a topic
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter items by title or snippet..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
            &uarr;&darr;
          </kbd>{' '}
          navigate
        </span>
        <span>
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
            l
          </kbd>{' '}
          link to topic
        </span>
        <span>
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
            esc
          </kbd>{' '}
          close
        </span>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium text-foreground">
              {items.length === 0 ? 'Inbox zero!' : 'No matching items'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length === 0
                ? 'All items have been linked to topics.'
                : 'Try adjusting your search filter.'}
            </p>
          </div>
        ) : (
          filtered.map((item, index) => {
            const SourceIcon = SOURCE_ICONS[item.source];
            const isSelected = index === selectedIndex;
            const isLinked = linkedItemId === item.id;
            const isLinking = linkingItemId === item.id;
            const isDropdownOpen = linkDropdownOpen === item.id;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'relative flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-all',
                  isSelected && 'border-primary/40 bg-primary/5',
                  isLinked && 'scale-95 opacity-0 transition-all duration-300'
                )}
              >
                {/* Source icon */}
                <div
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background',
                    SOURCE_COLORS[item.source]
                  )}
                >
                  <SourceIcon className="h-4.5 w-4.5" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate font-medium text-foreground">
                      {item.title}
                    </h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(item.occurred_at)}
                    </span>
                  </div>
                  {item.snippet && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.snippet}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs font-medium capitalize',
                        'bg-background text-muted-foreground border-border'
                      )}
                    >
                      {item.source}
                    </span>
                  </div>
                </div>

                {/* Link to Topic button + dropdown */}
                <div className="relative shrink-0" ref={isDropdownOpen ? dropdownRef : undefined}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLinkDropdownOpen(isDropdownOpen ? null : item.id);
                      setTopicSearch('');
                    }}
                    disabled={isLinking}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors',
                      'text-muted-foreground hover:border-primary/30 hover:text-foreground',
                      isDropdownOpen && 'border-primary/30 text-foreground',
                      isLinking && 'opacity-50'
                    )}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Link
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {/* Topic dropdown */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border bg-card shadow-xl">
                      {/* Search in dropdown */}
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

                      {/* Create topic & link option */}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
