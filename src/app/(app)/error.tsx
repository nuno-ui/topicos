'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, ChevronDown, ChevronUp } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  const handleCopyError = () => {
    const errorText = [
      `Error: ${error.message}`,
      error.digest ? `Error ID: ${error.digest}` : null,
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
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        {/* Error code */}
        {error.digest && (
          <p className="text-xs font-mono text-gray-400 mb-3 tracking-widest uppercase">
            Error {error.digest}
          </p>
        )}

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          An unexpected error occurred. This might be a temporary issue.
          Try again or return to the dashboard.
        </p>

        {/* Error message display */}
        {error.message && (
          <div className="mb-6 mx-auto max-w-md">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between gap-2 text-xs text-gray-400 hover:text-gray-600 font-mono bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-xl transition-colors"
            >
              <span className="truncate">{error.message}</span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
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
            onClick={() => (window.location.href = '/dashboard')}
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
