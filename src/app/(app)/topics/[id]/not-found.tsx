import Link from 'next/link';
import { FolderKanban, ArrowLeft, Search } from 'lucide-react';

export default function TopicNotFound() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-fade-in">
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-6">
          <FolderKanban className="w-10 h-10 text-blue-300" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Topic not found</h2>
        <p className="text-gray-500 text-sm mb-8 text-center max-w-md leading-relaxed">
          This topic may have been deleted, archived, or you might not have access to it.
          Try searching for it or head back to your topics list.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/topics"
            className="inline-flex items-center gap-2 px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            All Topics
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all"
          >
            <Search className="w-4 h-4" />
            Search
          </Link>
        </div>
      </div>
    </div>
  );
}
