'use client';

import { useState, useEffect } from 'react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Client-rendered greeting to avoid hydration mismatch between server/client time.
 * Renders a placeholder on the server, then updates on mount.
 */
export function ClientGreeting() {
  const [greeting, setGreeting] = useState('Welcome');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setGreeting(getGreeting());
    setMounted(true);
  }, []);

  return (
    <span className="text-gray-900" suppressHydrationWarning>
      {mounted ? `${greeting}, ` : 'Welcome, '}
    </span>
  );
}

/**
 * Client-rendered date to avoid hydration mismatch.
 */
export function ClientDate() {
  const [dateStr, setDateStr] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDateStr(getFormattedDate());
    setMounted(true);
  }, []);

  return (
    <p className="text-gray-500 mt-1" suppressHydrationWarning>
      {mounted ? dateStr : '\u00A0'}
    </p>
  );
}
