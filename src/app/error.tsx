'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  const isNotFound = error.message?.includes('not found') || error.message?.includes('404');
  const isNetworkError = error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('ECONNREFUSED');
  const isAuthError = error.message?.includes('auth') || error.message?.includes('unauthorized') || error.message?.includes('401');

  const errorType = isNotFound
    ? { title: 'Not Found', desc: 'The resource you\'re looking for doesn\'t exist or has been moved.', icon: '🔍', color: 'amber' }
    : isNetworkError
    ? { title: 'Connection Issue', desc: 'Unable to reach the server. Please check your connection and try again.', icon: '🌐', color: 'blue' }
    : isAuthError
    ? { title: 'Authentication Error', desc: 'Your session may have expired. Please sign in again.', icon: '🔒', color: 'purple' }
    : { title: 'Something went wrong', desc: 'An unexpected error occurred. Our team has been notified.', icon: '⚠️', color: 'red' };

  const colorClasses = {
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'bg-purple-100' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconBg: 'bg-red-100' },
  }[errorType.color]!;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 animate-fade-in">
      <div className={`w-full max-w-md p-8 rounded-2xl border ${colorClasses.bg} ${colorClasses.border}`}>
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl ${colorClasses.iconBg} flex items-center justify-center text-3xl mb-4`}>
            {errorType.icon}
          </div>
          <h2 className={`text-xl font-bold ${colorClasses.text} mb-2`}>{errorType.title}</h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">{errorType.desc}</p>

          {error.digest && (
            <p className="text-xs text-gray-400 mb-4 font-mono">Error ID: {error.digest}</p>
          )}

          <div className="flex items-center gap-3 w-full">
            <button
              onClick={reset}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <a
              href="/dashboard"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-all"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Decorative */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-500/5 blur-3xl" />
      </div>
    </div>
  );
}
