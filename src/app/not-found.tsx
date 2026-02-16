import Link from 'next/link';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      {/* Brand logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-lg">Y</span>
        </div>
        <span className="text-xl font-extrabold brand-gradient-text tracking-tight">YouOS</span>
      </div>

      {/* Large 404 with gradient — responsive sizing */}
      <h1 className="text-8xl sm:text-[10rem] md:text-[12rem] font-black leading-none brand-gradient-text select-none tracking-tighter">
        404
      </h1>

      {/* Message */}
      <div className="text-center max-w-md -mt-2 sm:-mt-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Page not found
        </h2>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          The page you are looking for does not exist or may have been moved.
          Check the URL or head back to your dashboard.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-center flex-wrap">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all"
          >
            <Search className="w-4 h-4" />
            Search
          </Link>
        </div>
      </div>

      {/* Decorative gradient orbs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>
    </div>
  );
}
