'use client';
import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Filter, X } from 'lucide-react';

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  area: string;
  priority: number;
  due_date: string | null;
  updated_at: string;
  urgency_score: number | null;
  tags: string[];
  topic_items: { count: number }[];
}

export function TopicsList({ initialTopics }: { initialTopics: Topic[] }) {
  const [topics, setTopics] = useState(initialTopics);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('work');

  // Filters
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [sortBy, setSortBy] = useState<string>('updated_at');
  const [showFilters, setShowFilters] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('topics').insert({
      title: title.trim(),
      description: description.trim() || null,
      area,
      user_id: user!.id,
      status: 'active',
    }).select('*, topic_items(count)').single();
    if (error) { toast.error(error.message); return; }
    setTopics([data, ...topics]);
    setTitle(''); setDescription(''); setShowCreate(false);
    toast.success('Topic created');
  };

  // Filtered and sorted topics
  const filteredTopics = useMemo(() => {
    let result = [...topics];

    if (filterArea !== 'all') {
      result = result.filter(t => t.area === filterArea);
    }
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'updated_at':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'priority':
          return (b.priority || 0) - (a.priority || 0);
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'items':
          return (b.topic_items?.[0]?.count || 0) - (a.topic_items?.[0]?.count || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [topics, filterArea, filterStatus, sortBy]);

  const areaColors: Record<string, string> = {
    work: 'bg-blue-100 text-blue-700',
    personal: 'bg-green-100 text-green-700',
    career: 'bg-purple-100 text-purple-700',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-gray-100 text-gray-600',
    archived: 'bg-amber-100 text-amber-700',
  };

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreate ? 'Cancel' : 'New Topic'}
          </button>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
              showFilters ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
        <span className="text-sm text-gray-500">{filteredTopics.length} topic{filteredTopics.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 flex gap-4 flex-wrap items-center">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Area</label>
            <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm">
              <option value="all">All Areas</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="career">Career</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sort by</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm">
              <option value="updated_at">Last Updated</option>
              <option value="priority">Priority</option>
              <option value="due_date">Due Date</option>
              <option value="items">Item Count</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Topic title"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={2}
          />
          <div className="flex gap-3 items-center">
            <select value={area} onChange={(e) => setArea(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="career">Career</option>
            </select>
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Create Topic
            </button>
          </div>
        </div>
      )}

      {/* Topic cards */}
      {filteredTopics.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No topics found</p>
          <button onClick={() => setShowCreate(true)}
            className="mt-3 text-blue-600 hover:underline text-sm">Create your first topic &rarr;</button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredTopics.map((t) => {
            const itemCount = t.topic_items?.[0]?.count || 0;
            return (
              <a key={t.id} href={`/topics/${t.id}`}
                className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all block">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status] || 'bg-gray-100 text-gray-600'}`}>
                        {t.status}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">{t.description}</p>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap items-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${areaColors[t.area] || 'bg-gray-100 text-gray-600'}`}>
                        {t.area}
                      </span>
                      {t.due_date && (
                        <span className="text-xs text-gray-400">
                          Due: {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {itemCount > 0 && (
                        <span className="text-xs text-gray-400">
                          {itemCount} item{itemCount !== 1 ? 's' : ''} linked
                        </span>
                      )}
                      <span className="text-xs text-gray-300">&bull;</span>
                      <span className="text-xs text-gray-400">{formatRelativeDate(t.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
