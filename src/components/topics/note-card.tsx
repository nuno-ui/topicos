'use client';
import { useState } from 'react';
import { StickyNote, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatRelativeDate } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown';

interface TopicItem {
  id: string;
  title: string;
  snippet: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  source: string;
  [key: string]: unknown;
}

interface NoteCardProps {
  item: TopicItem;
  onEdit: (item: TopicItem) => void;
  onDelete: (itemId: string) => void;
}

export function NoteCard({ item, onEdit, onDelete }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const content = (item.metadata?.content as string) || item.snippet || '';
  const hasFullContent = content.length > 200;

  return (
    <div className="p-4 bg-white rounded-xl border border-l-4 border-gray-200 border-l-green-400 hover:border-gray-300 transition-all shadow-sm group">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <StickyNote className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Note</span>
          </div>
          <div className={`prose prose-sm max-w-none ${!expanded && hasFullContent ? 'line-clamp-3' : ''}`}>
            {renderMarkdown(expanded ? content : content.substring(0, 300))}
          </div>
          {hasFullContent && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-xs text-green-600 hover:text-green-800 mt-1.5 flex items-center gap-0.5 font-medium">
              {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
            </button>
          )}
          <p className="text-xs text-gray-400 mt-2">{formatRelativeDate(item.occurred_at)}</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(item)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit note">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(item.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete note">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
