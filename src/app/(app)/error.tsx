'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Home, Copy, ChevronDown, ChevronUp, Wifi, WifiOff, ShieldAlert, ServerCrash } from 'lucide-react';

/** Categorize errors for better user messaging */
function categorizeError(error: Error): { icon: React.ReactNode; title: string; description: string } {
  const msg = error.message?.toLowerCase() || '';

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('load failed')) {
    return {
      icon: <WifiOff className="w-10 h-10 text-amber-500" />,
      title: 'Connection issue',
      description: 'Unable to reach the server. Check your internet connection and try again.',
    };
  }
  if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('auth') || msg.includes('session')) {
    return {
      icon: <ShieldAlert className="w-10 h-10 text-orange-500" />,
      title: 'Authentication error',
      description: 'Your session may have expired. Try refreshing or sign in again.',
    };
  }
  if (msg.includes('500') || msg.includes('server') || msg.includes('internal')) {
    return {
      icon: <ServerCrash className="w-10 h-10 text-red-500" />,
      title: 'Server error',
      description: 'The server encountered an issue. This is usually temporary \u2014 try again in a moment.',
    };
  }
  return {
    icon: <AlertTriangle className="w-10 h-10 text-red-500" />,
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Try again or return to the dashboard.',
  };
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  const errorInfo = categorizeError(error);

  const handleCopyError = () => {
    const errorText = [
      `Error: ${error.message}`,
      error.digest ? `Error ID: ${error.digest}` : null,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}`,
      `Time: ${new Date().toISOString()}`,
      error.stack ? `\nStack:\n${error.stack}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8 animate-fade-in">
      <div className="text-center max-w-lg w-full">
        {/* Gradient accent bar */}
        <div className="w-full h-1 brand-gradient rounded-full mb-8 opacity-40" />

        {/* Icon */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 brand-gradient rounded-2xl opacity-10" />
          <div className="absolute inset-0 flex items-center justify-center">
            {errorInfo.icon}
          </div>
        </div>

        {/* Error code */}
        {error.digest && (
          <p className="text-xs font-mono text-gray-400 mb-3 tracking-widest uppercase">
            Error {error.digest}
          </p>
        )}

        <h2 className="text-2xl font-bold text-gray-900 mb-2">{errorInfo.title}</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {errorInfo.description}
        </p>

        {/* Error message display */}
        {error.message && (
          <div className="mb-6 mx-auto max-w-md">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between gap-2 text-xs text-gray-400 hover:text-gray-600 font-mono bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-xl transition-colors"
              aria-expanded={showDetails}
              aria-label="Toggle error details"
            >
              <span className="truncate">{error.message}</span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              )}
            </button>

            {showDetails && error.stack && (
              <div className="mt-2 bg-gray-50 border border-gray-100 rounded-xl p-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                    Stack Trace
                  </span>
                  <button
                    onClick={handleCopyError}
                    className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Copy error details to clipboard"
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="text-[11px] text-gray-500 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto leading-relaxed">
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-all active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        {/* Bottom gradient accent */}
        <div className="w-full h-1 brand-gradient rounded-full mt-8 opacity-40" />
      </div>
    </div>
  );
}
