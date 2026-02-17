'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { sourceLabel, formatRelativeDate, sourceBorderClass, sourceToggleClass, sourceIconBgClass, decodeHtmlEntities } from '@/lib/utils';
import { SourceIcon } from '@/components/ui/source-icon';
import { Search, Link2, Plus, ExternalLink, Loader2, ChevronDown, ChevronUp, ChevronRight, Clock, ArrowUpDown, Calendar, X, Sparkles, Brain, Tags, Wand2, Bookmark, BookmarkCheck, Eye, Mail, Filter, RotateCcw, ChevronsUpDown, SearchX, Lightbulb, ClipboardCopy } from 'lucide-react';

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
  account_email?: string;
}

interface ConnectedAccounts {
  google: Array<{ id: string; email: string }>;
  slack: Array<{ id: string; name: string }>;
  notion: Array<{ id: string; name: string }>;
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

const SOURCES = ['gmail', 'calendar', 'drive', 'slack', 'notion', 'manual', 'link'] as const;

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

  // Concept search state
  const [conceptResults, setConceptResults] = useState<SearchResult[]>([]);
  const [conceptInfo, setConceptInfo] = useState<{ concepts: string[]; related_terms: Record<string, string[]> } | null>(null);
  const [showConceptResults, setShowConceptResults] = useState(false);

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<Array<{ query: string; sources: string[]; dateFrom?: string; dateTo?: string }>>([]);

  // Account filtering
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccounts>({ google: [], slack: [], notion: [] });
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  // Expanded result preview
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  // Multi-select state
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [batchLinking, setBatchLinking] = useState(false);
  const [batchTopicId, setBatchTopicId] = useState<string | null>(null);

  // Collapse/expand groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Search error state
  const [searchError, setSearchError] = useState<string | null>(null);

  // Track whether a search has been performed (for showing empty state vs initial state)
  const [hasSearched, setHasSearched] = useState(false);

  // Hover preview state for result cards
  const [hoveredResult, setHoveredResult] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Rotating placeholder
  const placeholderHints = [
    'Search emails about project updates...',
    'Find Slack messages from your team...',
    'Look up meeting notes from last week...',
    'Search Notion pages about strategy...',
    'Find invoices or receipts in Drive...',
    'Search for messages mentioning deadlines...',
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % placeholderHints.length);
    }, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch('/api/topics').then(r => {
      if (!r.ok) throw new Error(`Failed to load topics: ${r.status}`);
      return r.json();
    }).then(data => {
      setTopics(data.topics || []);
    }).catch(() => {
      // Silent — topics list used for optional linking
    });

    try {
      const saved = localStorage.getItem('topicos_recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
    try {
      const savedFilters = localStorage.getItem('topicos_saved_searches');
      if (savedFilters) setSavedSearches(JSON.parse(savedFilters));
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
    setSearchError(null);
    saveRecentSearch(query.trim());
    try {
      const accountIds = selectedAccounts.size > 0 ? Array.from(selectedAccounts) : undefined;
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          sources: Array.from(sources),
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          account_ids: accountIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Store connected accounts info
      if (data.accounts) {
        setConnectedAccounts(data.accounts);
      }

      const allItems: SearchResult[] = [];
      for (const src of data.results ?? []) {
        if (src.error) {
          toast.error(`${src.source}: ${src.error}`);
        }
        allItems.push(...(src.items ?? []));
      }
      setResults(allItems);
      setSelectedResults(new Set());
      setCategorized([]);
      setShowCategorized(false);
      setSearchSummary(null);
      setCollapsedGroups(new Set());
      setHasSearched(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setSearchError(message);
      toast.error(message);
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

  const saveCurrentSearch = () => {
    if (!query.trim()) { toast.error('Enter a search query first'); return; }
    const newSaved = { query: query.trim(), sources: Array.from(sources), dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
    setSavedSearches(prev => {
      const next = [newSaved, ...prev.filter(s => s.query !== query.trim())].slice(0, 10);
      try { localStorage.setItem('topicos_saved_searches', JSON.stringify(next)); } catch {}
      return next;
    });
    toast.success('Search saved');
  };

  const loadSavedSearch = (saved: { query: string; sources: string[]; dateFrom?: string; dateTo?: string }) => {
    setQuery(saved.query);
    setSources(new Set(saved.sources));
    if (saved.dateFrom) setDateFrom(saved.dateFrom);
    if (saved.dateTo) setDateTo(saved.dateTo);
    toast.info('Search loaded — click Search to run');
  };

  const removeSavedSearch = (queryToRemove: string) => {
    setSavedSearches(prev => {
      const next = prev.filter(s => s.query !== queryToRemove);
      try { localStorage.setItem('topicos_saved_searches', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const toggleResultSelection = (key: string) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllResults = () => {
    const allKeys = sortedResults.filter(r => !r.already_linked).map(r => r.source + ':' + r.external_id);
    setSelectedResults(new Set(allKeys));
  };

  const clearSelection = () => {
    setSelectedResults(new Set());
    setBatchTopicId(null);
  };

  const batchLinkToTopic = async (topicId: string) => {
    const toLink = sortedResults.filter(r =>
      selectedResults.has(r.source + ':' + r.external_id) && !r.already_linked
    );
    if (toLink.length === 0) { toast.error('No new items selected'); return; }
    setBatchLinking(true);
    let linked = 0;
    for (const result of toLink) {
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
        if (res.ok) linked++;
      } catch { /* continue */ }
    }
    setResults(prev => prev.map(r =>
      selectedResults.has(r.source + ':' + r.external_id) ? { ...r, already_linked: true } : r
    ));
    setSelectedResults(new Set());
    setBatchTopicId(null);
    setBatchLinking(false);
    const topic = topics.find(t => t.id === topicId);
    toast.success(`Linked ${linked} item${linked !== 1 ? 's' : ''} to "${topic?.title || 'topic'}"`);
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

  const runConceptSearch = async () => {
    if (!query.trim()) { toast.error('Enter a concept to search for'); return; }
    setAgentLoading('concept_search');
    try {
      const res = await fetch('/api/ai/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'concept_search',
          context: { query, sources: Array.from(sources) }
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const conceptItems = (data.result.results || []) as SearchResult[];
      setConceptResults(conceptItems);
      setConceptInfo({
        concepts: data.result.concepts || [],
        related_terms: data.result.related_terms || {},
      });
      setShowConceptResults(true);
      toast.success(`Found ${conceptItems.length} results across ${data.result.search_queries_used || 0} queries (EN/ES/PT)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Concept search failed');
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

  // Group results by source
  const groupedResults = sortedResults.reduce<Record<string, { results: SearchResult[]; indices: number[] }>>((acc, item, index) => {
    if (!acc[item.source]) acc[item.source] = { results: [], indices: [] };
    acc[item.source].results.push(item);
    acc[item.source].indices.push(index);
    return acc;
  }, {});

  const sourceGroups = Object.keys(groupedResults);

  const toggleGroup = (source: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const collapseAllGroups = () => setCollapsedGroups(new Set(sourceGroups));
  const expandAllGroups = () => setCollapsedGroups(new Set());

  const allGroupsCollapsed = sourceGroups.length > 0 && collapsedGroups.size === sourceGroups.length;

  // Source color dot class for the results summary bar
  const sourceColorDotClass = (source: string): string => {
    switch (source) {
      case 'gmail': return 'bg-red-400';
      case 'calendar': return 'bg-blue-400';
      case 'drive': return 'bg-yellow-400';
      case 'slack': return 'bg-purple-400';
      case 'notion': return 'bg-gray-700';
      case 'manual': return 'bg-green-400';
      case 'link': return 'bg-cyan-400';
      default: return 'bg-gray-400';
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  // Handle hover with delay for result cards
  const handleResultHover = (key: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredResult(key);
    }, 500);
  };

  const handleResultLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredResult(null);
  };

  // Quick date filter helpers
  const setQuickDateRange = (preset: 'today' | 'this_week' | 'this_month' | 'last_3_months') => {
    const now = new Date();
    const toDate = now.toISOString().split('T')[0];
    let fromDate: string;
    switch (preset) {
      case 'today':
        fromDate = toDate;
        break;
      case 'this_week': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now);
        monday.setDate(diff);
        fromDate = monday.toISOString().split('T')[0];
        break;
      }
      case 'this_month': {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        fromDate = first.toISOString().split('T')[0];
        break;
      }
      case 'last_3_months': {
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        fromDate = threeMonthsAgo.toISOString().split('T')[0];
        break;
      }
    }
    setDateFrom(fromDate);
    setDateTo(toDate);
    setShowDateFilters(true);
  };

  // Clear all filters (user can then click Search to retry)
  const clearFiltersAndRetry = () => {
    setSources(new Set(SOURCES));
    setDateFrom('');
    setDateTo('');
    setSelectedAccounts(new Set());
    setShowDateFilters(false);
    toast.info('Filters cleared -- click Search to retry');
  };

  // Active source filter count
  const activeFilterCount = sources.size;

  return (
    <div>
      {/* Search Input -- larger and more prominent with gradient border on focus */}
      <div className="space-y-3 mb-6">
        <label htmlFor="search-input" className="sr-only">Search across all connected sources</label>
        <div className="flex gap-2">
          <div className="flex-1 search-input-wrapper rounded-xl">
            <input
              id="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={placeholderHints[placeholderIndex]}
              className="w-full px-5 py-3.5 border border-gray-200 rounded-xl text-base focus:outline-none search-input-glow pr-28 bg-white relative z-[1] placeholder:text-gray-400"
            />
            {(query || (hasSearched && sortedResults.length > 0)) && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[2] flex items-center gap-1.5">
                {hasSearched && sortedResults.length > 0 && !loading && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 whitespace-nowrap">
                    {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
                  </span>
                )}
                {query && (
                  <button onClick={() => { setQuery(''); setResults([]); setSearchError(null); setHasSearched(false); }}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Clear search"
                    title="Clear search">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm hover:shadow-md"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
          {query.trim() && (
            <button onClick={saveCurrentSearch} title="Save this search"
              className="p-3.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl border border-gray-200 transition-all hover:border-amber-200 hover:shadow-sm">
              {savedSearches.some(s => s.query === query.trim()) ? <BookmarkCheck className="w-4 h-4 text-amber-500" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Search results summary bar */}
        {hasSearched && sortedResults.length > 0 && !loading && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 animate-fade-in">
            <div className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">
                Found {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
              </span>
              <span className="text-sm text-gray-500">
                across {sourceGroups.length} source{sourceGroups.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {sourceGroups.map(src => (
                <span key={src} className="inline-flex items-center gap-1 text-xs text-gray-600">
                  <span className={`w-2 h-2 rounded-full ${sourceColorDotClass(src)}`} />
                  {groupedResults[src].results.length} {sourceLabel(src).toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Source filters with source-colored backgrounds when active */}
        <div className="flex gap-2 text-xs items-center flex-wrap">
          <span className="text-gray-500 py-1.5 font-medium">Sources ({activeFilterCount}/{SOURCES.length}):</span>
          {sources.size === SOURCES.length ? (
            <button onClick={() => setSources(new Set())}
              className="px-2.5 py-1.5 rounded-full bg-gray-200 text-gray-600 font-medium hover:bg-gray-300 transition-colors">
              Deselect All
            </button>
          ) : (
            <button onClick={() => setSources(new Set(SOURCES))}
              className="px-2.5 py-1.5 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors">
              Select All
            </button>
          )}
          {SOURCES.map(src => (
            <button key={src} onClick={() => toggleSource(src)}
              className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 border ${
                sources.has(src)
                  ? `${sourceToggleClass(src)} font-medium shadow-sm`
                  : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
              }`}>
              <SourceIcon source={src} className="w-3.5 h-3.5" /> {sourceLabel(src)}
            </button>
          ))}
          <span className="text-gray-300 mx-1">|</span>
          <button onClick={() => setShowDateFilters(!showDateFilters)}
            className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 border ${
              showDateFilters || dateFrom || dateTo
                ? 'bg-amber-50 text-amber-700 font-medium border-amber-200'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-transparent'
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

        {/* Email account filters (show when multiple Google accounts connected) */}
        {connectedAccounts.google.length > 1 && (sources.has('gmail') || sources.has('calendar') || sources.has('drive')) && (
          <div className="flex gap-2 items-center flex-wrap text-xs">
            <span className="text-gray-500 flex items-center gap-1 py-1.5">
              <Filter className="w-3 h-3" />
              Accounts:
            </span>
            <button
              onClick={() => setSelectedAccounts(new Set())}
              className={`px-2.5 py-1.5 rounded-full transition-colors ${
                selectedAccounts.size === 0
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              All accounts
            </button>
            {connectedAccounts.google.map(account => (
              <button
                key={account.id}
                onClick={() => {
                  setSelectedAccounts(prev => {
                    const next = new Set(prev);
                    if (next.has(account.id)) next.delete(account.id);
                    else next.add(account.id);
                    return next;
                  });
                }}
                className={`px-2.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  selectedAccounts.has(account.id)
                    ? 'bg-red-100 text-red-700 font-medium'
                    : selectedAccounts.size === 0
                      ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                <Mail className="w-3 h-3" />
                {account.email}
              </button>
            ))}
            {selectedAccounts.size > 0 && (
              <button onClick={() => setSelectedAccounts(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Date range filter */}
        {showDateFilters && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
            <div className="flex gap-2 items-center flex-wrap">
              <Calendar className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-700 font-medium flex-shrink-0">Quick:</span>
              {[
                { label: 'Today', value: 'today' as const },
                { label: 'This Week', value: 'this_week' as const },
                { label: 'This Month', value: 'this_month' as const },
                { label: 'Last 3 Months', value: 'last_3_months' as const },
              ].map(chip => (
                <button
                  key={chip.value}
                  onClick={() => setQuickDateRange(chip.value)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 transition-colors hover:shadow-sm"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3 items-center">
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
          </div>
        )}

        {/* Saved searches */}
        {savedSearches.length > 0 && !query && results.length === 0 && (
          <div className="flex gap-2 items-center flex-wrap">
            <Bookmark className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-amber-500 font-medium">Saved:</span>
            {savedSearches.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <button onClick={() => loadSavedSearch(s)}
                  className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full hover:bg-amber-100 transition-colors font-medium border border-amber-200 hover:shadow-sm">
                  {s.query}
                </button>
                <button onClick={() => removeSavedSearch(s.query)} className="text-amber-300 hover:text-amber-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Recent searches -- styled as subtle chips */}
        {recentSearches.length > 0 && (
          <div className="flex gap-2 items-center flex-wrap">
            <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 flex-shrink-0">Recent:</span>
            {recentSearches.slice(0, 5).map((s, i) => (
              <button key={i} onClick={() => { setQuery(s); }}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200 transition-all hover:shadow-sm cursor-pointer"
                title={`Search for "${s}"`}>
                <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="truncate max-w-[150px]">&ldquo;{s}&rdquo;</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AI Assistants Panel */}
      <div className="mb-6 p-4 bg-gradient-to-br from-white to-purple-50/50 rounded-xl border border-gray-100 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          AI Search Assistants
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={runSmartSearch} disabled={!!agentLoading}
            className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-medium hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1.5 hover:shadow-sm transition-all">
            {agentLoading === 'smart_search' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            Smart Search
          </button>
          <button onClick={runCategorize} disabled={!!agentLoading || results.length === 0}
            className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1.5 hover:shadow-sm transition-all">
            {agentLoading === 'categorize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tags className="w-3.5 h-3.5" />}
            Auto-Categorize
          </button>
          <button onClick={runSummarize} disabled={!!agentLoading || results.length === 0}
            className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50 flex items-center gap-1.5 hover:shadow-sm transition-all">
            {agentLoading === 'summarize' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            Summarize Results
          </button>
          <button onClick={runConceptSearch} disabled={!!agentLoading}
            className="px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:from-blue-100 hover:to-purple-100 disabled:opacity-50 flex items-center gap-1.5 hover:shadow-sm transition-all">
            {agentLoading === 'concept_search' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Concept Search (EN/ES/PT)
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {results.length > 0
            ? `${results.length} results available for AI analysis`
            : 'Enter a query and search, then use AI to analyze results'}
        </p>
      </div>

      {/* AI Enhanced Queries Panel -- gradient card with sparkles */}
      {showEnhanced && enhancedQueries.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 via-white to-blue-50 rounded-xl border border-purple-200 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              AI-Optimized Queries
            </h3>
            <button onClick={() => setShowEnhanced(false)} className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {enhancedQueries.map((eq, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/80 rounded-lg border border-purple-100 hover-lift">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">&ldquo;{eq.query}&rdquo;</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {eq.sources.map(s => (
                      <span key={s} className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded inline-flex items-center gap-0.5">
                        <SourceIcon source={s} className="w-3 h-3" /> {s}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-purple-600 mt-1 italic">{eq.reason}</p>
                </div>
                <button onClick={() => applyEnhancedQuery(eq)}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-xs font-medium hover:from-purple-700 hover:to-blue-700 flex-shrink-0 shadow-sm transition-all">
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Search Summary Panel */}
      {showSummary && searchSummary && (
        <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-200 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              Results Summary
            </h3>
            <button onClick={() => setShowSummary(false)} className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-100 rounded-lg transition-colors">
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

      {/* Concept Search Results Panel */}
      {showConceptResults && conceptResults.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Search className="w-4 h-4" /> Concept Search Results ({conceptResults.length})
            </h3>
            <button onClick={() => setShowConceptResults(false)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {conceptInfo && (
            <div className="mb-3 space-y-2">
              <div className="flex gap-1 flex-wrap">
                <span className="text-xs text-blue-600 font-medium">Core concepts:</span>
                {conceptInfo.concepts.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{c}</span>
                ))}
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                {Object.entries(conceptInfo.related_terms).map(([lang, terms]) => (
                  <span key={lang}>
                    <span className="font-medium uppercase">{lang}:</span> {(terms as string[]).slice(0, 4).join(', ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-96 overflow-y-auto thin-scrollbar">
            {conceptResults.map((item) => {
              const key = item.source + ':' + item.external_id;
              return (
                <div key={key} className={`flex items-start gap-3 p-3 bg-white rounded-lg border-l-[3px] ${sourceBorderClass(item.source)} border border-blue-100 hover-lift`}>
                  <div className={`w-7 h-7 rounded-full ${sourceIconBgClass(item.source)} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <SourceIcon source={item.source} className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-gray-900 hover:text-blue-600 text-sm truncate block">
                      {decodeHtmlEntities(item.title)}
                    </a>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{decodeHtmlEntities(item.snippet)}</p>
                    <div className="flex gap-2 mt-1 text-xs text-gray-400">
                      <span>{sourceLabel(item.source)}</span>
                      <span>{formatRelativeDate(item.occurred_at)}</span>
                      {(item as SearchResult & { ai_confidence?: number }).ai_confidence != null && (
                        <span className="text-blue-600 font-medium">
                          {Math.round(((item as SearchResult & { ai_confidence?: number }).ai_confidence || 0) * 100)}% match
                        </span>
                      )}
                    </div>
                    {(item as SearchResult & { ai_reason?: string }).ai_reason && (
                      <p className="text-xs text-blue-600 mt-0.5 italic">{(item as SearchResult & { ai_reason?: string }).ai_reason}</p>
                    )}
                  </div>
                  {!item.already_linked && (
                    <button
                      onClick={() => setShowTopicDropdown(showTopicDropdown === key ? null : key)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded flex items-center gap-0.5"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading state -- skeleton shimmer cards */}
      {loading && (
        <div className="space-y-3 mb-6 animate-fade-in">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton w-3/4" />
                  <div className="h-3 skeleton w-full" />
                  <div className="h-3 skeleton w-1/2" />
                  <div className="flex gap-2 mt-1">
                    <div className="h-3 skeleton w-16" />
                    <div className="h-3 skeleton w-20" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results header */}
      {sortedResults.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{sortedResults.length} results found</h2>
          <div className="flex gap-2 items-center">
            {sourceGroups.length > 1 && (
              <button
                onClick={allGroupsCollapsed ? expandAllGroups : collapseAllGroups}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                {allGroupsCollapsed ? 'Expand All' : 'Collapse All'}
              </button>
            )}
            <div className="flex gap-2 text-xs text-gray-400">
              {sourceGroups.map(src => (
                <span key={src} className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border ${sourceToggleClass(src)}`}>
                  <SourceIcon source={src} className="w-3.5 h-3.5" /> {sourceLabel(src)} ({groupedResults[src].results.length})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grouped results by source */}
      {!loading && (
        <div className="space-y-4">
          {sourceGroups.map(src => {
            const group = groupedResults[src];
            const isCollapsed = collapsedGroups.has(src);
            return (
              <div key={src} className="space-y-2">
                {/* Group header */}
                {sourceGroups.length > 1 && (
                  <button
                    onClick={() => toggleGroup(src)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    <div className={`w-6 h-6 rounded-full ${sourceIconBgClass(src)} flex items-center justify-center`}>
                      <SourceIcon source={src} className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{sourceLabel(src)}</span>
                    <span className="text-xs text-gray-400 font-normal">({group.results.length})</span>
                  </button>
                )}
                {/* Group items */}
                {!isCollapsed && (
                  <div className="space-y-2 animate-stagger">
                    {group.results.map((item, groupIdx) => {
                      const key = item.source + ':' + item.external_id;
                      const globalIndex = group.indices[groupIdx];
                      const cat = getCategoryForResult(globalIndex);
                      const isHovered = hoveredResult === key;
                      return (
                        <div key={key}
                          onMouseEnter={() => handleResultHover(key)}
                          onMouseLeave={handleResultLeave}
                          className={`p-4 bg-white rounded-xl border-l-[3px] ${sourceBorderClass(item.source)} border transition-all hover-lift group/card ${
                          item.already_linked
                            ? 'border-green-200 bg-green-50/50'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}>
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedResults.has(key)}
                              onChange={() => toggleResultSelection(key)}
                              className="mt-1.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 cursor-pointer"
                              aria-label={`Select ${item.title}`}
                            />
                            {/* Source icon with colored background circle */}
                            <div className={`w-9 h-9 rounded-full ${sourceIconBgClass(item.source)} flex items-center justify-center flex-shrink-0`}>
                              <SourceIcon source={item.source} className="w-4.5 h-4.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {item.source === 'manual' ? (
                                  <span onClick={() => window.location.href = item.url}
                                    className="font-medium text-gray-900 hover:text-green-600 text-sm truncate cursor-pointer">
                                    {item.title}
                                  </span>
                                ) : (
                                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                                    className="font-medium text-gray-900 hover:text-blue-600 text-sm truncate">
                                    {item.title}
                                  </a>
                                )}
                                {item.already_linked && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex-shrink-0 flex items-center gap-0.5">
                                    <Link2 className="w-2.5 h-2.5" /> Linked
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs text-gray-500 mt-0.5 ${expandedResult === key ? '' : 'line-clamp-2'}`}>{decodeHtmlEntities(item.snippet)}</p>
                              {item.snippet && item.snippet.length > 100 && (
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedResult(expandedResult === key ? null : key); }}
                                  className="text-xs text-blue-500 hover:text-blue-700 mt-0.5 flex items-center gap-0.5">
                                  {expandedResult === key ? <><ChevronUp className="w-3 h-3" /> Less</> : <><Eye className="w-3 h-3" /> More</>}
                                </button>
                              )}
                              {/* Better metadata display */}
                              <div className="flex gap-3 mt-2 text-xs text-gray-400 items-center">
                                <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
                                  <Clock className="w-3 h-3" />
                                  {formatRelativeDate(item.occurred_at)}
                                </span>
                                {item.account_email && connectedAccounts.google.length > 1 && (
                                  <span className="flex items-center gap-1 text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                    <Mail className="w-2.5 h-2.5" /> {item.account_email}
                                  </span>
                                )}
                                {item.metadata?.from ? (
                                  <span className="bg-gray-50 px-1.5 py-0.5 rounded">from: {String(item.metadata.from).split('<')[0].trim()}</span>
                                ) : null}
                                {item.metadata?.channel_name ? (
                                  <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">#{String(item.metadata.channel_name)}</span>
                                ) : null}
                                {item.metadata?.attendees ? (
                                  <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{(item.metadata.attendees as string[]).length} attendees</span>
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
                              {/* Hover preview -- expanded snippet */}
                              {isHovered && item.snippet && item.snippet.length > 80 && expandedResult !== key && (
                                <div className="mt-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100 animate-fade-in">
                                  <p className="text-xs text-gray-600 leading-relaxed">{decodeHtmlEntities(item.snippet)}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1.5 items-center flex-shrink-0">
                              {/* Copy link button -- appears on hover */}
                              <button
                                onClick={() => copyToClipboard(item.url)}
                                className="p-2 text-gray-300 opacity-0 group-hover/card:opacity-100 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all"
                                title="Copy link"
                              >
                                <ClipboardCopy className="w-4 h-4" />
                              </button>
                              {item.source !== 'manual' && (
                                <a href={item.url} target="_blank" rel="noopener noreferrer"
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Open in source">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
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
                                    <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 max-h-80 overflow-y-auto animate-scale-in">
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty states -- context-dependent */}
      {!loading && results.length === 0 && query && searchError && (
        <div className="text-center py-12 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-gray-700 text-sm font-semibold">Search failed</p>
          <p className="text-red-500 text-xs mt-1 max-w-sm mx-auto">{searchError}</p>
          <button onClick={handleSearch}
            className="mt-4 px-5 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 flex items-center gap-2 mx-auto transition-colors">
            <RotateCcw className="w-4 h-4" /> Retry Search
          </button>
        </div>
      )}

      {/* No results -- enhanced inline empty state */}
      {!loading && results.length === 0 && hasSearched && query && !searchError && (
        <div className="text-center py-12 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-blue-50 flex items-center justify-center mx-auto mb-4">
            <SearchX className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-700 text-base font-semibold">No results found</p>
          <p className="text-gray-400 text-sm mt-1">
            Your search for <span className="font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">&ldquo;{query}&rdquo;</span> didn&apos;t match any items
          </p>

          {/* Active filters summary */}
          {(sources.size < SOURCES.length || dateFrom || dateTo) && (
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap text-xs text-gray-500">
              <Filter className="w-3 h-3" />
              <span>Active filters:</span>
              {sources.size < SOURCES.length && (
                <span className="px-2 py-0.5 bg-gray-100 rounded-full">{sources.size}/{SOURCES.length} sources</span>
              )}
              {dateFrom && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">from {dateFrom}</span>}
              {dateTo && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">to {dateTo}</span>}
            </div>
          )}

          <div className="mt-5 p-4 bg-blue-50 rounded-xl border border-blue-100 max-w-md mx-auto">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-blue-700">Suggestions to find what you need</p>
                <ul className="text-xs text-blue-600 mt-1.5 space-y-1">
                  <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" /> Try broader keywords or different phrasing</li>
                  <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" /> Check your source filters -- some sources may be disabled</li>
                  <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" /> Remove or widen the date range if set</li>
                  <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" /> Use AI Smart Search for intelligent query expansion</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-center mt-5 flex-wrap">
            {(sources.size < SOURCES.length || dateFrom || dateTo) && (
              <button onClick={clearFiltersAndRetry}
                className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-200 flex items-center gap-2 transition-colors border border-amber-200">
                <RotateCcw className="w-4 h-4" /> Clear filters &amp; retry
              </button>
            )}
            <button onClick={handleSearch}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 flex items-center gap-2 transition-colors">
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
            <button onClick={runSmartSearch} disabled={!!agentLoading}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl text-sm font-medium hover:from-purple-600 hover:to-blue-600 flex items-center gap-2 transition-all shadow-sm">
              <Wand2 className="w-4 h-4" /> Try AI Smart Search
            </button>
          </div>
        </div>
      )}

      {/* Initial empty state */}
      {!loading && results.length === 0 && !query && (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-5">
            <Search className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-gray-700 text-base font-semibold">Search across all your connected sources</p>
          <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">Find emails, events, files, messages, and Notion pages -- then link them to your topics</p>
        </div>
      )}

      {/* Floating action bar -- gradient background with better design */}
      {selectedResults.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 p-3 bg-gradient-to-r from-blue-600 via-blue-600 to-purple-600 border border-blue-500/50 rounded-2xl shadow-2xl flex items-center gap-3 animate-float-up max-w-xl glass-dark backdrop-blur-sm">
          <span className="text-sm font-semibold text-white whitespace-nowrap flex items-center gap-2">
            <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">{selectedResults.size}</span>
            selected
          </span>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex items-center gap-2">
            <select
              value={batchTopicId || ''}
              onChange={(e) => setBatchTopicId(e.target.value || null)}
              className="px-3 py-1.5 border border-white/20 rounded-lg text-sm bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 max-w-[200px] placeholder:text-white/50"
            >
              <option value="">Select topic...</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <button
              onClick={() => batchTopicId && batchLinkToTopic(batchTopicId)}
              disabled={!batchTopicId || batchLinking}
              className="px-4 py-1.5 bg-white text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-sm"
            >
              {batchLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Link {selectedResults.size} item{selectedResults.size !== 1 ? 's' : ''} to topic
            </button>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex gap-1">
            <button onClick={selectAllResults} className="text-xs text-white/70 hover:text-white font-medium whitespace-nowrap">Select all</button>
            <span className="text-white/30">|</span>
            <button onClick={clearSelection} className="text-xs text-white/70 hover:text-white font-medium">Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
