'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { sourceIcon, sourceLabel, formatRelativeDate } from '@/lib/utils';
import { Search, Link2, Plus, ExternalLink, Loader2, ChevronDown } from 'lucide-react';

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
}

interface Topic {
  id: string;
  title: string;
  area: string;
}

const SOURCES = ['gmail', 'calendar', 'drive', 'slack'] as const;

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Set<string>>(new Set(SOURCES));
  const [topics, setTopics] = useState<Topic[]>([]);

  // Link to topic state
  const [linkingResult, setLinkingResult] = useState<string | null>(null);
  const [showTopicDropdown, setShowTopicDropdown] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);

  // Load topics on mount
  useEffect(() => {
    fetch('/api/topics').then(r => r.json()).then(data => {
      setTopics(data.topics || []);
    }).catch(() => {});
  }, []);

  const toggleSource = (source: string) => {
    setSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sources: Array.from(sources) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const allItems: SearchResult[] = [];
      for (const src of data.results ?? []) {
        if (src.error) {
          toast.error(`${src.source}: ${src.error}`);
        }
        allItems.push(...(src.items ?? []));
      }
      setResults(allItems);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    }
    setLoading(false);
  };

  const linkToTopic = async (result: SearchResult, topicId: string) => {
    const key = result.source + ':' + result.external_id;
    setLinkingResult(key);
    try {
      const res = await fetch(`/api/topics/${topicId}/items`, {
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
          linked_by: 'user',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Link failed');
      }
      const topic = topics.find(t => t.id === topicId);
      toast.success(`Linked to "${topic?.title || 'topic'}"`);
      setShowTopicDropdown(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Link failed');
    }
    setLinkingResult(null);
  };

  const createTopicAndLink = async (result: SearchResult) => {
    if (!newTopicTitle.trim()) {
      setNewTopicTitle(result.title);
      return;
    }
    setCreatingTopic(true);
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTopicTitle.trim(), area: 'work' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopics(prev => [data.topic, ...prev]);
      toast.success(`Created topic "${data.topic.title}"`);
      // Now link the item to the new topic
      await linkToTopic(result, data.topic.id);
      setNewTopicTitle('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    }
    setCreatingTopic(false);
  };

  return (
    <div>
      {/* Search Input */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search across all connected sources..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
        {/* Source filters */}
        <div className="flex gap-2 text-xs">
          <span className="text-gray-500 py-1.5">Sources:</span>
          {SOURCES.map(src => (
            <button key={src} onClick={() => toggleSource(src)}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                sources.has(src)
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100 text-gray-400'
              }`}>
              {sourceIcon(src)} {sourceLabel(src)}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{results.length} results found</h2>
        </div>
      )}

      <div className="space-y-2">
        {results.map((item) => {
          const key = item.source + ':' + item.external_id;
          return (
            <div key={key} className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-base">{sourceIcon(item.source)}</span>
                <div className="flex-1 min-w-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:text-blue-600 text-sm">
                    {item.title}
                  </a>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.snippet}</p>
                  <div className="flex gap-2 mt-1.5 text-xs text-gray-400">
                    <span>{sourceLabel(item.source)}</span>
                    <span>{formatRelativeDate(item.occurred_at)}</span>
                    {item.metadata?.from ? (
                      <span>from: {String(item.metadata.from).split('<')[0].trim()}</span>
                    ) : null}
                    {item.metadata?.channel_name ? (
                      <span>#{String(item.metadata.channel_name)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-1.5 items-center">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Open in source">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {/* Link to Topic dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowTopicDropdown(showTopicDropdown === key ? null : key)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-1"
                      title="Link to topic"
                    >
                      <Link2 className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showTopicDropdown === key && (
                      <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
                          Link to Topic
                        </div>
                        {topics.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-400">No topics yet. Create one below.</p>
                        )}
                        {topics.map(topic => (
                          <button
                            key={topic.id}
                            onClick={() => linkToTopic(item, topic.id)}
                            disabled={linkingResult === key}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between disabled:opacity-50"
                          >
                            <span className="truncate">{topic.title}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              topic.area === 'work' ? 'bg-blue-50 text-blue-600' :
                              topic.area === 'personal' ? 'bg-green-50 text-green-600' :
                              'bg-purple-50 text-purple-600'
                            }`}>{topic.area}</span>
                          </button>
                        ))}
                        <div className="border-t border-gray-100 px-3 py-2">
                          <div className="flex gap-1.5">
                            <input
                              value={newTopicTitle}
                              onChange={e => setNewTopicTitle(e.target.value)}
                              placeholder={item.title}
                              className="flex-1 px-2 py-1.5 text-xs border rounded-md"
                              onKeyDown={e => e.key === 'Enter' && createTopicAndLink(item)}
                            />
                            <button
                              onClick={() => createTopicAndLink(item)}
                              disabled={creatingTopic}
                              className="px-2 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              {creatingTopic ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                              New
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty states */}
      {!loading && results.length === 0 && query && (
        <div className="text-center py-12">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No results found for &ldquo;{query}&rdquo;</p>
          <p className="text-gray-400 text-xs mt-1">Try different keywords or check your source connections in Settings</p>
        </div>
      )}
    </div>
  );
}
