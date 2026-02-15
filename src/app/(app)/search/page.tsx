import { SearchPanel } from '@/components/search/search-panel';

export default function SearchPage() {
  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Search</h1>
      <SearchPanel />
    </div>
  );
}
