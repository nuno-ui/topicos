import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelativeDate(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(date);
}

export function sourceIcon(source: string) {
  switch (source) {
    case 'gmail': return '📧';
    case 'calendar': return '📅';
    case 'drive': return '📁';
    case 'slack': return '💬';
    case 'manual': return '📝';
    default: return '📄';
  }
}

export function sourceLabel(source: string) {
  switch (source) {
    case 'gmail': return 'Email';
    case 'calendar': return 'Event';
    case 'drive': return 'File';
    case 'slack': return 'Message';
    case 'manual': return 'Note';
    default: return source;
  }
}
