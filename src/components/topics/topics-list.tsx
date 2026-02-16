'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeDate } from '@/lib/utils';
import { SourceIcon } from '@/components/ui/source-icon';
import { toast } from 'sonner';
import { Plus, Filter, X, Search, Sparkles, ArrowUpDown, FolderPlus, Folder, FolderOpen, ChevronRight, ChevronDown, MoreHorizontal, Edit3, Trash2, MoveRight, Tag, Wand2, Loader2, Brain, Clock, Users, Paperclip, AlertTriangle, TrendingUp, Activity, Heart, StickyNote, Mail, Calendar, FileText, MessageSquare, BookOpen, Zap, Eye, Star, Archive, Pin, GripVertical, Inbox, BarChart3, CheckCircle2, CircleDot } from 'lucide-react';
import Link from 'next/link';

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  area: string;
  priority: number;
  due_date: string | null;
  updated_at: string;
  urgency_score: number | null;
  tags: string[];
  summary: string | null;
  folder_id: string | null;
  owner: string | null;
  stakeholders: string[] | null;
  progress_percent: number | null;
  notes: string | null;
  topic_items: { count: number }[];
  recent_items?: Array<{ title: string; source: string; occurred_at: string }>;
  source_counts?: Record<string, number>;
}

interface FolderType {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  area?: string | null;
}

export function TopicsList({ initialTopics, initialFolders }: { initialTopics: Topic[]; initialFolders: FolderType[] }) {
  const [topics, setTopics] = useState(initialTopics);
  const [folders, setFolders] = useState(initialFolders);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('work');
  const [dueDate, setDueDate] = useState('');
  const [createFolderId, setCreateFolderId] = useState<string | null>(null);

  // Folder state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(folders.map(f => f.id)));
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [newFolderArea, setNewFolderArea] = useState<string>('');
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [movingTopic, setMovingTopic] = useState<string | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'folders' | 'flat'>('folders');

  // Bulk selection state
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // AI state
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  // Reorganization state
  const [reorgSuggestions, setReorgSuggestions] = useState<string | null>(null);
  const [showReorg, setShowReorg] = useState(false);
  const [reorgLoading, setReorgLoading] = useState(false);

  // Stats filter state
  const [statsFilter, setStatsFilter] = useState<string | null>(null);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const handleCreate = async () => {
    if (!title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('topics').insert({
      title: title.trim(),
      description: description.trim() || null,
      area,
      due_date: dueDate || null,
      folder_id: createFolderId || null,
      user_id: user!.id,
      status: 'active',
    }).select('*, topic_items(count)').single();
    if (error) { toast.error(error.message); return; }
    setTopics([data, ...topics]);
    setTitle(''); setDescription(''); setDueDate(''); setCreateFolderId(null); setShowCreate(false);
    toast.success('Topic created');
  };

  // Folder CRUD
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim(), parent_id: newFolderParent, area: newFolderArea || null }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    setFolders([...folders, data.folder]);
    setExpandedFolders(prev => new Set([...prev, data.folder.id]));
    setNewFolderName(''); setShowCreateFolder(false); setNewFolderParent(null); setNewFolderArea('');
    toast.success('Folder created');
  };

  const renameFolder = async (folderId: string) => {
    if (!editFolderName.trim()) return;
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editFolderName.trim() }),
    });
    if (!res.ok) { toast.error('Failed to rename'); return; }
    setFolders(folders.map(f => f.id === folderId ? { ...f, name: editFolderName.trim() } : f));
    setEditingFolder(null); setEditFolderName('');
    toast.success('Folder renamed');
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Topics will be moved out.')) return;
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    setFolders(folders.filter(f => f.id !== folderId));
    setTopics(topics.map(t => t.folder_id === folderId ? { ...t, folder_id: null } : t));
    toast.success('Folder deleted');
  };

  const moveTopicToFolder = async (topicId: string, folderId: string | null) => {
    const res = await fetch(`/api/topics/${topicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    });
    if (!res.ok) { toast.error('Failed to move topic'); return; }
    setTopics(topics.map(t => t.id === topicId ? { ...t, folder_id: folderId } : t));
    setMovingTopic(null);
    toast.success('Topic moved');
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  // Bulk actions
  const toggleTopicSelection = (topicId: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  const bulkChangeStatus = async (newStatus: string) => {
    if (selectedTopics.size === 0) return;
    setBulkActionLoading(true);
    let success = 0;
    for (const topicId of selectedTopics) {
      try {
        const res = await fetch(`/api/topics/${topicId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) {
          setTopics(prev => prev.map(t => t.id === topicId ? { ...t, status: newStatus } : t));
          success++;
        }
      } catch {}
    }
    setSelectedTopics(new Set());
    setBulkActionLoading(false);
    toast.success(`Updated ${success} topic${success !== 1 ? 's' : ''} to ${newStatus}`);
  };

  // AI Agents
  const runAgent = useCallback(async (agent: string, context: Record<string, unknown> = {}) => {
    setAiLoading(agent);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (agent === 'suggest_topics' && data.result?.suggestions) {
        toast.success(`AI suggested ${data.result.suggestions.length} new topics`);
        return data.result.suggestions;
      }
      return data.result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI agent failed');
      return null;
    } finally {
      setAiLoading(null);
    }
  }, []);

  const [aiSuggestions, setAiSuggestions] = useState<Array<{ title: string; description: string; area: string; reason: string }>>([]);

  const handleSuggestTopics = async () => {
    const result = await runAgent('suggest_topics');
    if (result) setAiSuggestions(result);
  };

  const createSuggestedTopic = async (suggestion: { title: string; description: string; area: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('topics').insert({
      title: suggestion.title,
      description: suggestion.description,
      area: suggestion.area,
      user_id: user!.id,
      status: 'active',
    }).select('*, topic_items(count)').single();
    if (error) { toast.error(error.message); return; }
    setTopics([data, ...topics]);
    setAiSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
    toast.success(`Created "${suggestion.title}"`);
  };

  const runReorganize = async () => {
    setReorgLoading(true);
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'reorganize_folders', context: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReorgSuggestions(data.result.suggestions);
      setShowReorg(true);
      toast.success('Organization analysis complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    }
    setReorgLoading(false);
  };

  // Build folder tree
  const folderTree = useMemo(() => {
    const rootFolders = folders.filter(f => !f.parent_id);
    const getChildren = (parentId: string): FolderType[] => folders.filter(f => f.parent_id === parentId);
    interface FolderTreeNode { folder: FolderType; children: FolderTreeNode[]; depth: number; }
    const buildTree = (folder: FolderType, depth: number): FolderTreeNode => ({
      folder,
      children: getChildren(folder.id).map(c => buildTree(c, depth + 1)),
      depth,
    });
    return rootFolders.map(f => buildTree(f, 0));
  }, [folders]);

  // Get folder path (breadcrumb)
  const getFolderPath = useCallback((folderId: string): string[] => {
    const path: string[] = [];
    let current = folders.find(f => f.id === folderId);
    while (current) {
      path.unshift(current.name);
      current = current.parent_id ? folders.find(f => f.id === current!.parent_id) : undefined;
    }
    return path;
  }, [folders]);

  // Filtered and sorted topics
  const filteredTopics = useMemo(() => {
    let result = [...topics];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    }
    if (filterArea !== 'all') result = result.filter(t => t.area === filterArea);
    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus);
    // Stats filter
    if (statsFilter === 'overdue') {
      result = result.filter(t => t.due_date && new Date(t.due_date).getTime() < Date.now() && t.status === 'active');
    } else if (statsFilter === 'recent') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = result.filter(t => new Date(t.updated_at).getTime() >= sevenDaysAgo);
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'updated_at': return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'priority': return (b.priority || 0) - (a.priority || 0);
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'items': return (b.topic_items?.[0]?.count || 0) - (a.topic_items?.[0]?.count || 0);
        case 'title': return a.title.localeCompare(b.title);
        default: return 0;
      }
    });
    return result;
  }, [topics, searchQuery, filterArea, filterStatus, sortBy, statsFilter]);

  const areaColors: Record<string, string> = {
    work: 'bg-blue-100 text-blue-700',
    personal: 'bg-green-100 text-green-700',
    career: 'bg-purple-100 text-purple-700',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-gray-100 text-gray-600',
    archived: 'bg-amber-100 text-amber-700',
  };

  const areaCounts = useMemo(() => topics.reduce((acc, t) => { acc[t.area] = (acc[t.area] || 0) + 1; return acc; }, {} as Record<string, number>), [topics]);

  // Dashboard stats computation
  const dashboardStats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const activeTopics = topics.filter(t => t.status === 'active');
    const overdueTopics = topics.filter(t => t.due_date && new Date(t.due_date).getTime() < now && t.status === 'active');
    const updatedThisWeek = topics.filter(t => new Date(t.updated_at).getTime() >= sevenDaysAgo);
    const totalItems = topics.reduce((sum, t) => sum + (t.topic_items?.[0]?.count || 0), 0);
    const avgItems = topics.length > 0 ? Math.round((totalItems / topics.length) * 10) / 10 : 0;

    return {
      active: activeTopics.length,
      overdue: overdueTopics.length,
      updatedThisWeek: updatedThisWeek.length,
      avgItems,
    };
  }, [topics]);

  // Helper: check if any filter is active
  const hasActiveFilters = searchQuery.trim() !== '' || filterArea !== 'all' || filterStatus !== 'active' || statsFilter !== null;

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterArea('all');
    setFilterStatus('active');
    setStatsFilter(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      if (e.key === 'Escape') {
        if (hasActiveFilters) {
          clearAllFilters();
          e.preventDefault();
        }
        return;
      }

      if (isInput) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowCreate(true);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasActiveFilters]);

  // Topic health score calculation
  const getTopicHealth = useCallback((t: Topic) => {
    let score = 100;
    let issues: string[] = [];
    const daysSinceUpdate = Math.floor((Date.now() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    const itemCount = t.topic_items?.[0]?.count || 0;

    // Stale check
    if (daysSinceUpdate > 14) { score -= 30; issues.push('Stale (14+ days)'); }
    else if (daysSinceUpdate > 7) { score -= 15; issues.push('Getting stale'); }

    // Missing description
    if (!t.description) { score -= 10; issues.push('No description'); }

    // No items linked
    if (itemCount === 0) { score -= 20; issues.push('No linked items'); }

    // Overdue
    if (t.due_date && new Date(t.due_date) < new Date()) { score -= 25; issues.push('Overdue'); }

    // No tags
    if (!t.tags || t.tags.length === 0) { score -= 5; issues.push('No tags'); }

    // No progress tracking
    if (t.progress_percent === null || t.progress_percent === undefined) { score -= 5; }

    score = Math.max(0, Math.min(100, score));
    const color = score >= 80 ? 'text-green-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
    const bgColor = score >= 80 ? 'bg-green-50' : score >= 50 ? 'bg-amber-50' : 'bg-red-50';
    const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Critical';

    return { score, issues, color, bgColor, label };
  }, []);

  // Freshness health dot helper
  const getFreshnessDot = (updatedAt: string) => {
    const daysSince = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 7) return { color: 'bg-green-500', ring: 'ring-green-500/20', label: 'Fresh' };
    if (daysSince < 30) return { color: 'bg-amber-500', ring: 'ring-amber-500/20', label: 'Stale' };
    return { color: 'bg-red-500', ring: 'ring-red-500/20', label: 'Very stale' };
  };

  // Priority stars helper
  const renderPriorityStars = (priority: number) => {
    if (priority <= 0) return null;
    const stars = Math.min(priority, 5);
    return (
      <span className="inline-flex items-center gap-0.5" title={`Priority ${priority}`}>
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} className={`w-3 h-3 ${i < 3 ? 'fill-amber-400 text-amber-400' : i < 4 ? 'fill-amber-300 text-amber-300' : 'fill-amber-200 text-amber-200'}`} />
        ))}
      </span>
    );
  };

  // Render a topic card (enhanced - compact design)
  const renderTopicCard = (t: Topic) => {
    const itemCount = t.topic_items?.[0]?.count || 0;
    const overdue = t.due_date && new Date(t.due_date) < new Date();
    const daysUntilDue = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const freshness = getFreshnessDot(t.updated_at);
    const contactCount = (t.stakeholders || []).length;

    return (
      <div key={t.id} className="group relative">
        {/* Checkbox */}
        <div className="absolute top-3 left-3 z-10">
          <input type="checkbox" checked={selectedTopics.has(t.id)}
            onChange={(e) => { e.stopPropagation(); toggleTopicSelection(t.id); }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity cursor-pointer" />
        </div>
        <Link href={`/topics/${t.id}`}
          className="block px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all shadow-sm group-hover:bg-gray-50/30">
          {/* Row 1: Health dot + Title + Status + Area + Priority */}
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ring-2 ${freshness.color} ${freshness.ring}`} title={freshness.label} />
            <h3 className="font-semibold text-gray-900 truncate text-sm">{t.title}</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${statusColors[t.status] || 'bg-gray-100 text-gray-600'}`}>
              {t.status}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${areaColors[t.area] || 'bg-gray-100 text-gray-600'}`}>
              {t.area}
            </span>
            {renderPriorityStars(t.priority)}
            {overdue && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex-shrink-0 flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> Overdue
              </span>
            )}
            {/* Tags inline */}
            {(t.tags || []).slice(0, 2).map(tag => (
              <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0 hidden lg:inline-block">
                {tag}
              </span>
            ))}
            {(t.tags || []).length > 2 && (
              <span className="text-[11px] text-gray-400 flex-shrink-0 hidden lg:inline-block">+{t.tags.length - 2}</span>
            )}
          </div>
          {/* Row 2: Meta stats */}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 pl-4">
            {itemCount > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> {itemCount} item{itemCount !== 1 ? 's' : ''}
              </span>
            )}
            {contactCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {contactCount} contact{contactCount !== 1 ? 's' : ''}
              </span>
            )}
            {t.due_date && !overdue && (
              <span className={`flex items-center gap-1 ${daysUntilDue !== null && daysUntilDue <= 3 ? 'text-amber-500' : ''}`}>
                <Clock className="w-3 h-3" />
                {daysUntilDue === 0 ? 'Due today' : `${daysUntilDue}d left`}
              </span>
            )}
            {t.progress_percent != null && (
              <span className="flex items-center gap-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${t.progress_percent}%` }} />
                </div>
                {t.progress_percent}%
              </span>
            )}
            {t.summary && (
              <span className="flex items-center gap-1 text-purple-400">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            )}
            {/* Source badges */}
            {t.source_counts && Object.keys(t.source_counts).length > 0 && (
              Object.entries(t.source_counts).slice(0, 3).map(([src, count]) => {
                const icons: Record<string, typeof Mail> = { gmail: Mail, calendar: Calendar, drive: FileText, slack: MessageSquare, notion: BookOpen, manual: StickyNote };
                const Icon = icons[src] || Paperclip;
                return (
                  <span key={src} className="flex items-center gap-0.5 text-gray-400">
                    <Icon className="w-3 h-3" /> {count as number}
                  </span>
                );
              })
            )}
            <span className="ml-auto text-gray-400">{formatRelativeDate(t.updated_at)}</span>
          </div>
        </Link>
        {/* Quick action buttons on hover - Edit, Move, Pin, Archive */}
        <div className="absolute top-2 right-12 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all z-10">
          <Link href={`/topics/${t.id}`} onClick={(e) => e.stopPropagation()}
            className="p-1.5 bg-white border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-lg shadow-sm transition-colors" title="Edit">
            <Edit3 className="w-3 h-3" />
          </Link>
          <button onClick={(e) => { e.preventDefault(); setMovingTopic(t.id); }}
            className="p-1.5 bg-white border border-gray-200 text-gray-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 rounded-lg shadow-sm transition-colors" title="Move to folder">
            <Folder className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.preventDefault(); /* pin/priority toggle placeholder */ }}
            className="p-1.5 bg-white border border-gray-200 text-gray-400 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-200 rounded-lg shadow-sm transition-colors" title="Pin / Priority">
            <Pin className="w-3 h-3" />
          </button>
          <button onClick={async (e) => {
              e.preventDefault();
              const res = await fetch(`/api/topics/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }) });
              if (res.ok) { setTopics(prev => prev.map(x => x.id === t.id ? { ...x, status: 'archived' } : x)); toast.success('Topic archived'); }
            }}
            className="p-1.5 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg shadow-sm transition-colors" title="Archive">
            <Archive className="w-3 h-3" />
          </button>
        </div>
        {/* Move to folder dropdown */}
        {movingTopic === t.id && (
          <div className="absolute top-2 right-2 z-20 bg-white border rounded-lg shadow-lg p-2 text-xs space-y-1 min-w-[160px]">
            <button onClick={() => moveTopicToFolder(t.id, null)} className="w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded flex items-center gap-2">
              <X className="w-3 h-3" /> No folder
            </button>
            {folders.map(f => (
              <button key={f.id} onClick={() => moveTopicToFolder(t.id, f.id)} className="w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded flex items-center gap-2">
                <Folder className="w-3 h-3" /> {f.name}
              </button>
            ))}
            <button onClick={() => setMovingTopic(null)} className="w-full text-left px-2 py-1.5 hover:bg-red-50 text-red-600 rounded">Cancel</button>
          </div>
        )}
      </div>
    );
  };

  // Render folder tree node (improved with indentation guides and drag indicator)
  const renderFolderNode = (node: { folder: FolderType; children: any[]; depth: number }) => {
    const folderTopics = filteredTopics.filter(t => t.folder_id === node.folder.id);
    const isExpanded = expandedFolders.has(node.folder.id);
    // Recursively count all topics in this folder and subfolders
    const countDeep = (n: { folder: FolderType; children: any[] }): number => {
      const direct = filteredTopics.filter(t => t.folder_id === n.folder.id).length;
      return direct + n.children.reduce((sum: number, c: any) => sum + countDeep(c), 0);
    };
    const totalCount = countDeep(node);

    return (
      <div key={node.folder.id} className="mb-0.5">
        <div className={`flex items-center gap-1 py-2 px-2 rounded-lg hover:bg-gray-50 group/folder relative transition-colors`}
          style={{ marginLeft: `${node.depth * 20}px` }}>
          {/* Indentation guide lines */}
          {node.depth > 0 && (
            <div className="absolute left-0 top-0 bottom-0" style={{ left: `${-4}px` }}>
              <div className="w-px h-full bg-gray-200" />
            </div>
          )}
          {/* Drag indicator on hover */}
          <span className="opacity-0 group-hover/folder:opacity-40 transition-opacity cursor-grab text-gray-400 -ml-1 mr-0.5">
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <button onClick={() => toggleFolder(node.folder.id)} className="p-0.5 text-gray-400 hover:text-gray-600 transition-transform">
            <span className={`block transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
              <ChevronDown className="w-4 h-4" />
            </span>
          </button>
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )}
          {editingFolder === node.folder.id ? (
            <div className="flex items-center gap-1 flex-1">
              <input value={editFolderName} onChange={e => setEditFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') renameFolder(node.folder.id); if (e.key === 'Escape') setEditingFolder(null); }}
                className="text-sm px-1 py-0.5 border rounded flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
              <button onClick={() => renameFolder(node.folder.id)} className="text-blue-600 text-xs">Save</button>
            </div>
          ) : (
            <span className="text-sm font-medium text-gray-700 flex-1 cursor-pointer flex items-center gap-1.5" onClick={() => toggleFolder(node.folder.id)}>
              {node.folder.name}
              {node.folder.area && (
                <span className={`text-[11px] px-1.5 py-0 rounded-full ${areaColors[node.folder.area] || 'bg-gray-100 text-gray-600'}`}>
                  {node.folder.area}
                </span>
              )}
              <span className={`text-[11px] font-normal px-1.5 py-0.5 rounded-full flex-shrink-0 ${totalCount > 0 ? 'bg-gray-100 text-gray-600' : 'text-gray-300'}`}>
                {totalCount}
              </span>
            </span>
          )}
          <div className="flex gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity">
            <button onClick={() => { setNewFolderParent(node.folder.id); setShowCreateFolder(true); }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Add subfolder">
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setEditingFolder(node.folder.id); setEditFolderName(node.folder.name); }}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Rename">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteFolder(node.folder.id)}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {/* Collapsible content with animation */}
        <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="relative" style={{ marginLeft: `${node.depth * 20 + 10}px` }}>
            {/* Vertical indentation guide for children */}
            {(node.children.length > 0 || folderTopics.length > 0) && (
              <div className="absolute left-[6px] top-0 bottom-2 w-px bg-gray-200" />
            )}
            {node.children.map((child: any) => renderFolderNode(child))}
            <div className="space-y-1.5 mt-1 mb-2 ml-3">
              {folderTopics.map(t => renderTopicCard(t))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const unfolderedTopics = filteredTopics.filter(t => !t.folder_id);

  return (
    <div>
      {/* Dashboard Stats Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <button onClick={() => { setStatsFilter(statsFilter === 'active' ? null : 'active'); setFilterStatus('active'); setFilterArea('all'); }}
          className={`p-3 rounded-xl border text-left transition-all ${statsFilter === 'active' ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Active Topics</span>
            <CircleDot className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardStats.active}</p>
        </button>
        <button onClick={() => {
            if (dashboardStats.overdue > 0) {
              setStatsFilter(statsFilter === 'overdue' ? null : 'overdue');
              setFilterStatus('active');
            }
          }}
          className={`p-3 rounded-xl border text-left transition-all ${statsFilter === 'overdue' ? 'border-red-300 bg-red-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Overdue</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${dashboardStats.overdue > 0 ? 'text-red-500' : 'text-gray-300'}`} />
          </div>
          <p className={`text-2xl font-bold mt-1 ${dashboardStats.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{dashboardStats.overdue}</p>
        </button>
        <button onClick={() => { setStatsFilter(statsFilter === 'recent' ? null : 'recent'); }}
          className={`p-3 rounded-xl border text-left transition-all ${statsFilter === 'recent' ? 'border-green-300 bg-green-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Updated This Week</span>
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardStats.updatedThisWeek}</p>
        </button>
        <div className="p-3 rounded-xl border border-gray-100 bg-white text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Avg Items/Topic</span>
            <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardStats.avgItems}</p>
        </div>
      </div>

      {/* Search + Actions bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input ref={searchInputRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search topics... (press / to focus)" className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors flex-shrink-0">
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'New Topic'}
        </button>
        <button onClick={() => { setShowCreateFolder(!showCreateFolder); setNewFolderParent(null); }}
          className="px-3 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 flex items-center gap-2 transition-colors flex-shrink-0">
          <FolderPlus className="w-4 h-4" /> Folder
        </button>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors flex-shrink-0 ${
            showFilters ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {/* AI Agents Bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={handleSuggestTopics} disabled={!!aiLoading}
          className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 flex items-center gap-1.5 disabled:opacity-50">
          {aiLoading === 'suggest_topics' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          AI Suggest Topics
        </button>
        {(() => {
          const staleCount = topics.filter(t => {
            const daysSince = Math.floor((Date.now() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24));
            return daysSince > 7 && t.status === 'active';
          }).length;
          if (staleCount > 0) return (
            <button onClick={() => { setSearchQuery(''); setFilterStatus('active'); setSortBy('updated_at'); }}
              className="px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {staleCount} Stale Topic{staleCount !== 1 ? 's' : ''}
            </button>
          );
          return null;
        })()}
        <button onClick={runReorganize} disabled={reorgLoading || !!aiLoading}
          className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 flex items-center gap-1.5 disabled:opacity-50">
          {reorgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          AI Reorganize
        </button>
        <button onClick={() => setViewMode(viewMode === 'folders' ? 'flat' : 'folders')}
          className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border ${
            viewMode === 'folders' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-gray-200'
          }`}>
          <Folder className="w-3.5 h-3.5" /> {viewMode === 'folders' ? 'Folder View' : 'Flat View'}
        </button>
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> AI Suggested Topics
          </h3>
          <div className="space-y-2">
            {aiSuggestions.map((s, i) => (
              <div key={i} className="flex items-start justify-between gap-3 p-3 bg-white rounded-lg border border-purple-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  <p className="text-xs text-purple-600 mt-1 italic">{s.reason}</p>
                </div>
                <button onClick={() => createSuggestedTopic(s)}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 flex-shrink-0">
                  Create
                </button>
              </div>
            ))}
            <button onClick={() => setAiSuggestions([])} className="text-xs text-purple-600 hover:underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* AI Reorganization Suggestions */}
      {showReorg && reorgSuggestions && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> Folder Reorganization Suggestions
            </h3>
            <button onClick={() => setShowReorg(false)} className="p-1 text-indigo-400 hover:text-indigo-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none text-sm text-gray-700 bg-white rounded-lg p-4 border border-indigo-100 max-h-[500px] overflow-y-auto">
            {reorgSuggestions.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-indigo-900 mt-3 mb-1 text-sm">{line.replace('## ', '')}</h3>;
              if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-indigo-800 mt-2 mb-1 text-sm">{line.replace('### ', '')}</h4>;
              if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm text-gray-700 mt-0.5">{line.slice(2)}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-sm text-gray-700 mt-1">{line}</p>;
            })}
          </div>
          <p className="text-xs text-indigo-500 mt-2">These are AI suggestions. Review and apply them manually as needed.</p>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Area</label>
              <div className="flex gap-1">
                <button onClick={() => setFilterArea('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterArea === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
                {(['work', 'personal', 'career'] as const).map(a => (
                  <button key={a} onClick={() => setFilterArea(a)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterArea === a ? 'bg-gray-900 text-white' : `${areaColors[a]} hover:opacity-80`}`}>
                    {a} {areaCounts[a] ? `(${areaCounts[a]})` : ''}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Status</label>
              <div className="flex gap-1">
                <button onClick={() => setFilterStatus('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
                {(['active', 'completed', 'archived'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-gray-900 text-white' : `${statusColors[s]} hover:opacity-80`}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <ArrowUpDown className="w-3 h-3 text-gray-400" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 text-gray-600 bg-white">
                <option value="updated_at">Last Updated</option>
                <option value="priority">Priority</option>
                <option value="due_date">Due Date</option>
                <option value="items">Item Count</option>
                <option value="title">Title</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Active filters:</span>
          {searchQuery.trim() && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Search: &ldquo;{searchQuery}&rdquo;
              <button onClick={() => setSearchQuery('')} className="ml-0.5 hover:text-blue-900"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterArea !== 'all' && (
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${areaColors[filterArea] || 'bg-gray-50 text-gray-600'} border-current/20`}>
              Area: {filterArea}
              <button onClick={() => setFilterArea('all')} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterStatus !== 'active' && (
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${statusColors[filterStatus] || 'bg-gray-50 text-gray-600'} border-current/20`}>
              Status: {filterStatus}
              <button onClick={() => setFilterStatus('active')} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
          {statsFilter && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Dashboard: {statsFilter}
              <button onClick={() => setStatsFilter(null)} className="ml-0.5 hover:text-purple-900"><X className="w-3 h-3" /></button>
            </span>
          )}
          <button onClick={clearAllFilters} className="text-xs text-red-600 hover:text-red-800 hover:underline ml-1">
            Clear all
          </button>
        </div>
      )}

      {/* Create folder form */}
      {showCreateFolder && (
        <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200 flex gap-2 items-center flex-wrap">
          <Folder className="w-4 h-4 text-amber-600" />
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowCreateFolder(false); }}
            placeholder="Folder name" className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[150px]" autoFocus />
          <select value={newFolderArea} onChange={e => setNewFolderArea(e.target.value)}
            className="px-2 py-1.5 border rounded-lg text-xs text-gray-600">
            <option value="">No area</option>
            <option value="work">Work</option>
            <option value="personal">Personal</option>
            <option value="career">Career</option>
          </select>
          {folders.length > 0 && (
            <select value={newFolderParent || ''} onChange={e => setNewFolderParent(e.target.value || null)}
              className="px-2 py-1.5 border rounded-lg text-xs text-gray-600">
              <option value="">Root level</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{getFolderPath(f.id).join(' / ')}</option>
              ))}
            </select>
          )}
          <button onClick={createFolder} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">Create</button>
          <button onClick={() => setShowCreateFolder(false)} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create topic form */}
      {showCreate && (
        <div className="mb-4 p-4 bg-white rounded-xl border border-blue-200 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Create New Topic</h3>
          <input value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Topic title" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)" className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          <div className="flex gap-3 items-center flex-wrap">
            <select value={area} onChange={e => setArea(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="career">Career</option>
            </select>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            {folders.length > 0 && (
              <select value={createFolderId || ''} onChange={e => setCreateFolderId(e.target.value || null)} className="px-3 py-2 border rounded-lg text-sm">
                <option value="">No folder</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{getFolderPath(f.id).join(' / ')}</option>
                ))}
              </select>
            )}
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Create</button>
          </div>
        </div>
      )}

      {/* Bulk actions toolbar */}
      {selectedTopics.size > 0 && (
        <div className="mb-3 p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center gap-3 animate-fade-in">
          <span className="text-sm font-medium text-blue-700">{selectedTopics.size} selected</span>
          <div className="flex gap-2">
            <button onClick={() => bulkChangeStatus('completed')} disabled={bulkActionLoading}
              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 disabled:opacity-50">
              Mark Complete
            </button>
            <button onClick={() => bulkChangeStatus('archived')} disabled={bulkActionLoading}
              className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 disabled:opacity-50">
              Archive
            </button>
            <button onClick={() => bulkChangeStatus('active')} disabled={bulkActionLoading}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 disabled:opacity-50">
              Reactivate
            </button>
          </div>
          <button onClick={() => setSelectedTopics(new Set())} className="ml-auto text-xs text-blue-600 hover:text-blue-800">
            Clear selection
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {filteredTopics.length === topics.length
              ? `${filteredTopics.length} topic${filteredTopics.length !== 1 ? 's' : ''}`
              : `Showing ${filteredTopics.length} of ${topics.length} topics`
            }
          </span>
          {filteredTopics.length > 0 && (
            <button onClick={() => {
              if (selectedTopics.size === filteredTopics.length) setSelectedTopics(new Set());
              else setSelectedTopics(new Set(filteredTopics.map(t => t.id)));
            }} className="text-xs text-blue-600 hover:text-blue-800">
              {selectedTopics.size === filteredTopics.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
        <div className="text-[11px] text-gray-400 flex items-center gap-3">
          <span title="New topic">N</span>
          <span title="Focus search">/</span>
          <span title="Clear filters">Esc</span>
        </div>
      </div>

      {/* Topic list */}
      {filteredTopics.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
          {/* Empty state illustration */}
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">
            {hasActiveFilters ? 'No matching topics' : 'No topics yet'}
          </h3>
          <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
            {hasActiveFilters
              ? `No topics match your current filters.${searchQuery ? ` Try a different search term.` : ''}`
              : 'Create your first topic to start organizing your items, or import from your connected sources.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {hasActiveFilters && (
              <button onClick={clearAllFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Clear Filters
              </button>
            )}
            <button onClick={() => { setShowCreate(true); setSearchQuery(''); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Topic
            </button>
            <button onClick={handleSuggestTopics} disabled={!!aiLoading}
              className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center gap-2 disabled:opacity-50">
              <Brain className="w-4 h-4" /> Import from Sources
            </button>
          </div>
        </div>
      ) : viewMode === 'folders' && folders.length > 0 ? (
        <div>
          {/* Folder tree */}
          {folderTree.map(node => renderFolderNode(node))}
          {/* Unfiled topics */}
          {unfolderedTopics.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2 px-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Unfiled</span>
                <span className="text-xs text-gray-300">({unfolderedTopics.length})</span>
              </div>
              <div className="grid gap-1.5">
                {unfolderedTopics.map(t => renderTopicCard(t))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-1.5">
          {filteredTopics.map(t => renderTopicCard(t))}
        </div>
      )}
    </div>
  );
}
