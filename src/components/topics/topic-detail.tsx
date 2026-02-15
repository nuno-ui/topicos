'use client';
import { useState, useCallback } from 'react';
import { sourceIcon, sourceLabel, formatRelativeDate } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Link2, Unlink, ExternalLink, ChevronDown, ChevronUp, Edit3, Archive, Trash2, Save, X, Bot, RefreshCw, StickyNote, Loader2 } from 'lucide-react';

interface TopicItem {
  id: string;
  topic_id: string;
  source: string;
  external_id: string;
  source_account_id: string | null;
  title: string;
  snippet: string;
  url: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  linked_by?: string;
  confidence?: number;
  link_reason?: string;
}

interface SearchResult {
  external_id: string;
  source: string;
  source_account_id: string;
  title: string;
  snippet: string;
  url: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  already_linked?: boolean;
  ai_confidence?: number;
  ai_reason?: string;
}

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  area: string;
  due_date: string | null;
  priority: number;
  tags: string[];
  summary: string | null;
  next_steps: Array<{ action: string; priority: string; rationale: string }> | null;
  urgency_score: number | null;
  notes: string | null;
  owner: string | null;
  stakeholders: string[];
}

const SOURCES = ['gmail', 'calendar', 'drive', 'slack'] as const;

export function TopicDetail({ topic: initialTopic, initialItems }: { topic: Topic; initialItems: TopicItem[] }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [items, setItems] = useState(initialItems);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchSources, setSearchSources] = useState<Set<string>>(new Set(SOURCES));

  // AI Find state
  const [aiFindLoading, setAiFindLoading] = useState(false);
  const [aiFindResults, setAiFindResults] = useState<SearchResult[]>([]);
  const [selectedAiResults, setSelectedAiResults] = useState<Set<string>>(new Set());
  const [showAiResults, setShowAiResults] = useState(false);

  // AI Analysis state
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(topic.summary || null);
  const [showAnalysis, setShowAnalysis] = useState(!!topic.summary);

  // Linked items filter
  const [activeTab, setActiveTab] = useState<string>('all');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(topic.title);
  const [editDescription, setEditDescription] = useState(topic.description || '');
  const [editArea, setEditArea] = useState(topic.area);
  const [editStatus, setEditStatus] = useState(topic.status);
  const [editDueDate, setEditDueDate] = useState(topic.due_date || '');

  // Notes state
  const [notes, setNotes] = useState(topic.notes || '');
  const [notesSaving, setNotesSaving] = useState(false);

  // Linking state
  const [linkingItems, setLinkingItems] = useState(false);

  // --- SEARCH ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          sources: Array.from(searchSources),
          topic_id: topic.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const allItems: SearchResult[] = [];
      for (const src of data.results ?? []) {
        allItems.push(...(src.items ?? []));
      }
      // Mark already linked
      const linkedIds = new Set(items.map(i => i.source + ':' + i.external_id));
      allItems.forEach(item => {
        item.already_linked = linkedIds.has(item.source + ':' + item.external_id);
      });
      setSearchResults(allItems);
      setSelectedResults(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    }
    setSearchLoading(false);
  };

  // --- AI FIND ---
  const handleAiFind = async () => {
    setAiFindLoading(true);
    setAiFindResults([]);
    setShowAiResults(true);
    try {
      const res = await fetch('/api/ai/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topic.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Mark already linked
      const linkedIds = new Set(items.map(i => i.source + ':' + i.external_id));
      const results = (data.results ?? []).map((r: SearchResult) => ({
        ...r,
        already_linked: linkedIds.has(r.source + ':' + r.external_id),
      }));
      setAiFindResults(results);
      setSelectedAiResults(new Set());
      toast.success(`AI Find found ${results.length} relevant items`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI Find failed');
    }
    setAiFindLoading(false);
  };

  // --- LINK ITEMS ---
  const linkItems = useCallback(async (resultsToLink: SearchResult[], linkedBy: string = 'user') => {
    setLinkingItems(true);
    let linked = 0;
    for (const result of resultsToLink) {
      try {
        const res = await fetch(`/api/topics/${topic.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_id: result.external_id,
            source: result.source,
            source_account_id: result.source_account_id,
            title: result.title,
            snippet: result.snippet,
            url: result.url,
            occurred_at: result.occurred_at,
            metadata: result.metadata,
            linked_by: linkedBy,
            confidence: result.ai_confidence,
            link_reason: result.ai_reason,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setItems(prev => [data.item, ...prev]);
          linked++;
        }
      } catch (err) {
        console.error('Link failed:', err);
      }
    }
    // Mark linked in search results
    setSearchResults(prev => prev.map(r =>
      resultsToLink.some(l => l.source === r.source && l.external_id === r.external_id)
        ? { ...r, already_linked: true } : r
    ));
    setAiFindResults(prev => prev.map(r =>
      resultsToLink.some(l => l.source === r.source && l.external_id === r.external_id)
        ? { ...r, already_linked: true } : r
    ));
    setSelectedResults(new Set());
    setSelectedAiResults(new Set());
    setLinkingItems(false);
    toast.success(`Linked ${linked} item${linked !== 1 ? 's' : ''} to topic`);
  }, [topic.id, items]);

  const linkSelectedSearch = () => {
    const toLink = searchResults.filter(r =>
      selectedResults.has(r.source + ':' + r.external_id) && !r.already_linked
    );
    if (toLink.length === 0) { toast.error('No new items selected'); return; }
    linkItems(toLink, 'user');
  };

  const linkSelectedAi = () => {
    const toLink = aiFindResults.filter(r =>
      selectedAiResults.has(r.source + ':' + r.external_id) && !r.already_linked
    );
    if (toLink.length === 0) { toast.error('No new items selected'); return; }
    linkItems(toLink, 'ai');
  };

  // --- UNLINK ---
  const unlinkItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/topics/${topic.id}/items/${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unlink');
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item unlinked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlink failed');
    }
  };

  // --- EDIT TOPIC ---
  const saveTopic = async () => {
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          area: editArea,
          status: editStatus,
          due_date: editDueDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopic(data.topic);
      setEditing(false);
      toast.success('Topic updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  // --- DELETE TOPIC ---
  const deleteTopic = async () => {
    if (!confirm('Delete this topic and all linked items? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/topics/${topic.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Topic deleted');
      router.push('/topics');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // --- ARCHIVE TOPIC ---
  const archiveTopic = async () => {
    try {
      const newStatus = topic.status === 'archived' ? 'active' : 'archived';
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopic(data.topic);
      toast.success(newStatus === 'archived' ? 'Topic archived' : 'Topic reactivated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  // --- SAVE NOTES ---
  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || null }),
      });
      if (!res.ok) throw new Error('Failed to save notes');
      toast.success('Notes saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
    setNotesSaving(false);
  };

  // --- AI ANALYSIS ---
  const runAnalysis = async () => {
    if (items.length === 0) {
      toast.error('Link some items first to run AI analysis');
      return;
    }
    setAnalysisLoading(true);
    setShowAnalysis(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topic.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalysis(data.analysis);
      toast.success('AI analysis complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    }
    setAnalysisLoading(false);
  };

  // Filtered items by tab
  const filteredItems = activeTab === 'all' ? items : items.filter(i => i.source === activeTab);
  const sourceCounts = items.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const toggleSource = (source: string) => {
    setSearchSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const toggleSearchResult = (key: string) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAiResult = (key: string) => {
    setSelectedAiResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/topics" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
            &larr; Back to Topics
          </Link>
          {editing ? (
            <div className="space-y-3 mt-2">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="text-2xl font-bold text-gray-900 w-full px-3 py-2 border rounded-lg" />
              <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
                placeholder="Description..." className="w-full px-3 py-2 border rounded-lg text-gray-600" rows={2} />
              <div className="flex gap-3">
                <select value={editArea} onChange={e => setEditArea(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm">
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="career">Career</option>
                </select>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm">
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
                <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveTopic} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mt-2">{topic.title}</h1>
              {topic.description && <p className="text-gray-500 mt-1">{topic.description}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  topic.area === 'work' ? 'bg-blue-100 text-blue-700' :
                  topic.area === 'personal' ? 'bg-green-100 text-green-700' :
                  'bg-purple-100 text-purple-700'
                }`}>{topic.area}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  topic.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  topic.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                  'bg-amber-100 text-amber-700'
                }`}>{topic.status}</span>
                {topic.due_date && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    Due: {new Date(topic.due_date).toLocaleDateString()}
                  </span>
                )}
                {/* Source counts */}
                {Object.entries(sourceCounts).map(([src, count]) => (
                  <span key={src} className="text-xs px-2 py-1 rounded-full bg-gray-50 text-gray-500">
                    {sourceIcon(src)} {count}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(true); setEditTitle(topic.title); setEditDescription(topic.description || ''); setEditArea(topic.area); setEditStatus(topic.status); setEditDueDate(topic.due_date || ''); }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Edit">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={archiveTopic}
              className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title={topic.status === 'archived' ? 'Reactivate' : 'Archive'}>
              <Archive className="w-4 h-4" />
            </button>
            <button onClick={deleteTopic}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search Panel */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button onClick={() => setShowSearch(!showSearch)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Search className="w-4 h-4" />
            Search sources for this topic
          </div>
          {showSearch ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showSearch && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
            <div className="flex gap-2 mt-3">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search emails, messages, events, files..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleSearch} disabled={searchLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
              <button onClick={handleAiFind} disabled={aiFindLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                {aiFindLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI Find
              </button>
            </div>
            {/* Source filters */}
            <div className="flex gap-2 text-xs">
              <span className="text-gray-500 py-1">Sources:</span>
              {SOURCES.map(src => (
                <button key={src} onClick={() => toggleSource(src)}
                  className={`px-2 py-1 rounded-full transition-colors ${
                    searchSources.has(src)
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                  {sourceIcon(src)} {sourceLabel(src)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg border border-blue-200">
          <div className="px-4 py-3 border-b border-blue-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              Search Results ({searchResults.length})
            </h3>
            {selectedResults.size > 0 && (
              <button onClick={linkSelectedSearch} disabled={linkingItems}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {linkingItems ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                Link {selectedResults.size} Selected
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {searchResults.map((item) => {
              const key = item.source + ':' + item.external_id;
              return (
                <div key={key} className={`px-4 py-3 flex items-start gap-3 ${item.already_linked ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}>
                  {!item.already_linked && (
                    <input type="checkbox" checked={selectedResults.has(key)}
                      onChange={() => toggleSearchResult(key)}
                      className="mt-1 rounded border-gray-300" />
                  )}
                  {item.already_linked && (
                    <span className="mt-1 text-green-500 text-xs font-medium">Linked</span>
                  )}
                  <span className="mt-0.5">{sourceIcon(item.source)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate">{item.snippet}</p>
                    <div className="flex gap-2 mt-1 text-xs text-gray-400">
                      <span>{sourceLabel(item.source)}</span>
                      <span>{formatRelativeDate(item.occurred_at)}</span>
                    </div>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-blue-600" title="Open in source">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Find Results */}
      {showAiResults && (
        <div className="bg-white rounded-lg border border-purple-200">
          <div className="px-4 py-3 border-b border-purple-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI Find Results
              {aiFindLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
            </h3>
            {selectedAiResults.size > 0 && (
              <button onClick={linkSelectedAi} disabled={linkingItems}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
                {linkingItems ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                Link {selectedAiResults.size} Selected
              </button>
            )}
          </div>
          {aiFindResults.length === 0 && !aiFindLoading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No results found. Try adding a more detailed description to your topic.</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {aiFindResults.map((item) => {
                const key = item.source + ':' + item.external_id;
                return (
                  <div key={key} className={`px-4 py-3 flex items-start gap-3 ${item.already_linked ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}>
                    {!item.already_linked && (
                      <input type="checkbox" checked={selectedAiResults.has(key)}
                        onChange={() => toggleAiResult(key)}
                        className="mt-1 rounded border-gray-300" />
                    )}
                    {item.already_linked && (
                      <span className="mt-1 text-green-500 text-xs font-medium">Linked</span>
                    )}
                    <span className="mt-0.5">{sourceIcon(item.source)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 truncate">{item.snippet}</p>
                      <div className="flex gap-2 mt-1 text-xs text-gray-400">
                        <span>{sourceLabel(item.source)}</span>
                        <span>{formatRelativeDate(item.occurred_at)}</span>
                        {item.ai_confidence != null && (
                          <span className="text-purple-500">
                            {Math.round(item.ai_confidence * 100)}% match
                          </span>
                        )}
                      </div>
                      {item.ai_reason && (
                        <p className="text-xs text-purple-600 mt-1 italic">{item.ai_reason}</p>
                      )}
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="p-1 text-gray-400 hover:text-blue-600" title="Open in source">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Linked Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Linked Items ({items.length})</h2>
        </div>
        {/* Source tabs */}
        <div className="flex gap-1 mb-4 flex-wrap">
          <button onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            All ({items.length})
          </button>
          {Object.entries(sourceCounts).map(([src, count]) => (
            <button key={src} onClick={() => setActiveTab(src)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === src ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {sourceIcon(src)} {sourceLabel(src)} ({count})
            </button>
          ))}
        </div>
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No items linked yet</p>
            <p className="text-gray-400 text-xs mt-1">Use the search panel above to find and link items from your sources</p>
            <button onClick={() => setShowSearch(true)}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2">
              <Search className="w-4 h-4" /> Open Search
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group">
                <span className="mt-0.5 text-base">{sourceIcon(item.source)}</span>
                <div className="flex-1 min-w-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:text-blue-600 text-sm truncate block">
                    {item.title}
                  </a>
                  {item.snippet && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.snippet}</p>
                  )}
                  <div className="flex gap-2 mt-1 text-xs text-gray-400">
                    <span>{sourceLabel(item.source)}</span>
                    <span>{formatRelativeDate(item.occurred_at)}</span>
                    {item.linked_by === 'ai' && (
                      <span className="text-purple-500 flex items-center gap-0.5">
                        <Sparkles className="w-3 h-3" /> AI linked
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Open in source">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => unlinkItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Unlink from topic">
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-500" />
            Topic Intelligence
          </h2>
          <button onClick={runAnalysis} disabled={analysisLoading}
            className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5">
            {analysisLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {analysis ? 'Refresh' : 'Run'} Analysis
          </button>
        </div>
        <div className="px-4 py-4">
          {analysisLoading ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              <span className="text-sm text-gray-500">Analyzing linked items...</span>
            </div>
          ) : analysis ? (
            <div className="prose prose-sm max-w-none text-gray-700">
              {analysis.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('#') ? 'font-semibold text-gray-900 mt-3' : 'mt-1'}>
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              {items.length > 0
                ? 'Click "Run Analysis" to get AI-powered insights about this topic'
                : 'Link some items first, then run AI analysis for insights'}
            </p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            Notes
          </h2>
          <button onClick={saveNotes} disabled={notesSaving}
            className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1.5">
            {notesSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
        <div className="p-4">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes about this topic..."
            className="w-full min-h-[100px] px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      </div>
    </div>
  );
}
