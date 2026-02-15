import { SearchPanel } from '@/components/search/search-panel';

export default function SearchPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Search</h1>
        <p className="text-gray-500 mt-1 text-sm">Search across all your connected sources &mdash; Gmail, Slack, Notion, Calendar & Drive</p>
      </div>
      <SearchPanel />
    </div>
  );
}
