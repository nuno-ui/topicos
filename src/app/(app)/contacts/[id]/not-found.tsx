import Link from 'next/link';
import { Users, ArrowLeft, Search } from 'lucide-react';

export default function ContactNotFound() {
  return (
    <div className="p-4 md:p-8 max-w-5xl animate-fade-in">
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 flex items-center justify-center mb-6">
          <Users className="w-10 h-10 text-teal-300" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact not found</h2>
        <p className="text-gray-500 text-sm mb-8 text-center max-w-md leading-relaxed">
          This contact may have been removed or merged with another contact.
          Try searching for them or browse your contacts list.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/contacts"
            className="inline-flex items-center gap-2 px-5 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            All Contacts
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
