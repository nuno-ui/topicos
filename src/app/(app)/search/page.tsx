import { Search } from 'lucide-react';
import { SearchPanel } from '@/components/search/search-panel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search - TopicOS',
  description: 'Search across all your connected sources',
};

export default function SearchPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-page-enter">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Search</h1>
            <p className="text-gray-500 text-sm">Search across Gmail, Slack, Notion, Calendar & Drive</p>
          </div>
        </div>
      </div>
      <SearchPanel />
    </div>
  );
}
