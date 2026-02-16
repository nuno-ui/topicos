'use client';
import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeDate } from '@/lib/utils';
import { SourceIcon } from '@/components/ui/source-icon';
import { toast } from 'sonner';
import { Plus, Filter, X, Search, Sparkles, ArrowUpDown, FolderPlus, Folder, FolderOpen, ChevronRight, ChevronDown, MoreHorizontal, Edit3, Trash2, MoveRight, ArrowRightLeft, Tag, Wand2, Loader2, Brain, Clock, Users, Paperclip, AlertTriangle, TrendingUp, Activity, Heart, StickyNote, Mail, Calendar, FileText, MessageSquare, BookOpen, Zap, Eye, Star, Archive, Pin, GripVertical, Inbox, BarChart3, CheckCircle2, CircleDot, Flame, ShieldAlert, Hash, Briefcase, Home, Rocket, ArrowLeft, Code, Palette, Megaphone, DollarSign, Plane, Layers, FolderKanban } from 'lucide-react';
import Link from 'next/link';

// --- Area border color map for topic cards ---
const areaBorderColors: Record<string, string> = {
  work: 'border-l-blue-500',
  personal: 'border-l-green-500',
  career: 'border-l-purple-500',
};

// --- Tag color palette for pills ---
const tagPillColors = [
  'bg-sky-100 text-sky-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-violet-100 text-violet-700',
  'bg-lime-100 text-lime-700',
];

const priorityMeta: Record<number, { label: string; color: string; flame: boolean }> = {
  1: { label: 'Low', color: 'text-gray-400', flame: false },
  2: { label: 'Medium', color: 'text-blue-400', flame: false },
  3: { label: 'Medium-High', color: 'text-amber-500', flame: false },
  4: { label: 'High', color: 'text-orange-500', flame: true },
  5: { label: 'Critical', color: 'text-red-600', flame: true },
};

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

// --- Area card definitions for area-first navigation ---
const areaCardConfig: Record<string, {
  label: string;
  icon: typeof Briefcase;
  gradient: string;
  hoverGradient: string;
  iconBg: string;
  border: string;
  textColor: string;
  subtextColor: string;
  countBg: string;
  countText: string;
}> = {
  work: {
    label: 'Work',
    icon: Briefcase,
    gradient: 'from-blue-500 to-blue-600',
    hoverGradient: 'hover:from-blue-600 hover:to-blue-700',
    iconBg: 'bg-white/20',
    border: 'border-blue-400/30',
    textColor: 'text-white',
    subtextColor: 'text-blue-100',
    countBg: 'bg-white/20',
    countText: 'text-white',
  },
  personal: {
    label: 'Personal',
    icon: Heart,
    gradient: 'from-emerald-500 to-green-600',
    hoverGradient: 'hover:from-emerald-600 hover:to-green-700',
    iconBg: 'bg-white/20',
    border: 'border-green-400/30',
    textColor: 'text-white',
    subtextColor: 'text-green-100',
    countBg: 'bg-white/20',
    countText: 'text-white',
  },
  career: {
    label: 'Career',
    icon: Rocket,
    gradient: 'from-purple-500 to-violet-600',
    hoverGradient: 'hover:from-purple-600 hover:to-violet-700',
    iconBg: 'bg-white/20',
    border: 'border-purple-400/30',
    textColor: 'text-white',
    subtextColor: 'text-purple-100',
    countBg: 'bg-white/20',
    countText: 'text-white',
  },
};

// --- Contextual folder icon based on folder name ---
function getFolderIcon(folderName: string): typeof Folder {
  const name = folderName.toLowerCase();
  if (name.includes('dev') || name.includes('code') || name.includes('tech') || name.includes('eng')) return Code;
  if (name.includes('design') || name.includes('ui') || name.includes('ux')) return Palette;
  if (name.includes('market') || name.includes('campaign') || name.includes('ads')) return Megaphone;
  if (name.includes('finance') || name.includes('money') || name.includes('budget') || name.includes('invoice')) return DollarSign;
  if (name.includes('health') || name.includes('fitness') || name.includes('wellness')) return Heart;
  if (name.includes('learn') || name.includes('study') || name.includes('education') || name.includes('course')) return BookOpen;
  if (name.includes('travel') || name.includes('trip') || name.includes('vacation')) return Plane;
  if (name.includes('home') || name.includes('house') || name.includes('apartment')) return Home;
  if (name.includes('project') || name.includes('sprint')) return Layers;
  if (name.includes('client') || name.includes('customer') || name.includes('partner')) return Users;
  if (name.includes('meeting') || name.includes('calendar') || name.includes('schedule')) return Calendar;
  if (name.includes('email') || name.includes('mail') || name.includes('newsletter')) return Mail;
  if (name.includes('note') || name.includes('doc') || name.includes('writing')) return FileText;
  if (name.includes('idea') || name.includes('brain') || name.includes('research')) return Brain;
  return FolderKanban;
}

// --- Helper: highlight matching text in search results ---
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

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
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('work');
  const [dueDate, setDueDate] = useState('');
  const [createFolderId, setCreateFolderId] = useState<string | null>(null);
  const [createPriority, setCreatePriority] = useState(2);
  const [createTags, setCreateTags] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Bulk area change state
  const [showBulkAreaPicker, setShowBulkAreaPicker] = useState(false);

  // AI analyze all state
  const [aiAnalyzeAllLoading, setAiAnalyzeAllLoading] = useState(false);

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

  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (title.trim().length < 2) errors.title = 'Title must be at least 2 characters';
    if (dueDate) {
      const due = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) errors.dueDate = 'Due date cannot be in the past';
    }
    if (createStartDate && dueDate && new Date(createStartDate) > new Date(dueDate)) {
      errors.startDate = 'Start date must be before due date';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateCreateForm()) return;
    setCreateSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const parsedTags = createTags.split(',').map(t => t.trim()).filter(Boolean);
      const { data, error } = await supabase.from('topics').insert({
        title: title.trim(),
        description: description.trim() || null,
        area,
        due_date: dueDate || null,
        start_date: createStartDate || null,
        priority: createPriority,
        tags: parsedTags.length > 0 ? parsedTags : [],
        folder_id: createFolderId || null,
        user_id: user!.id,
        status: 'active',
      }).select('*, topic_items(count)').single();
      if (error) { toast.error(error.message); return; }
      setTopics([data, ...topics]);
      setTitle(''); setDescription(''); setDueDate(''); setCreateFolderId(null);
      setCreatePriority(2); setCreateTags(''); setCreateStartDate('');
      setFormErrors({});
      setShowCreate(false);
      toast.success('Topic created successfully!');
    } finally {
      setCreateSubmitting(false);
    }
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

  const changeFolderArea = async (folderId: string, newArea: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: newArea }),
      });
      if (!res.ok) throw new Error('Failed to update folder area');
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, area: newArea } : f));
      // Also update any topics inside this folder to the new area
      const topicsInFolder = topics.filter(t => t.folder_id === folderId);
      for (const t of topicsInFolder) {
        await fetch(`/api/topics/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area: newArea }),
        });
      }
      setTopics(prev => prev.map(t => t.folder_id === folderId ? { ...t, area: newArea } : t));
      toast.success(`Folder moved to ${newArea}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to move folder');
    }
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

  const bulkChangeArea = async (newArea: string) => {
    if (selectedTopics.size === 0) return;
    setBulkActionLoading(true);
    let success = 0;
    for (const topicId of selectedTopics) {
      try {
        const res = await fetch(`/api/topics/${topicId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area: newArea }),
        });
        if (res.ok) {
          setTopics(prev => prev.map(t => t.id === topicId ? { ...t, area: newArea } : t));
          success++;
        }
      } catch {}
    }
    setSelectedTopics(new Set());
    setBulkActionLoading(false);
    setShowBulkAreaPicker(false);
    toast.success(`Moved ${success} topic${success !== 1 ? 's' : ''} to ${newArea}`);
  };

  const handleAiAnalyzeAll = async () => {
    if (selectedTopics.size === 0) { toast.error('Select topics first'); return; }
    setAiAnalyzeAllLoading(true);
    let success = 0;
    for (const topicId of selectedTopics) {
      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId }),
        });
        if (res.ok) success++;
      } catch {}
    }
    setAiAnalyzeAllLoading(false);
    toast.success(`AI analyzed ${success} topic${success !== 1 ? 's' : ''}`);
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

  // Topic health score calculation (must be before filteredTopics)
  const getTopicHealth = useCallback((t: Topic) => {
    let score = 100;
    const issues: string[] = [];
    const daysSinceUpdate = Math.floor((Date.now() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    const itemCount = t.topic_items?.[0]?.count || 0;

    if (daysSinceUpdate > 14) { score -= 30; issues.push('Stale (14+ days)'); }
    else if (daysSinceUpdate > 7) { score -= 15; issues.push('Getting stale'); }
    if (!t.description) { score -= 10; issues.push('No description'); }
    if (itemCount === 0) { score -= 20; issues.push('No linked items'); }
    if (t.due_date && new Date(t.due_date) < new Date()) { score -= 25; issues.push('Overdue'); }
    if (!t.tags || t.tags.length === 0) { score -= 5; issues.push('No tags'); }
    if (t.progress_percent === null || t.progress_percent === undefined) { score -= 5; }

    score = Math.max(0, Math.min(100, score));
    const color = score >= 80 ? 'text-green-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
    const bgColor = score >= 80 ? 'bg-green-50' : score >= 50 ? 'bg-amber-50' : 'bg-red-50';
    const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Critical';

    return { score, issues, color, bgColor, label };
  }, []);

  // Filtered and sorted topics (memoized)
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
    } else if (statsFilter === 'needsAttention') {
      result = result.filter(t => {
        const health = getTopicHealth(t);
        return health.score < 50 && t.status === 'active';
      });
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
  }, [topics, searchQuery, filterArea, filterStatus, sortBy, statsFilter, getTopicHealth]);

  const areaCounts = useMemo(() => topics.reduce((acc, t) => { acc[t.area] = (acc[t.area] || 0) + 1; return acc; }, {} as Record<string, number>), [topics]);

  // Area-level stats for the area cards
  const areaStats = useMemo(() => {
    const stats: Record<string, { total: number; active: number; folders: number; overdue: number; recentlyUpdated: number }> = {};
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const a of ['work', 'personal', 'career']) {
      const areaTopics = topics.filter(t => t.area === a);
      const areaFolders = folders.filter(f => f.area === a);
      stats[a] = {
        total: areaTopics.length,
        active: areaTopics.filter(t => t.status === 'active').length,
        folders: areaFolders.length,
        overdue: areaTopics.filter(t => t.due_date && new Date(t.due_date).getTime() < Date.now() && t.status === 'active').length,
        recentlyUpdated: areaTopics.filter(t => new Date(t.updated_at).getTime() >= sevenDaysAgo).length,
      };
    }
    return stats;
  }, [topics, folders]);

  // Filtered topics and folders by selected area
  const areaFilteredTopics = useMemo(() => {
    if (!selectedArea) return filteredTopics;
    return filteredTopics.filter(t => t.area === selectedArea);
  }, [filteredTopics, selectedArea]);

  const areaFilteredFolders = useMemo(() => {
    if (!selectedArea) return folders;
    return folders.filter(f => f.area === selectedArea || !f.area);
  }, [folders, selectedArea]);

  const areaFolderTree = useMemo(() => {
    const relevantFolders = areaFilteredFolders;
    const rootFolders = relevantFolders.filter(f => !f.parent_id);
    const getChildren = (parentId: string): FolderType[] => relevantFolders.filter(f => f.parent_id === parentId);
    interface FolderTreeNode { folder: FolderType; children: FolderTreeNode[]; depth: number; }
    const buildTree = (folder: FolderType, depth: number): FolderTreeNode => ({
      folder,
      children: getChildren(folder.id).map(c => buildTree(c, depth + 1)),
      depth,
    });
    return rootFolders.map(f => buildTree(f, 0));
  }, [areaFilteredFolders]);

  const areaUnfolderedTopics = useMemo(() => {
    return areaFilteredTopics.filter(t => !t.folder_id);
  }, [areaFilteredTopics]);

  // Dashboard stats computation
  const dashboardStats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const activeTopics = topics.filter(t => t.status === 'active');
    const overdueTopics = topics.filter(t => t.due_date && new Date(t.due_date).getTime() < now && t.status === 'active');
    const updatedThisWeek = topics.filter(t => new Date(t.updated_at).getTime() >= sevenDaysAgo);
    const totalItems = topics.reduce((sum, t) => sum + (t.topic_items?.[0]?.count || 0), 0);
    const avgItems = topics.length > 0 ? Math.round((totalItems / topics.length) * 10) / 10 : 0;

    const needsAttention = topics.filter(t => {
      const health = getTopicHealth(t);
      return health.score < 50 && t.status === 'active';
    }).length;

    return {
      active: activeTopics.length,
      overdue: overdueTopics.length,
      updatedThisWeek: updatedThisWeek.length,
      avgItems,
      needsAttention,
    };
  }, [topics, getTopicHealth]);

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

  // Freshness health dot helper (kept for reference, no longer used in cards)
  const getFreshnessDot = (updatedAt: string) => {
    const daysSince = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 7) return { color: 'bg-green-500', ring: 'ring-green-500/20', label: 'Fresh' };
    if (daysSince < 30) return { color: 'bg-amber-500', ring: 'ring-amber-500/20', label: 'Stale' };
    return { color: 'bg-red-500', ring: 'ring-red-500/20', label: 'Very stale' };
  };

  // Priority indicator helper -- flames for high/critical, stars for lower
  const renderPriorityIndicator = (priority: number) => {
    if (priority <= 0) return null;
    const meta = priorityMeta[Math.min(priority, 5)] || priorityMeta[2];
    if (meta.flame) {
      return (
        <span className={`inline-flex items-center gap-0.5 ${meta.color}`} title={`Priority: ${meta.label}`}>
          <Flame className="w-3.5 h-3.5 fill-current" />
          <span className="text-[10px] font-semibold">{meta.label}</span>
        </span>
      );
    }
    const stars = Math.min(priority, 5);
    return (
      <span className="inline-flex items-center gap-0.5" title={`Priority: ${meta.label}`}>
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} className={`w-3 h-3 ${meta.color} fill-current`} />
        ))}
      </span>
    );
  };

  // Render a topic card (enhanced - visual improvements)
  const renderTopicCard = (t: Topic) => {
    const itemCount = t.topic_items?.[0]?.count || 0;
    const overdue = !!(t.due_date && new Date(t.due_date) < new Date());
    const daysUntilDue = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const health = getTopicHealth(t);
    const contactCount = (t.stakeholders || []).length;
    const isUrgent = overdue || (t.priority >= 4);
    const healthDotColor = health.score >= 80 ? 'bg-green-500' : health.score >= 50 ? 'bg-amber-500' : 'bg-red-500';
    const healthDotRing = health.score >= 80 ? 'ring-green-500/20' : health.score >= 50 ? 'ring-amber-500/20' : 'ring-red-500/20';
    const borderColor = areaBorderColors[t.area] || 'border-l-gray-300';
    const progressNearComplete = t.progress_percent != null && t.progress_percent >= 80;
    const tags = t.tags || [];

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
          className={`block px-3 py-2.5 bg-white rounded-xl border border-gray-100 border-l-[3px] ${borderColor} hover:border-blue-200 hover:shadow-lg transition-all shadow-sm group-hover:bg-gray-50/30 ${isUrgent ? 'hover:shadow-red-100/50 hover:ring-1 hover:ring-red-200/50' : ''}`}>
          {/* Row 1: Priority dot + Title + Due + Tags */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Priority as small colored dot */}
            <span className={`block w-2 h-2 rounded-full flex-shrink-0 ${t.priority >= 5 ? 'bg-red-500' : t.priority >= 4 ? 'bg-orange-500' : t.priority >= 3 ? 'bg-amber-400' : t.priority >= 2 ? 'bg-blue-400' : 'bg-gray-300'}`} title={priorityMeta[t.priority]?.label || 'None'} />
            <h3 className="font-semibold text-gray-900 truncate text-sm flex-1 min-w-0">
              {searchQuery.trim()
                ? <HighlightText text={t.title} query={searchQuery} />
                : t.title}
            </h3>
            {overdue && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold flex-shrink-0">Overdue</span>
            )}
            {t.due_date && !overdue && daysUntilDue !== null && (
              <span className={`text-[10px] flex-shrink-0 ${daysUntilDue <= 3 ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                {daysUntilDue === 0 ? 'Today' : `${daysUntilDue}d left`}
              </span>
            )}
            {/* Tags as tiny pills */}
            {tags.slice(0, 2).map((tag, idx) => (
              <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium hidden lg:inline-block ${tagPillColors[idx % tagPillColors.length]}`}>
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[9px] text-gray-400 flex-shrink-0 hidden lg:inline-block">+{tags.length - 2}</span>
            )}
          </div>
          {/* Row 2: Description (one-line) + meta */}
          <div className="flex items-center gap-2 mt-1 pl-4 text-[11px] text-gray-400">
            {t.description && (
              <span className="truncate text-gray-500 flex-1 min-w-0">
                {searchQuery.trim()
                  ? <HighlightText text={t.description} query={searchQuery} />
                  : t.description}
              </span>
            )}
            {!t.description && <span className="flex-1" />}
            {itemCount > 0 && (
              <span className="flex items-center gap-0.5 flex-shrink-0">
                <Paperclip className="w-3 h-3" /> {itemCount}
              </span>
            )}
            {t.progress_percent != null && t.progress_percent > 0 && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <div className={`w-10 h-1 rounded-full overflow-hidden ${progressNearComplete ? 'bg-green-100' : 'bg-gray-200'}`}>
                  <div className={`h-full rounded-full ${progressNearComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${t.progress_percent}%` }} />
                </div>
                <span className={`text-[10px] ${progressNearComplete ? 'text-green-600' : ''}`}>{t.progress_percent}%</span>
              </span>
            )}
            {t.summary && <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />}
            <span className="flex-shrink-0">{formatRelativeDate(t.updated_at)}</span>
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
    const topicsSource = selectedArea ? areaFilteredTopics : filteredTopics;
    const folderTopics = topicsSource.filter(t => t.folder_id === node.folder.id);
    const isExpanded = expandedFolders.has(node.folder.id);
    // Recursively count all topics in this folder and subfolders
    const countDeep = (n: { folder: FolderType; children: any[] }): number => {
      const direct = topicsSource.filter(t => t.folder_id === n.folder.id).length;
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
          {(() => {
            const folderColorMap: Record<string, string> = { work: 'text-blue-500', personal: 'text-green-500', career: 'text-purple-500' };
            const fColor = node.folder.area ? folderColorMap[node.folder.area] || 'text-amber-500' : 'text-amber-500';
            // Use contextual icon for top-level folders
            if (node.depth === 0) {
              const ContextIcon = getFolderIcon(node.folder.name);
              return <ContextIcon className={`w-4 h-4 ${fColor} flex-shrink-0`} />;
            }
            return isExpanded
              ? <FolderOpen className={`w-4 h-4 ${fColor} flex-shrink-0`} />
              : <Folder className={`w-4 h-4 ${fColor} flex-shrink-0`} />;
          })()}
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
              <span className={`text-[10px] font-semibold min-w-[20px] text-center px-1.5 py-0.5 rounded-full flex-shrink-0 ${totalCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-300'}`}>
                {totalCount}
              </span>
            </span>
          )}
          <div className="flex gap-0.5 items-center opacity-0 group-hover/folder:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg border border-gray-100 shadow-sm p-0.5">
            <button onClick={() => { setNewFolderParent(node.folder.id); setShowCreateFolder(true); }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Add subfolder">
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setEditingFolder(node.folder.id); setEditFolderName(node.folder.name); }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors" title="Rename">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteFolder(node.folder.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete folder">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-gray-200 mx-0.5" />
            <div className="flex gap-0.5 items-center" title="Move to area">
              <ArrowRightLeft className="w-3 h-3 text-gray-400 mr-0.5" />
              {(['work', 'personal', 'career'] as const).map(a => {
                const isActive = node.folder.area === a;
                const colorMap: Record<string, { active: string; inactive: string }> = {
                  work: { active: 'bg-blue-500 text-white', inactive: 'text-blue-600 hover:bg-blue-50 border border-blue-200' },
                  personal: { active: 'bg-green-500 text-white', inactive: 'text-green-600 hover:bg-green-50 border border-green-200' },
                  career: { active: 'bg-purple-500 text-white', inactive: 'text-purple-600 hover:bg-purple-50 border border-purple-200' },
                };
                return (
                  <button
                    key={a}
                    onClick={() => { if (!isActive) changeFolderArea(node.folder.id, a); }}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors ${isActive ? colorMap[a].active : colorMap[a].inactive}`}
                    title={`Move to ${a}`}
                  >
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                );
              })}
            </div>
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

  // The current topics to display (area-filtered or all)
  const displayTopics = selectedArea ? areaFilteredTopics : filteredTopics;
  const displayFolderTree = selectedArea ? areaFolderTree : folderTree;
  const displayUnfoldered = selectedArea ? areaUnfolderedTopics : unfolderedTopics;
  const displayFolders = selectedArea ? areaFilteredFolders : folders;

  return (
    <div>
      {/* AI Reorganization Suggestions - Modal-style Panel (always available) */}
      {showReorg && reorgSuggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowReorg(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-indigo-200 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">AI Reorganization Suggestions</h3>
                  <p className="text-xs text-gray-500">Review and apply these suggestions to improve your folder structure</p>
                </div>
              </div>
              <button onClick={() => setShowReorg(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="prose prose-sm max-w-none text-sm text-gray-700 space-y-1">
                {reorgSuggestions.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-indigo-900 mt-4 mb-1 text-base border-b border-indigo-100 pb-1">{line.replace('## ', '')}</h3>;
                  if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-indigo-800 mt-3 mb-1 text-sm">{line.replace('### ', '')}</h4>;
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    const text = line.slice(2);
                    const isAction = text.toLowerCase().includes('move') || text.toLowerCase().includes('create') || text.toLowerCase().includes('merge') || text.toLowerCase().includes('rename');
                    return (
                      <div key={i} className={`flex items-start gap-2 ml-2 mt-1 p-2 rounded-lg ${isAction ? 'bg-indigo-50 border border-indigo-100' : ''}`}>
                        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAction ? 'bg-indigo-500' : 'bg-gray-400'}`} />
                        <span className="text-sm text-gray-700">{text}</span>
                      </div>
                    );
                  }
                  if (line.trim() === '') return <div key={i} className="h-2" />;
                  return <p key={i} className="text-sm text-gray-700 mt-1">{line}</p>;
                })}
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <p className="text-xs text-gray-400">These are AI suggestions. Review and apply them manually.</p>
              <button onClick={() => setShowReorg(false)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== AREA SELECTION VIEW ======================== */}
      {!selectedArea ? (
        <div>
          {/* Dashboard Stats Cards - compact row */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            <button onClick={() => { setStatsFilter(statsFilter === 'active' ? null : 'active'); setFilterStatus('active'); setFilterArea('all'); }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${statsFilter === 'active' ? 'border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-200' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Active Topics</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <CircleDot className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardStats.active}</p>
            </button>
            <button onClick={() => {
                if (dashboardStats.overdue > 0) {
                  setStatsFilter(statsFilter === 'overdue' ? null : 'overdue');
                  setFilterStatus('active');
                }
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${statsFilter === 'overdue' ? 'border-red-300 bg-red-50 shadow-sm ring-1 ring-red-200' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Overdue</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dashboardStats.overdue > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <AlertTriangle className={`w-3.5 h-3.5 ${dashboardStats.overdue > 0 ? 'text-red-500' : 'text-gray-300'}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold mt-1 ${dashboardStats.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{dashboardStats.overdue}</p>
            </button>
            <button onClick={() => {
                if (dashboardStats.needsAttention > 0) {
                  setStatsFilter(statsFilter === 'needsAttention' ? null : 'needsAttention');
                  setFilterStatus('active');
                }
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${statsFilter === 'needsAttention' ? 'border-amber-300 bg-amber-50 shadow-sm ring-1 ring-amber-200' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Needs Attention</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dashboardStats.needsAttention > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <ShieldAlert className={`w-3.5 h-3.5 ${dashboardStats.needsAttention > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold mt-1 ${dashboardStats.needsAttention > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{dashboardStats.needsAttention}</p>
            </button>
            <button onClick={() => { setStatsFilter(statsFilter === 'recent' ? null : 'recent'); }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${statsFilter === 'recent' ? 'border-green-300 bg-green-50 shadow-sm ring-1 ring-green-200' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Updated This Week</span>
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardStats.updatedThisWeek}</p>
            </button>
            <div className="p-3 rounded-xl border border-gray-100 bg-white text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Avg Items/Topic</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardStats.avgItems}</p>
            </div>
          </div>

          {/* Area Cards - the main navigation */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {(['work', 'personal', 'career'] as const).map(areaKey => {
              const config = areaCardConfig[areaKey];
              const stats = areaStats[areaKey];
              const Icon = config.icon;
              return (
                <button key={areaKey}
                  onClick={() => { setSelectedArea(areaKey); setFilterArea('all'); }}
                  className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} ${config.hoverGradient} p-6 text-left transition-all duration-300 hover:shadow-xl hover:shadow-${areaKey === 'work' ? 'blue' : areaKey === 'personal' ? 'green' : 'purple'}-500/20 hover:scale-[1.02] active:scale-[0.98]`}>
                  {/* Decorative background circle */}
                  <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-110" />
                  <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5" />

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center mb-4 backdrop-blur-sm`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className={`text-xl font-bold ${config.textColor} mb-1`}>
                    {config.label}
                  </h3>

                  {/* Stats */}
                  <div className={`flex items-center gap-3 ${config.subtextColor} text-sm mb-3`}>
                    <span className="font-medium">{stats.total} topic{stats.total !== 1 ? 's' : ''}</span>
                    <span className="w-1 h-1 rounded-full bg-white/40" />
                    <span>{stats.folders} folder{stats.folders !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Detail chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {stats.active > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${config.countBg} ${config.countText} font-medium backdrop-blur-sm`}>
                        {stats.active} active
                      </span>
                    )}
                    {stats.overdue > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/30 text-white font-medium backdrop-blur-sm flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {stats.overdue} overdue
                      </span>
                    )}
                    {stats.recentlyUpdated > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${config.countBg} ${config.countText} font-medium backdrop-blur-sm`}>
                        {stats.recentlyUpdated} updated this week
                      </span>
                    )}
                  </div>

                  {/* Arrow indicator */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0 -translate-x-2">
                    <ChevronRight className="w-6 h-6 text-white/60" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick actions row on area selection page */}
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors">
              {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showCreate ? 'Cancel' : 'New Topic'}
            </button>
            <button onClick={handleSuggestTopics} disabled={!!aiLoading}
              className="px-3 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 flex items-center gap-2 disabled:opacity-50 transition-colors">
              {aiLoading === 'suggest_topics' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              AI Suggest Topics
            </button>
            <button onClick={runReorganize} disabled={reorgLoading || !!aiLoading}
              className="px-3 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 flex items-center gap-2 disabled:opacity-50 transition-colors">
              {reorgLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {reorgLoading ? 'Analyzing...' : 'AI Reorganize'}
            </button>
          </div>

          {/* Create topic form on area page */}
          {showCreate && (
            <div className="mt-4 p-5 bg-white rounded-xl border border-blue-200 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" /> Create New Topic
                </h3>
                <button onClick={() => { setShowCreate(false); setFormErrors({}); }} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Title *</label>
                <input value={title} onChange={e => { setTitle(e.target.value); setFormErrors(prev => ({ ...prev, title: '' })); }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="What is this topic about?"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} autoFocus />
                {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Add a brief description (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Area</label>
                  <select value={area} onChange={e => setArea(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="career">Career</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Priority</label>
                  <div className="flex gap-1">
                    {([1, 2, 3, 4, 5] as const).map(p => {
                      const meta = priorityMeta[p];
                      return (
                        <button key={p} type="button" onClick={() => setCreatePriority(p)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                            createPriority === p
                              ? p >= 4 ? 'bg-red-50 border-red-300 text-red-700 shadow-sm' : 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}>
                          {meta.flame && <Flame className="w-3 h-3 inline mr-0.5" />}
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Due Date</label>
                  <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); setFormErrors(prev => ({ ...prev, dueDate: '' })); }}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.dueDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                  {formErrors.dueDate && <p className="text-xs text-red-500 mt-1">{formErrors.dueDate}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Folder</label>
                  {folders.length > 0 ? (
                    <select value={createFolderId || ''} onChange={e => setCreateFolderId(e.target.value || null)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">No folder</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>{getFolderPath(f.id).join(' / ')}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-gray-400 py-2.5">No folders yet</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button onClick={handleCreate} disabled={createSubmitting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm hover:shadow-md">
                  {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {createSubmitting ? 'Creating...' : 'Create Topic'}
                </button>
              </div>
            </div>
          )}

          {/* AI Suggestions on area page */}
          {aiSuggestions.length > 0 && (
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
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
        </div>
      ) : (
        /* ======================== AREA DETAIL VIEW ======================== */
        <div>
          {/* Breadcrumb + Back button */}
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { setSelectedArea(null); setSearchQuery(''); setFilterArea('all'); setFilterStatus('active'); setStatsFilter(null); setSelectedTopics(new Set()); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors group">
              <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              <span className="text-gray-400">Topics</span>
            </button>
            <ChevronRight className="w-4 h-4 text-gray-300" />
            {(() => {
              const config = areaCardConfig[selectedArea];
              const Icon = config.icon;
              return (
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{config.label}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {areaStats[selectedArea]?.total || 0} topics
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Search + Actions bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input ref={searchInputRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search titles, descriptions, tags... (press / to focus)" className="w-full pl-10 pr-20 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {searchQuery && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded font-medium">
                    {displayTopics.length} result{displayTopics.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => { setShowCreate(!showCreate); if (!showCreate) setArea(selectedArea); }}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors flex-shrink-0">
              {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showCreate ? 'Cancel' : 'New Topic'}
            </button>
            <button onClick={() => { setShowCreateFolder(!showCreateFolder); setNewFolderParent(null); if (!showCreateFolder) setNewFolderArea(selectedArea); }}
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
              const areaTopicsForStale = topics.filter(t => t.area === selectedArea);
              const staleCount = areaTopicsForStale.filter(t => {
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
              className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 flex items-center gap-1.5 disabled:opacity-50 transition-colors">
              {reorgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {reorgLoading ? 'Analyzing...' : 'AI Reorganize'}
            </button>
            <button onClick={handleAiAnalyzeAll} disabled={aiAnalyzeAllLoading || selectedTopics.size === 0}
              className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              title={selectedTopics.size === 0 ? 'Select topics first' : `Analyze ${selectedTopics.size} selected topics`}>
              {aiAnalyzeAllLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {aiAnalyzeAllLoading ? 'Analyzing...' : `AI Analyze${selectedTopics.size > 0 ? ` (${selectedTopics.size})` : ''}`}
            </button>
            <button onClick={() => setViewMode(viewMode === 'folders' ? 'flat' : 'folders')}
              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
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

          {/* Filters */}
          {showFilters && (
            <div className="mb-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3">
              <div className="flex gap-4 flex-wrap items-end">
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
          {(searchQuery.trim() !== '' || filterStatus !== 'active' || statsFilter !== null) && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium">Active filters:</span>
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Search: &ldquo;{searchQuery}&rdquo;
                  <button onClick={() => setSearchQuery('')} className="ml-0.5 hover:text-blue-900"><X className="w-3 h-3" /></button>
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
              <button onClick={() => { setSearchQuery(''); setFilterStatus('active'); setStatsFilter(null); }} className="text-xs text-red-600 hover:text-red-800 hover:underline ml-1">
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
            <div className="mb-4 p-5 bg-white rounded-xl border border-blue-200 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" /> Create New Topic
                </h3>
                <button onClick={() => { setShowCreate(false); setFormErrors({}); }} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Title *</label>
                <input value={title} onChange={e => { setTitle(e.target.value); setFormErrors(prev => ({ ...prev, title: '' })); }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="What is this topic about?"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} autoFocus />
                {formErrors.title && <p className="text-xs text-red-500 mt-1">{formErrors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Add a brief description (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>

              {/* Row: Area + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Area</label>
                  <select value={area} onChange={e => setArea(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="career">Career</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Priority</label>
                  <div className="flex gap-1">
                    {([1, 2, 3, 4, 5] as const).map(p => {
                      const meta = priorityMeta[p];
                      return (
                        <button key={p} type="button" onClick={() => setCreatePriority(p)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                            createPriority === p
                              ? p >= 4
                                ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                                : 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}>
                          {meta.flame && <Flame className="w-3 h-3 inline mr-0.5" />}
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row: Start Date + Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Start Date</label>
                  <input type="date" value={createStartDate} onChange={e => { setCreateStartDate(e.target.value); setFormErrors(prev => ({ ...prev, startDate: '' })); }}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.startDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                  {formErrors.startDate && <p className="text-xs text-red-500 mt-1">{formErrors.startDate}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Due Date</label>
                  <input type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); setFormErrors(prev => ({ ...prev, dueDate: '' })); }}
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.dueDate ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                  {formErrors.dueDate && <p className="text-xs text-red-500 mt-1">{formErrors.dueDate}</p>}
                </div>
              </div>

              {/* Row: Tags + Folder */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">
                    <Hash className="w-3 h-3 inline mr-0.5" /> Tags
                  </label>
                  <input value={createTags} onChange={e => setCreateTags(e.target.value)}
                    placeholder="design, urgent, q1 (comma separated)"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {createTags && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {createTags.split(',').map(t => t.trim()).filter(Boolean).map((tag, idx) => (
                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tagPillColors[idx % tagPillColors.length]}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Folder</label>
                  {displayFolders.length > 0 ? (
                    <select value={createFolderId || ''} onChange={e => setCreateFolderId(e.target.value || null)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">No folder</option>
                      {displayFolders.map(f => (
                        <option key={f.id} value={f.id}>{getFolderPath(f.id).join(' / ')}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-gray-400 py-2.5">No folders yet</p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-1">
                <button onClick={handleCreate} disabled={createSubmitting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm hover:shadow-md">
                  {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {createSubmitting ? 'Creating...' : 'Create Topic'}
                </button>
              </div>
            </div>
          )}

          {/* Bulk actions toolbar - floating action bar */}
          {selectedTopics.size > 0 && (
            <div className="mb-3 p-3 bg-white rounded-xl border border-blue-200 shadow-lg flex items-center gap-3 animate-fade-in sticky top-2 z-30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-blue-700">{selectedTopics.size} selected</span>
              </div>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => bulkChangeStatus('completed')} disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Complete
                </button>
                <button onClick={() => bulkChangeStatus('archived')} disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center gap-1">
                  <Archive className="w-3 h-3" /> Archive
                </button>
                <button onClick={() => bulkChangeStatus('active')} disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center gap-1">
                  <CircleDot className="w-3 h-3" /> Reactivate
                </button>
                {/* Change Area picker */}
                <div className="relative">
                  <button onClick={() => setShowBulkAreaPicker(!showBulkAreaPicker)} disabled={bulkActionLoading}
                    className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Change Area
                  </button>
                  {showBulkAreaPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-20 min-w-[120px]">
                      {(['work', 'personal', 'career'] as const).map(a => (
                        <button key={a} onClick={() => bulkChangeArea(a)}
                          className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 flex items-center gap-2 ${areaColors[a]}`}>
                          <span className={`w-2 h-2 rounded-full ${a === 'work' ? 'bg-blue-500' : a === 'personal' ? 'bg-green-500' : 'bg-purple-500'}`} />
                          {a.charAt(0).toUpperCase() + a.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleAiAnalyzeAll} disabled={aiAnalyzeAllLoading || bulkActionLoading}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors flex items-center gap-1">
                  {aiAnalyzeAllLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  AI Analyze
                </button>
              </div>
              <button onClick={() => { setSelectedTopics(new Set()); setShowBulkAreaPicker(false); }}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          )}

          {/* Results count */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {displayTopics.length} topic{displayTopics.length !== 1 ? 's' : ''}
                {searchQuery.trim() || filterStatus !== 'active' ? ` (filtered)` : ''}
              </span>
              {displayTopics.length > 0 && (
                <button onClick={() => {
                  if (selectedTopics.size === displayTopics.length) setSelectedTopics(new Set());
                  else setSelectedTopics(new Set(displayTopics.map(t => t.id)));
                }} className="text-xs text-blue-600 hover:text-blue-800">
                  {selectedTopics.size === displayTopics.length ? 'Deselect all' : 'Select all'}
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
          {displayTopics.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="mx-auto w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <Inbox className="w-7 h-7 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                {searchQuery.trim() || filterStatus !== 'active' ? 'No matching topics' : `No topics in ${areaCardConfig[selectedArea]?.label || selectedArea}`}
              </h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
                {searchQuery.trim() || filterStatus !== 'active'
                  ? `No topics match your current filters.${searchQuery ? ` Try a different search term.` : ''}`
                  : `Create your first topic in ${areaCardConfig[selectedArea]?.label || selectedArea} to get started.`}
              </p>
              <div className="flex items-center justify-center gap-3">
                {(searchQuery.trim() || filterStatus !== 'active') && (
                  <button onClick={() => { setSearchQuery(''); setFilterStatus('active'); setStatsFilter(null); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                    Clear Filters
                  </button>
                )}
                <button onClick={() => { setShowCreate(true); setSearchQuery(''); setArea(selectedArea); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create Topic
                </button>
                <button onClick={handleSuggestTopics} disabled={!!aiLoading}
                  className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center gap-2 disabled:opacity-50">
                  <Brain className="w-4 h-4" /> Import from Sources
                </button>
              </div>
            </div>
          ) : viewMode === 'folders' && displayFolders.length > 0 ? (
            <div>
              {/* Folder cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {displayFolderTree.map(node => {
                  const topicsSource = selectedArea ? areaFilteredTopics : filteredTopics;
                  const countDeepFn = (n: { folder: FolderType; children: any[] }): number => {
                    const direct = topicsSource.filter(t => t.folder_id === n.folder.id).length;
                    return direct + n.children.reduce((sum: number, c: any) => sum + countDeepFn(c), 0);
                  };
                  const totalCount = countDeepFn(node);
                  const folderTopics = topicsSource.filter(t => t.folder_id === node.folder.id);
                  const latestTopic = folderTopics.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
                  const firstDesc = folderTopics.find(t => t.description)?.description;
                  const ContextIcon = getFolderIcon(node.folder.name);
                  const areaBorderMap: Record<string, string> = { work: 'border-l-blue-500', personal: 'border-l-green-500', career: 'border-l-purple-500' };
                  const areaIconBg: Record<string, string> = { work: 'bg-blue-100 text-blue-600', personal: 'bg-green-100 text-green-600', career: 'bg-purple-100 text-purple-600' };
                  const folderArea = node.folder.area || selectedArea || 'work';
                  const isExpanded = expandedFolders.has(node.folder.id);

                  return (
                    <div
                      key={node.folder.id}
                      className={`group/fcard relative bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer border-l-4 ${areaBorderMap[folderArea] || 'border-l-gray-300'} overflow-hidden`}
                      onClick={() => toggleFolder(node.folder.id)}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl ${areaIconBg[folderArea] || 'bg-gray-100 text-gray-600'} flex items-center justify-center flex-shrink-0`}>
                            <ContextIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm text-gray-900 truncate">{node.folder.name}</h3>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${totalCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                {totalCount} topic{totalCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {firstDesc && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{firstDesc}</p>
                            )}
                            {latestTopic && (
                              <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Updated {formatRelativeDate(latestTopic.updated_at)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-50/80 to-transparent opacity-0 group-hover/fcard:opacity-100 transition-opacity flex items-end justify-center pb-3 pointer-events-none">
                        <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                          {isExpanded ? 'Collapse' : 'Open'} <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Expanded folder contents */}
              {displayFolderTree.map(node => renderFolderNode(node))}

              {/* Unfiled topics */}
              {displayUnfoldered.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Unfiled</span>
                    <span className="text-xs text-gray-300">({displayUnfoldered.length})</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {displayUnfoldered.map(t => renderTopicCard(t))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {displayTopics.map(t => renderTopicCard(t))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
