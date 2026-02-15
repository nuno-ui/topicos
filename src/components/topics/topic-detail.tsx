'use client';
import { useState } from 'react';
import { sourceIcon, sourceLabel, formatRelativeDate } from '@/lib/utils';
import Link from 'next/link';

interface TopicItem {
  id: string; topic_id: string; source: string;
  external_id: string; title: string; snippet: string;
  url: string; occurred_at: string; metadata: Record<string, unknown>;
}
interface Topic {
  id: string; title: string; description: string | null;
  status: string; area: string; due_date: string | null;
}

export function TopicDetail({ topic, initialItems }: { topic: Topic; initialItems: TopicItem[] }) {
  const [items] = useState(initialItems);

  return (
    <div>
      <div className="mb-6">
        <Link href="/topics" className="text-sm text-blue-600 hover:underline">← Back to Topics</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{topic.title}</h1>
        {topic.description && <p className="text-gray-500 mt-1">{topic.description}</p>}
        <div className="flex gap-2 mt-2">
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{topic.area}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{topic.status}</span>
        </div>
      </div>
      <h2 className="text-lg font-semibold mb-4">Linked Items ({items.length})</h2>
      {items.length === 0 && <p className="text-gray-500 py-8 text-center">No items linked yet. Use Search to find and link items.</p>}
      <div className="space-y-2">
        {items.map((item) => (
          <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
            className="block p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300">
            <div className="flex items-start gap-2">
              <span>{sourceIcon(item.source)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.title}</p>
                <p className="text-sm text-gray-500 truncate">{item.snippet}</p>
                <div className="flex gap-2 mt-1 text-xs text-gray-400">
                  <span>{sourceLabel(item.source)}</span>
                  <span>{formatRelativeDate(item.occurred_at)}</span>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
