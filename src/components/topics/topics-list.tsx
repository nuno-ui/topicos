'use client';
import { useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeDate, sourceIcon } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Filter, X, Search, Sparkles, ArrowUpDown, FolderPlus, Folder, FolderOpen, ChevronRight, ChevronDown, MoreHorizontal, Edit3, Trash2, MoveRight, Tag, Wand2, Loader2, Brain, Clock, Users, Paperclip } from 'lucide-react';
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
}

interface FolderType {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  position: number;
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

  // AI state
  const [aiLoading, setAiLoading] = useState<string | null>(null);

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
      body: JSON.stringify({ name: newFolderName.trim(), parent_id: newFolderParent }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    setFolders([...folders, data.folder]);
    setExpandedFolders(prev => new Set([...prev, data.folder.id]));
    setNewFolderName(''); setShowCreateFolder(false); setNewFolderParent(null);
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
  }, [topics, searchQuery, filterArea, filterStatus, sortBy]);

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

  // Render a topic card (enhanced)
  const renderTopicCard = (t: Topic) => {
    const itemCount = t.topic_items?.[0]?.count || 0;
    const overdue = t.due_date && new Date(t.due_date) < new Date();
    const daysUntilDue = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    return (
      <div key={t.id} className="group relative">
        <Link href={`/topics/${t.id}`}
          className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status] || 'bg-gray-100 text-gray-600'}`}>
                  {t.status}
                </span>
              </div>
              {t.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-2">{t.description}</p>
              )}
              {/* Tags row */}
              <div className="flex gap-1.5 flex-wrap mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${areaColors[t.area] || 'bg-gray-100 text-gray-600'}`}>
                  {t.area}
                </span>
                {(t.tags || []).slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {tag}
                  </span>
                ))}
                {(t.tags || []).length > 3 && (
                  <span className="text-xs text-gray-400">+{t.tags.length - 3}</span>
                )}
              </div>
              {/* Stats row */}
              <div className="flex gap-3 items-center text-xs text-gray-400">
                {t.due_date && (
                  <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : daysUntilDue !== null && daysUntilDue <= 3 ? 'text-amber-500' : ''}`}>
                    <Clock className="w-3 h-3" />
                    {overdue ? `Overdue ${Math.abs(daysUntilDue!)}d` : daysUntilDue === 0 ? 'Due today' : `${daysUntilDue}d left`}
                  </span>
                )}
                {itemCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> {itemCount}
                  </span>
                )}
                {(t.stakeholders || []).length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {t.stakeholders!.length}
                  </span>
                )}
                {t.summary && (
                  <span className="flex items-center gap-1 text-purple-500">
                    <Sparkles className="w-3 h-3" /> Analyzed
                  </span>
                )}
                {t.progress_percent != null && (
                  <span className="flex items-center gap-1">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${t.progress_percent}%` }} />
                    </div>
                    {t.progress_percent}%
                  </span>
                )}
                <span className="ml-auto">{formatRelativeDate(t.updated_at)}</span>
              </div>
            </div>
            {/* Priority indicator */}
            {t.priority > 0 && (
              <div className={`w-2 h-8 rounded-full flex-shrink-0 ${
                t.priority >= 4 ? 'bg-red-400' : t.priority >= 3 ? 'bg-amber-400' : t.priority >= 2 ? 'bg-blue-400' : 'bg-gray-300'
              }`} title={`Priority ${t.priority}`} />
            )}
          </div>
        </Link>
        {/* Move to folder button */}
        {movingTopic === t.id ? (
          <div className="absolute top-2 right-2 z-10 bg-white border rounded-lg shadow-lg p-2 text-xs space-y-1 min-w-[160px]">
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
        ) : (
          <button onClick={(e) => { e.preventDefault(); setMovingTopic(t.id); }}
            className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Move to folder">
            <MoveRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  // Render folder tree node
  const renderFolderNode = (node: { folder: FolderType; children: any[]; depth: number }) => {
    const folderTopics = filteredTopics.filter(t => t.folder_id === node.folder.id);
    const isExpanded = expandedFolders.has(node.folder.id);
    const totalCount = folderTopics.length + node.children.reduce((sum: number, c: any) => sum + filteredTopics.filter(t => t.folder_id === c.folder.id).length, 0);

    return (
      <div key={node.folder.id} className="mb-1">
        <div className={`flex items-center gap-1 py-1.5 px-2 rounded-lg hover:bg-gray-100 group/folder ${node.depth > 0 ? '' : ''}`}
          style={{ marginLeft: `${node.depth * 16}px` }}>
          <button onClick={() => toggleFolder(node.folder.id)} className="p-0.5 text-gray-400 hover:text-gray-600">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500" />
          )}
          {editingFolder === node.folder.id ? (
            <div className="flex items-center gap-1 flex-1">
              <input value={editFolderName} onChange={e => setEditFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') renameFolder(node.folder.id); if (e.key === 'Escape') setEditingFolder(null); }}
                className="text-sm px-1 py-0.5 border rounded flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
              <button onClick={() => renameFolder(node.folder.id)} className="text-blue-600 text-xs">Save</button>
            </div>
          ) : (
            <span className="text-sm font-medium text-gray-700 flex-1 cursor-pointer" onClick={() => toggleFolder(node.folder.id)}>
              {node.folder.name}
              {totalCount > 0 && <span className="text-gray-400 ml-1 text-xs">({totalCount})</span>}
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
        {isExpanded && (
          <div className="ml-4">
            {node.children.map((child: any) => renderFolderNode(child))}
            <div className="space-y-2 mt-1 mb-2" style={{ marginLeft: `${node.depth * 16 + 8}px` }}>
              {folderTopics.map(t => renderTopicCard(t))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const unfolderedTopics = filteredTopics.filter(t => !t.folder_id);

  return (
    <div>
      {/* Search + Actions bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search topics..." className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 space-y-3">
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

      {/* Create folder form */}
      {showCreateFolder && (
        <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200 flex gap-2 items-center">
          <Folder className="w-4 h-4 text-amber-600" />
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowCreateFolder(false); }}
            placeholder="Folder name" className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" autoFocus />
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
        <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm space-y-3">
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

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{filteredTopics.length} topic{filteredTopics.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Topic list */}
      {filteredTopics.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">{searchQuery ? `No topics match "${searchQuery}"` : 'No topics found'}</p>
          <button onClick={() => { setShowCreate(true); setSearchQuery(''); }}
            className="mt-3 text-blue-600 hover:underline text-sm">Create your first topic &rarr;</button>
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
              <div className="grid gap-2">
                {unfolderedTopics.map(t => renderTopicCard(t))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredTopics.map(t => renderTopicCard(t))}
        </div>
      )}
    </div>
  );
}
