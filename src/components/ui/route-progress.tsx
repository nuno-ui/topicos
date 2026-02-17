'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A lightweight NProgress-style route transition indicator.
 * Shows a gradient progress bar at the top of the page during navigation.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    cleanup();
    setProgress(0);
    setVisible(true);

    // Incrementally increase progress
    let currentProgress = 0;
    timerRef.current = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress > 90) currentProgress = 90;
      setProgress(currentProgress);
    }, 200);
  }, [cleanup]);

  const complete = useCallback(() => {
    cleanup();
    setProgress(100);

    completeTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, [cleanup]);

  // Track route changes
  const prevPathRef = useRef(pathname);
  const prevSearchRef = useRef(searchParams?.toString());

  useEffect(() => {
    const currentSearch = searchParams?.toString();
    if (prevPathRef.current !== pathname || prevSearchRef.current !== currentSearch) {
      // Route changed — complete the progress bar
      complete();
      prevPathRef.current = pathname;
      prevSearchRef.current = currentSearch;
    }
  }, [pathname, searchParams, complete]);

  // Listen for link clicks to start progress
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Ignore external links, hash links, and links with modifiers
      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.target === '_blank') return;

      // Only trigger for internal navigation that differs from current
      const currentPath = window.location.pathname + window.location.search;
      if (href !== currentPath) {
        start();
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [start]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="h-full brand-gradient transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
      {/* Glow effect at the leading edge */}
      {progress < 100 && (
        <div
          className="absolute top-0 right-0 w-24 h-full opacity-60"
          style={{
            background: 'linear-gradient(to left, rgba(139, 92, 246, 0.5), transparent)',
            transform: `translateX(${progress < 5 ? 0 : 0}px)`,
          }}
        />
      )}
    </div>
  );
}
