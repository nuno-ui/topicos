'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeDate } from '@/lib/utils';
import { toast } from 'sonner';

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  area: string;
  due_date: string | null;
  updated_at: string;
  topic_items: { count: number }[];
}

export function TopicsList({ initialTopics }: { initialTopics: Topic[] }) {
  const [topics, setTopics] = useState(initialTopics);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('work');

  const handleCreate = async () => {
    if (!title.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("topics").insert({
      title: title.trim(),
      description: description.trim() || null,
      area,
      user_id: user!.id,
      status: "active",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setTopics([data, ...topics]);
    setTitle(""); setDescription(""); setShowCreate(false);
    toast.success("Topic created");
  };

  return (
    <div>
      <button onClick={() => setShowCreate(!showCreate)} className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        {showCreate ? "Cancel" : "+ New Topic"}
      </button>
      {showCreate && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Topic title" className="w-full px-3 py-2 border rounded-lg" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full px-3 py-2 border rounded-lg" rows={2} />
          <select value={area} onChange={(e) => setArea(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="work">Work</option>
            <option value="personal">Personal</option>
            <option value="project">Project</option>
          </select>
          <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Create</button>
        </div>
      )}
      <div className="grid gap-4">
        {topics.map((t) => (
          <a key={t.id} href={"/topics/" + t.id} className="p-4 bg-white rounded-lg border">
            <h3 className="font-semibold">{t.title}</h3>
            <span className="text-xs text-gray-400">{t.area}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
