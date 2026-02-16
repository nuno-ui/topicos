import { Search } from 'lucide-react';
import { SearchPanel } from '@/components/search/search-panel';

export default function SearchPage() {
  return (
    <div className="p-8 max-w-5xl animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Search className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Search</h1>
        </div>
        <p className="text-gray-500 mt-1 text-sm">Search across all your connected sources &mdash; Gmail, Slack, Notion, Calendar & Drive</p>
      </div>
      <SearchPanel />
    </div>
  );
}
