import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      {/* Brand logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-lg">T</span>
        </div>
        <span className="text-xl font-extrabold brand-gradient-text tracking-tight">TopicOS</span>
      </div>

      {/* Large 404 with gradient */}
      <h1 className="text-[10rem] sm:text-[12rem] font-black leading-none brand-gradient-text select-none tracking-tighter">
        404
      </h1>

      {/* Message */}
      <div className="text-center max-w-md -mt-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Page not found
        </h2>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          The page you are looking for does not exist or may have been moved.
          Check the URL or head back to your dashboard.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
            </svg>
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all"
          >
            Home
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
