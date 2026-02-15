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
    case 'notion': return '📓';
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
    case 'notion': return 'Page';
    case 'manual': return 'Note';
    default: return source;
  }
}

export function sourceColor(source: string) {
  switch (source) {
    case 'gmail': return 'text-red-600 bg-red-50';
    case 'calendar': return 'text-blue-600 bg-blue-50';
    case 'drive': return 'text-yellow-600 bg-yellow-50';
    case 'slack': return 'text-purple-600 bg-purple-50';
    case 'notion': return 'text-gray-800 bg-gray-100';
    case 'manual': return 'text-green-600 bg-green-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}
