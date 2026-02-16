'use client';
import { Mail, Calendar, FileText, MessageSquare, BookOpen, StickyNote, Link2, File } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  gmail: Mail,
  calendar: Calendar,
  drive: FileText,
  slack: MessageSquare,
  notion: BookOpen,
  manual: StickyNote,
  link: Link2,
};

const colorMap: Record<string, string> = {
  gmail: 'text-red-500',
  calendar: 'text-blue-500',
  drive: 'text-amber-500',
  slack: 'text-purple-500',
  notion: 'text-gray-700',
  manual: 'text-green-500',
  link: 'text-cyan-500',
};

export function SourceIcon({ source, className = 'w-4 h-4' }: { source: string; className?: string }) {
  const Icon = iconMap[source] || File;
  const color = colorMap[source] || 'text-gray-400';
  return <Icon className={`${color} ${className}`} />;
}

export function getSourceColor(source: string) {
  return colorMap[source] || 'text-gray-400';
}
