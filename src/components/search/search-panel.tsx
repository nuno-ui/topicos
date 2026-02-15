'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { sourceIcon, sourceLabel, formatRelativeDate } from '@/lib/utils';
import { Search, Link2, Plus, ExternalLink, Loader2, ChevronDown, Clock, ArrowUpDown, Calendar, X, Sparkles, Brain, Tags, Wand2 } from 'lucide-react';

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

interface EnhancedQuery {
  query: string;
  sources: string[];
  reason: string;
}

interface CategorizedResult {
  result_index: number;
  suggested_topic_id: string | null;
  suggested_topic_name: string;
  confidence: number;
}

const SOURCES = ['gmail', 'calendar', 'drive', 'slack', 'notion'] as const;

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'source', label: 'By source' },
] as const;

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Set<string>>(new Set(SOURCES));
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sortBy, setSortBy] = useState<string>('relevance');

  // Date filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilters, setShowDateFilters] = useState(false);

  // Recent searches
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Link to topic state
  const [linkingResult, setLinkingResult] = useState<string | null>(null);
  const [showTopicDropdown, setShowTopicDropdown] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);

  // AI Agent state
  const [agentLoading, setAgentLoading] = useState<string | null>(null);
  const [enhancedQueries, setEnhancedQueries] = useState<EnhancedQuery[]>([]);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [categorized, setCategorized] = useState<CategorizedResult[]>([]);
  const [showCategorized, setShowCategorized] = useState(false);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    fetch('/api/topics').then(r => r.json()).then(data => {
      setTopics(data.topics || []);
    }).catch(() => {});

    try {
      const saved = localStorage.getItem('topicos_recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
  }, []);

  const saveRecentSearch = useCallback((q: string) => {
    setRecentSearches(prev => {
      const next = [q, ...prev.filter(s => s !== q)].slice(0, 8);
      try { localStorage.setItem('topicos_recent_searches', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toggleSource = (source: string) => {
    setSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const sortResults = useCallback((items: SearchResult[]) => {
    const sorted = [...items];
    switch (sortBy) {
      case 'date_desc':
        return sorted.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
      case 'date_asc':
        return sorted.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
      case 'source':
        return sorted.sort((a, b) => a.source.localeCompare(b.source));
      default:
        return sorted;
    }
  }, [sortBy]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    saveRecentSearch(query.trim());
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          sources: Array.from(sources),
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
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
      setCategorized([]);
      setShowCategorized(false);
      setSearchSummary(null);
      if (allItems.length === 0) {
        toast.info('No results found. Try different keywords or date range.');
      }
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
      setResults(prev => prev.map(r =>
        r.source === result.source && r.external_id === result.external_id
          ? { ...r, already_linked: true } : r
      ));
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
      await linkToTopic(result, data.topic.id);
      setNewTopicTitle('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    }
    setCreatingTopic(false);
  };

  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
    setShowDateFilters(false);
  };

  // ========== AI AGENT FUNCTIONS ==========

  const runSmartSearch = async () => {
    if (!query.trim()) { toast.error('Enter a search query first'); return; }
    setAgentLoading('smart_search');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'smart_search', context: { query } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnhancedQueries(data.result.enhanced_queries || []);
      setShowEnhanced(true);
      toast.success(`Generated ${data.result.enhanced_queries?.length || 0} optimized queries`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Smart search failed');
    }
    setAgentLoading(null);
  };

  const runCategorize = async () => {
    if (results.length === 0) { toast.error('Search for items first'); return; }
    setAgentLoading('categorize');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'categorize_results',
          context: { results: results.slice(0, 20).map(r => ({ title: r.title, source: r.source, snippet: r.snippet })) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCategorized(data.result.categorized || []);
      setShowCategorized(true);
      toast.success('Results categorized into topics');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Categorize failed');
    }
    setAgentLoading(null);
  };

  const runSummarize = async () => {
    if (results.length === 0) { toast.error('Search for items first'); return; }
    setAgentLoading('summarize');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'summarize_results',
          context: { query, results: results.slice(0, 20).map(r => ({ title: r.title, source: r.source, snippet: r.snippet, occurred_at: r.occurred_at })) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchSummary(data.result.summary || 'No summary generated');
      setShowSummary(true);
      toast.success('Results summarized');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Summarize failed');
    }
    setAgentLoading(null);
  };

  const applyEnhancedQuery = (eq: EnhancedQuery) => {
    setQuery(eq.query);
    const newSources = new Set(eq.sources.filter(s => SOURCES.includes(s as typeof SOURCES[number])));
    if (newSources.size > 0) setSources(newSources);
    setShowEnhanced(false);
    toast.info('Query applied - click Search to run it');
  };

  const sortedResults = sortResults(results);

  // Get category for a result by index
  const getCategoryForResult = (index: number) => {
    if (!showCategorized || categorized.length === 0) return null;
    return categorized.find(c => c.result_index === index);
  };

  return (
    <div>
      {/* Search Input */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search across all connected sources..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
            />
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Source filters + date + sort */}
        <div className="flex gap-2 text-xs items-center flex-wrap">
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
          <span className="text-gray-300 mx-1">|</span>
          <button onClick={() => setShowDateFilters(!showDateFilters)}
            className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
              showDateFilters || dateFrom || dateTo
                ? 'bg-amber-100 text-amber-700 font-medium'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            <Calendar className="w-3 h-3" />
            {dateFrom || dateTo ? 'Date filtered' : 'Date range'}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3 text-gray-400" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="text-xs border-0 bg-transparent text-gray-500 focus:ring-0 cursor-pointer py-1">
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date range filter */}
        {showDateFilters && (
          <div className="flex gap-3 items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
            <Calendar className="w-4 h-4 text-amber-600" />
            <div className="flex gap-2 items-center text-sm">
              <label className="text-gray-600">From:</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1 border rounded text-xs" />
              <label className="text-gray-600">To:</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1 border rounded text-xs" />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={clearDateFilters} className="text-xs text-amber-600 hover:text-amber-800">Clear</button>
            )}
          </div>
        )}

        {/* Recent searches */}
        {!query && !loading && results.length === 0 && recentSearches.length > 0 && (
          <div className="flex gap-2 items-center flex-wrap">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">Recent:</span>
            {recentSearches.map((s, i) => (
              <button key={i} onClick={() => { setQuery(s); }}
                className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Assistants Panel */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Search Assistants
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={runSmartSearch} disabled={!!agentLoading}
            className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5">
            {agentLoading === 'smart_search' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Smart Search
          </button>
          <button onClick={runCategorize} disabled={!!agentLoading || results.length === 0}
            className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5">
            {agentLoading === 'categorize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tags className="w-3.5 h-3.5" />}
            Auto-Categorize
          </button>
          <button onClick={runSummarize} disabled={!!agentLoading || results.length === 0}
            className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 flex items-center gap-1.5">
            {agentLoading === 'summarize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            Summarize Results
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {results.length > 0
            ? `${results.length} results available for AI analysis`
            : 'Enter a query and search, then use AI to analyze results'}
        </p>
      </div>

      {/* AI Enhanced Queries Panel */}
      {showEnhanced && enhancedQueries.length > 0 && (
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> AI-Optimized Queries
            </h3>
            <button onClick={() => setShowEnhanced(false)} className="p-1 text-purple-400 hover:text-purple-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {enhancedQueries.map((eq, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">&ldquo;{eq.query}&rdquo;</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {eq.sources.map(s => (
                      <span key={s} className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
                        {sourceIcon(s)} {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-purple-600 mt-1 italic">{eq.reason}</p>
                </div>
                <button onClick={() => applyEnhancedQuery(eq)}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 flex-shrink-0">
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Search Summary Panel */}
      {showSummary && searchSummary && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <Brain className="w-4 h-4" /> Results Summary
            </h3>
            <button onClick={() => setShowSummary(false)} className="p-1 text-green-400 hover:text-green-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none text-sm text-gray-700">
            {searchSummary.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-green-900 mt-3 mb-1 text-sm">{line.replace('## ', '')}</h3>;
              if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-sm text-gray-700 mt-0.5">{line.slice(2)}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-sm text-gray-700 mt-1">{line}</p>;
            })}
          </div>
        </div>
      )}

      {/* Results header */}
      {sortedResults.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{sortedResults.length} results found</h2>
          <div className="flex gap-2 text-xs text-gray-400">
            {[...new Set(sortedResults.map(r => r.source))].map(src => (
              <span key={src} className="flex items-center gap-1">
                {sourceIcon(src)} {sortedResults.filter(r => r.source === src).length}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sortedResults.map((item, index) => {
          const key = item.source + ':' + item.external_id;
          const cat = getCategoryForResult(index);
          return (
            <div key={key} className={`p-4 bg-white rounded-lg border transition-colors ${
              item.already_linked ? 'border-green-200 bg-green-50/50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-base">{sourceIcon(item.source)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-gray-900 hover:text-blue-600 text-sm truncate">
                      {item.title}
                    </a>
                    {item.already_linked && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex-shrink-0">Linked</span>
                    )}
                  </div>
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
                    {item.metadata?.attendees ? (
                      <span>{(item.metadata.attendees as string[]).length} attendees</span>
                    ) : null}
                  </div>
                  {/* AI Category suggestion */}
                  {cat && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                        <Tags className="w-3 h-3" />
                        {cat.suggested_topic_name}
                        <span className="text-blue-400">({Math.round(cat.confidence * 100)}%)</span>
                      </span>
                      {cat.suggested_topic_id && !item.already_linked && (
                        <button onClick={() => linkToTopic(item, cat.suggested_topic_id!)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          Quick Link
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 items-center flex-shrink-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Open in source">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {!item.already_linked && (
                    <div className="relative">
                      <button
                        onClick={() => setShowTopicDropdown(showTopicDropdown === key ? null : key)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-1 transition-colors"
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
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between disabled:opacity-50 transition-colors"
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
                                className="flex-1 px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                                onKeyDown={e => e.key === 'Enter' && createTopicAndLink(item)}
                              />
                              <button
                                onClick={() => createTopicAndLink(item)}
                                disabled={creatingTopic}
                                className="px-2 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
                              >
                                {creatingTopic ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                New
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
          <p className="text-gray-400 text-xs mt-1">Try different keywords, broaden your date range, or check your source connections in Settings</p>
          <button onClick={runSmartSearch} disabled={!!agentLoading}
            className="mt-3 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 flex items-center gap-2 mx-auto transition-colors">
            <Wand2 className="w-4 h-4" /> Try AI Smart Search
          </button>
        </div>
      )}

      {!loading && results.length === 0 && !query && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Search across your connected sources</p>
          <p className="text-gray-400 text-xs mt-1">Find emails, events, files, messages, and Notion pages — then link them to your topics</p>
        </div>
      )}
    </div>
  );
}
