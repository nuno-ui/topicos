'use client';

import { useState } from 'react';
import type { Topic, Area } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  Plus,
  X,
  ChevronRight,
  FolderOpen,
  Briefcase,
  User,
  LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';

const AREA_COLORS: Record<Area, { badge: string; dot: string }> = {
  personal: {
    badge: 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20',
    dot: 'bg-[#8b5cf6]',
  },
  career: {
    badge: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
    dot: 'bg-[#3b82f6]',
  },
  work: {
    badge: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
    dot: 'bg-[#f97316]',
  },
};

const AREA_ICONS: Record<Area, React.ElementType> = {
  personal: User,
  career: Briefcase,
  work: FolderOpen,
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

type FilterTab = 'all' | Area;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'personal', label: 'Personal' },
  { key: 'career', label: 'Career' },
  { key: 'work', label: 'Work' },
];

interface TopicsListClientProps {
  topics: Topic[];
}

export function TopicsListClient({ topics }: TopicsListClientProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<Area>('personal');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filtered = activeTab === 'all'
    ? topics
    : topics.filter((t) => t.area === activeTab);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, area, description }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Failed to create topic');
        return;
      }

      // Reset form and reload to show new topic
      setTitle('');
      setArea('personal');
      setDescription('');
      setShowForm(false);
      window.location.reload();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Topics</h1>
          <p className="text-sm text-muted-foreground">
            Organize what matters across all areas of your life
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create Topic
            </>
          )}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-lg border border-border bg-card p-5"
        >
          <h2 className="text-lg font-semibold">New Topic</h2>

          {error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium text-foreground">
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Job search Q1, Home renovation, Side project..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="area" className="block text-sm font-medium text-foreground">
              Area
            </label>
            <select
              id="area"
              value={area}
              onChange={(e) => setArea(e.target.value as Area)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="personal">Personal</option>
              <option value="career">Career</option>
              <option value="work">Work</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description
              <span className="ml-1 text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this topic about?"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Topic'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.key === 'all' ? (
              <LayoutGrid className="h-3.5 w-3.5" />
            ) : (
              (() => {
                const Icon = AREA_ICONS[tab.key];
                return <Icon className="h-3.5 w-3.5" />;
              })()
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Topics List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            <p>No topics found.</p>
            {activeTab !== 'all' && (
              <p className="mt-1 text-sm">
                Try selecting a different area or create a new topic.
              </p>
            )}
          </div>
        ) : (
          filtered.map((topic) => {
            const colors = AREA_COLORS[topic.area];
            return (
              <Link
                key={topic.id}
                href={`/topics/${topic.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs font-medium capitalize',
                        colors.badge
                      )}
                    >
                      {topic.area}
                    </span>
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs font-medium capitalize',
                        STATUS_STYLES[topic.status]
                      )}
                    >
                      {topic.status}
                    </span>
                    <h3 className="truncate font-medium text-foreground">
                      {topic.title}
                    </h3>
                  </div>
                  {topic.description && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {topic.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
