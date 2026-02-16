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

export function formatTimeAgo(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(date);
}

export function sourceIcon(source: string) {
  switch (source) {
    case 'gmail': return '✉';
    case 'calendar': return '📅';
    case 'drive': return '📁';
    case 'slack': return '💬';
    case 'notion': return '📓';
    case 'manual': return '📝';
    case 'link': return '🔗';
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
    case 'link': return 'Link';
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
    case 'link': return 'text-cyan-600 bg-cyan-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + 's');
}

export function getDaysUntil(date: string | Date): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// Constants for consistency across the app
export const AREA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  work: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  personal: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  career: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  paused: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  archived: { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
};

export const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Low', color: 'text-gray-400' },
  2: { label: 'Medium-Low', color: 'text-blue-400' },
  3: { label: 'Medium', color: 'text-amber-500' },
  4: { label: 'High', color: 'text-orange-500' },
  5: { label: 'Critical', color: 'text-red-600' },
};

export function getActivityLevel(lastInteractionAt: string | null): { label: string; color: string; dotColor: string } {
  if (!lastInteractionAt) return { label: 'New', color: 'text-gray-400', dotColor: 'bg-gray-300' };
  const days = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return { label: 'Active', color: 'text-emerald-600', dotColor: 'bg-emerald-400' };
  if (days <= 30) return { label: 'Recent', color: 'text-blue-600', dotColor: 'bg-blue-400' };
  if (days <= 90) return { label: 'Idle', color: 'text-amber-600', dotColor: 'bg-amber-400' };
  return { label: 'Cold', color: 'text-red-600', dotColor: 'bg-red-400' };
}

export function getTopicHealthScore(topic: {
  updated_at: string;
  description: string | null;
  due_date: string | null;
  tags: string[];
  progress_percent: number | null;
}, itemCount: number): { score: number; label: string; color: string } {
  let score = 100;
  const daysSinceUpdate = Math.floor((Date.now() - new Date(topic.updated_at).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceUpdate > 14) score -= 30;
  else if (daysSinceUpdate > 7) score -= 15;
  if (!topic.description) score -= 10;
  if (itemCount === 0) score -= 20;
  if (topic.due_date && new Date(topic.due_date) < new Date()) score -= 25;
  if (!topic.tags || topic.tags.length === 0) score -= 5;
  if (topic.progress_percent === null) score -= 5;
  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Critical';
  const color = score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red';
  return { score, label, color };
}
