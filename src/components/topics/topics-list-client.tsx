'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Topic, Area } from '@/types/database';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderClosed,
  Briefcase,
  User,
  LayoutGrid,
  Trash2,
  Loader2,
  Tag,
  Calendar,
  Percent,
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

const RISK_STYLES: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  critical: 'bg-red-600/10 text-red-500 border-red-600/20',
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
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Form state
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<Area>('personal');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCleanDuplicates = async () => {
    setCleaning(true);
    try {
      const res = await fetch('/api/topics/cleanup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.deleted > 0) {
          toast.success(`Cleaned up ${data.deleted} duplicate topics. ${data.remaining} remaining.`);
          router.refresh();
        } else {
          toast.info('No duplicate topics found.');
        }
      } else {
        toast.error('Failed to clean duplicates');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCleaning(false);
    }
  };

  const filtered = activeTab === 'all'
    ? topics
    : topics.filter((t) => t.area === activeTab);

  // Group by folder
  const grouped = useMemo(() => {
    const folderMap = new Map<string, Topic[]>();
    const unfiled: Topic[] = [];

    for (const topic of filtered) {
      const f = topic.folder?.trim();
      if (f) {
        const existing = folderMap.get(f) ?? [];
        existing.push(topic);
        folderMap.set(f, existing);
      } else {
        unfiled.push(topic);
      }
    }

    // Sort folders alphabetically
    const sortedFolders = Array.from(folderMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return { folders: sortedFolders, unfiled };
  }, [filtered]);

  // Collect unique folder names for the form dropdown
  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => { if (t.folder?.trim()) set.add(t.folder.trim()); });
    return Array.from(set).sort();
  }, [topics]);

  const toggleFolder = (name: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          area,
          description,
          folder: folder.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Failed to create topic');
        return;
      }

      setTitle('');
      setArea('personal');
      setDescription('');
      setFolder('');
      setShowForm(false);
      toast.success('Topic created');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (topic: Topic) => {
    if (!confirm(`Delete "${topic.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/topics/${topic.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Deleted "${topic.title}"`);
        router.refresh();
      } else {
        toast.error('Failed to delete topic');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const renderTopicCard = (topic: Topic) => {
    const colors = AREA_COLORS[topic.area];
    return (
      <div
        key={topic.id}
        className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
      >
        <Link href={`/topics/${topic.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium capitalize', colors.badge)}>
              {topic.area}
            </span>
            <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[topic.status])}>
              {topic.status}
            </span>
            {topic.risk_level && (
              <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium capitalize', RISK_STYLES[topic.risk_level])}>
                {topic.risk_level}
              </span>
            )}
            <h3 className="truncate font-medium text-foreground">{topic.title}</h3>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            {topic.description && (
              <span className="truncate max-w-[300px]">{topic.description}</span>
            )}
            {topic.due_date && (
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="h-3 w-3" />
                {new Date(topic.due_date).toLocaleDateString()}
              </span>
            )}
            {topic.progress_percent != null && (
              <span className="flex items-center gap-1 shrink-0">
                <Percent className="h-3 w-3" />
                {topic.progress_percent}%
              </span>
            )}
            {topic.tags && topic.tags.length > 0 && (
              <span className="flex items-center gap-1 shrink-0">
                <Tag className="h-3 w-3" />
                {topic.tags.slice(0, 3).join(', ')}
              </span>
            )}
            {topic.client && (
              <span className="shrink-0 truncate max-w-[120px]">{topic.client}</span>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(topic); }}
            className="rounded p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete topic"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleCleanDuplicates}
            disabled={cleaning}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/30 disabled:opacity-50"
          >
            {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clean Duplicates
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {showForm ? (
              <><X className="h-4 w-4" /> Cancel</>
            ) : (
              <><Plus className="h-4 w-4" /> Create Topic</>
            )}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">New Topic</h2>

          {error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-foreground">Title</label>
              <input
                id="title" type="text" required value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q1 Marketing Campaign, Home Renovation..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="folder" className="block text-sm font-medium text-foreground">
                Folder <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="folder" type="text" value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="e.g. Client Projects, Side Hustles..."
                list="folder-options"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <datalist id="folder-options">
                {existingFolders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <label htmlFor="area" className="block text-sm font-medium text-foreground">Area</label>
              <select
                id="area" value={area} onChange={(e) => setArea(e.target.value as Area)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="personal">Personal</option>
                <option value="career">Career</option>
                <option value="work">Work</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description <span className="ml-1 text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="description" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="What is this topic about?"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit" disabled={creating}
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

      {/* Topics List — Grouped by Folder */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            <p>No topics found.</p>
            {activeTab !== 'all' && (
              <p className="mt-1 text-sm">Try selecting a different area or create a new topic.</p>
            )}
          </div>
        ) : (
          <>
            {/* Folder groups */}
            {grouped.folders.map(([folderName, folderTopics]) => {
              const isCollapsed = collapsedFolders.has(folderName);
              return (
                <div key={folderName} className="space-y-2">
                  <button
                    onClick={() => toggleFolder(folderName)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2.5 text-left transition-colors hover:bg-card"
                  >
                    {isCollapsed ? (
                      <FolderClosed className="h-4 w-4 text-amber-400" />
                    ) : (
                      <FolderOpen className="h-4 w-4 text-amber-400" />
                    )}
                    <span className="text-sm font-semibold text-foreground">{folderName}</span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                      {folderTopics.length}
                    </span>
                    {isCollapsed ? (
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {!isCollapsed && (
                    <div className="ml-4 space-y-2 border-l-2 border-amber-400/20 pl-4">
                      {folderTopics.map(renderTopicCard)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unfiled topics */}
            {grouped.unfiled.length > 0 && (
              <>
                {grouped.folders.length > 0 && (
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unfiled</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className="space-y-2">
                  {grouped.unfiled.map(renderTopicCard)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
