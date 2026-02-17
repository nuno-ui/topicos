'use client';
import { Mail, Calendar, FileText, MessageSquare, BookOpen, StickyNote, Link2, File, Scroll } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  gmail: Mail,
  calendar: Calendar,
  drive: FileText,
  slack: MessageSquare,
  notion: BookOpen,
  manual: StickyNote,
  link: Link2,
  document: Scroll,
};

const colorMap: Record<string, string> = {
  gmail: 'text-red-500',
  calendar: 'text-blue-500',
  drive: 'text-amber-500',
  slack: 'text-purple-500',
  notion: 'text-gray-700',
  manual: 'text-green-500',
  link: 'text-cyan-500',
  document: 'text-orange-500',
};

const labelMap: Record<string, string> = {
  gmail: 'Email',
  calendar: 'Calendar',
  drive: 'Drive',
  slack: 'Slack',
  notion: 'Notion',
  manual: 'Note',
  link: 'Link',
  document: 'Document',
};

const badgeBgMap: Record<string, string> = {
  gmail: 'bg-red-50 text-red-700 border-red-200',
  calendar: 'bg-blue-50 text-blue-700 border-blue-200',
  drive: 'bg-amber-50 text-amber-700 border-amber-200',
  slack: 'bg-purple-50 text-purple-700 border-purple-200',
  notion: 'bg-gray-50 text-gray-700 border-gray-200',
  manual: 'bg-green-50 text-green-700 border-green-200',
  link: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  document: 'bg-orange-50 text-orange-700 border-orange-200',
};

export function SourceIcon({ source, className = 'w-4 h-4' }: { source: string; className?: string }) {
  const Icon = iconMap[source] || File;
  const color = colorMap[source] || 'text-gray-400';
  return <Icon className={`${color} ${className}`} />;
}

export function SourceBadge({ source, className = '' }: { source: string; className?: string }) {
  const Icon = iconMap[source] || File;
  const label = labelMap[source] || source;
  const badgeBg = badgeBgMap[source] || 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeBg} ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export function getSourceColor(source: string) {
  return colorMap[source] || 'text-gray-400';
}

const circleBgMap: Record<string, string> = {
  gmail: 'bg-red-100',
  calendar: 'bg-blue-100',
  drive: 'bg-amber-100',
  slack: 'bg-purple-100',
  notion: 'bg-gray-100',
  manual: 'bg-green-100',
  link: 'bg-cyan-100',
  document: 'bg-orange-100',
};

/** Source icon with a colored circular background */
export function SourceIconCircle({ source, size = 'md' }: { source: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = iconMap[source] || File;
  const color = colorMap[source] || 'text-gray-400';
  const bg = circleBgMap[source] || 'bg-gray-100';
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`${iconSizes[size]} ${color}`} />
    </div>
  );
}

/** Get the left border color class for a source type */
export function getSourceBorderColor(source: string): string {
  const borders: Record<string, string> = {
    gmail: 'border-l-red-400',
    calendar: 'border-l-blue-400',
    drive: 'border-l-amber-400',
    slack: 'border-l-purple-400',
    notion: 'border-l-gray-400',
    manual: 'border-l-green-400',
    link: 'border-l-cyan-400',
    document: 'border-l-orange-400',
  };
  return borders[source] || 'border-l-gray-300';
}

/** Get the source label */
export function getSourceLabel(source: string): string {
  return labelMap[source] || source;
}
