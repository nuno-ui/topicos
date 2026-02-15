'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { X, Save, StickyNote, Loader2 } from 'lucide-react';

interface TopicItem {
  id: string;
  topic_id: string;
  source: string;
  title: string;
  snippet: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  [key: string]: unknown;
}

interface NoteEditorProps {
  topicId: string;
  note?: TopicItem;
  onSave: (item: TopicItem) => void;
  onClose: () => void;
}

export function NoteEditor({ topicId, note, onSave, onClose }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(
    (note?.metadata?.content as string) || note?.snippet || ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      if (note) {
        // Edit existing note
        const res = await fetch(`/api/topics/${topicId}/items/${note.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            snippet: content.substring(0, 300),
            metadata: { ...note.metadata, content: content, updated_at: new Date().toISOString() },
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
        const data = await res.json();
        onSave(data.item);
        toast.success('Note updated');
      } else {
        // Create new note
        const res = await fetch(`/api/topics/${topicId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_id: `note_${crypto.randomUUID()}`,
            source: 'manual',
            source_account_id: null,
            title: title.trim(),
            snippet: content.substring(0, 300),
            url: '',
            occurred_at: new Date().toISOString(),
            metadata: { content: content, user_entered: true, content_type: 'note' },
            linked_by: 'user',
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Create failed');
        const data = await res.json();
        onSave(data.item);
        toast.success('Note created');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save note');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-green-600" />
            {note ? 'Edit Note' : 'Add Note'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Content <span className="text-gray-400 font-normal">(supports basic markdown: # headers, - lists, **bold**)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={8}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y min-h-[200px] font-mono text-[13px] leading-relaxed"
            />
          </div>
        </div>
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <p className="text-xs text-gray-400">Notes are included in AI analysis</p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !title.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {note ? 'Update' : 'Save Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
