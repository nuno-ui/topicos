'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { sourceIcon, sourceLabel, formatRelativeDate } from '@/lib/utils';

interface SearchResult {
  external_id: string; source: string; source_account_id: string;
  title: string; snippet: string; url: string; occurred_at: string;
  metadata: Record<string, unknown>; already_linked?: boolean;
}

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources] = useState(['gmail', 'calendar', 'drive', 'slack']);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sources }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const allItems: SearchResult[] = [];
      for (const src of data.results ?? []) {
        allItems.push(...(src.items ?? []));
      }
      setResults(allItems);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search across all sources..."
          className="flex-1 px-4 py-2 border rounded-lg" />
        <button onClick={handleSearch} disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      <div className="space-y-2">
        {results.map((item, i) => (
          <a key={i} href={item.url} target="_blank" className="block p-3 bg-white rounded-lg border">
            <p className="font-medium">{sourceIcon(item.source)} {item.title}</p>
            <p className="text-sm text-gray-500">{item.snippet}</p>
            <span className="text-xs text-gray-400">{sourceLabel(item.source)} - {formatRelativeDate(item.occurred_at)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
