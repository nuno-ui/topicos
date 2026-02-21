'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  FolderOpen,
  Folder,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Send,
  User,
  Users,
  Briefcase,
  ArrowUpRight,
  Target,
  Layers,
  Zap,
  Code,
  ChevronUp,
  StickyNote,
  Calendar,
  Inbox,
  CheckSquare,
  Square,
} from 'lucide-react';

interface ShareData {
  shareLink: {
    id: string;
    label: string | null;
    area: string;
    contact_id: string | null;
    contactName: string;
  };
  topics: Topic[];
  folders: Folder[];
  tasks: Task[];
  contactTopicIds: string[];
  contactTaskIds: string[];
  comments: Comment[];
}

interface Topic {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  status: string;
  area: string;
  folder_id: string | null;
  parent_topic_id: string | null;
  due_date: string | null;
  priority: number | null;
  owner: string | null;
  tags: string[];
  progress_percent: number | null;
  topic_tasks: { count: number }[];
}

interface Folder {
  id: string;
  name: string;
  color: string | null;
  position: number;
  parent_id: string | null;
  area: string | null;
}

interface Task {
  id: string;
  topic_id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee: string | null;
  assignee_contact_id: string | null;
  description: string;
  created_at?: string;
  source?: string | null;
}

interface Comment {
  id: string;
  author_name: string;
  body: string;
  topic_id: string | null;
  task_id: string | null;
  created_at: string;
}

// --- Color maps matching internal app ---
const areaBorderColors: Record<string, string> = {
  work: 'border-l-blue-500',
  personal: 'border-l-green-500',
  career: 'border-l-purple-500',
};

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

const folderColorMap: Record<string, string> = {
  red: 'text-red-500', blue: 'text-blue-500', green: 'text-green-500',
  purple: 'text-purple-500', amber: 'text-amber-500', gray: 'text-gray-500',
};

const folderBorderColorMap: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  purple: '#8b5cf6', amber: '#f59e0b', gray: '#6b7280',
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [commentName, setCommentName] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments'>('overview');
  const [topicNoteBody, setTopicNoteBody] = useState<Record<string, string>>({});
  const [topicNoteSubmitting, setTopicNoteSubmitting] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [devSectionOpen, setDevSectionOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/share/${token}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to load');
        return;
      }
      const json = await res.json();
      setData(json);

      // Auto-expand folders that have topics
      const foldersWithTopics = new Set<string>();
      (json.topics || []).forEach((t: Topic) => {
        if (t.folder_id) foldersWithTopics.add(t.folder_id);
      });
      setExpandedFolders(foldersWithTopics);
    } catch {
      setError('Failed to load share data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleTopic = (id: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submitComment = async () => {
    if (!commentName.trim() || !commentBody.trim() || !data) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/share/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_name: commentName.trim(), body: commentBody.trim() }),
      });
      if (res.ok) {
        const { comment } = await res.json();
        setData(prev => prev ? { ...prev, comments: [...prev.comments, comment] } : prev);
        setCommentBody('');
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const submitTopicNote = async (topicId: string) => {
    const body = topicNoteBody[topicId]?.trim();
    if (!commentName.trim() || !body || !data) return;
    setTopicNoteSubmitting(topicId);
    try {
      const res = await fetch(`/api/public/share/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_name: commentName.trim(), body, topic_id: topicId }),
      });
      if (res.ok) {
        const { comment } = await res.json();
        setData(prev => prev ? { ...prev, comments: [...prev.comments, comment] } : prev);
        setTopicNoteBody(prev => ({ ...prev, [topicId]: '' }));
      }
    } catch { /* ignore */ }
    setTopicNoteSubmitting(null);
  };

  const toggleNotes = (topicId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId); else next.add(topicId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Not Available</h1>
          <p className="text-gray-500">{error || 'This share link is not valid.'}</p>
        </div>
      </div>
    );
  }

  const { topics, folders, tasks, contactTopicIds, contactTaskIds, shareLink, comments } = data;
  const hasContactView = shareLink.contact_id && contactTopicIds.length > 0;

  // Group comments by topic
  const commentsByTopic: Record<string, Comment[]> = {};
  const generalComments: Comment[] = [];
  comments.forEach(c => {
    if (c.topic_id) {
      if (!commentsByTopic[c.topic_id]) commentsByTopic[c.topic_id] = [];
      commentsByTopic[c.topic_id].push(c);
    } else {
      generalComments.push(c);
    }
  });

  // Group tasks by topic
  const tasksByTopic: Record<string, Task[]> = {};
  tasks.forEach(t => {
    if (!tasksByTopic[t.topic_id]) tasksByTopic[t.topic_id] = [];
    tasksByTopic[t.topic_id].push(t);
  });

  // Group topics by folder
  const topicsByFolder: Record<string, Topic[]> = {};
  const unfolderedTopics: Topic[] = [];
  topics.forEach(t => {
    if (!t.parent_topic_id) {
      if (t.folder_id) {
        if (!topicsByFolder[t.folder_id]) topicsByFolder[t.folder_id] = [];
        topicsByFolder[t.folder_id].push(t);
      } else {
        unfolderedTopics.push(t);
      }
    }
  });

  // Sub-topics
  const childTopics: Record<string, Topic[]> = {};
  topics.forEach(t => {
    if (t.parent_topic_id) {
      if (!childTopics[t.parent_topic_id]) childTopics[t.parent_topic_id] = [];
      childTopics[t.parent_topic_id].push(t);
    }
  });

  // Build folder tree
  const rootFolders = folders.filter(f => !f.parent_id).sort((a, b) => a.position - b.position);
  const childFoldersMap: Record<string, Folder[]> = {};
  folders.forEach(f => {
    if (f.parent_id) {
      if (!childFoldersMap[f.parent_id]) childFoldersMap[f.parent_id] = [];
      childFoldersMap[f.parent_id].push(f);
    }
  });

  // Contact-specific topics
  const contactRelevantTopics = topics.filter(t => contactTopicIds.includes(t.id));
  const contactAssignedTasks = tasks.filter(t => contactTaskIds.includes(t.id));

  // --- Render task row matching internal tasks view ---
  const renderTask = (task: Task, isContactTask: boolean = false) => {
    const isCompleted = task.status === 'completed';
    const dotColor = task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-green-400';
    const statusBadge = task.status === 'in_progress'
      ? <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">In Progress</span>
      : task.status === 'completed'
      ? <span className="text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Done</span>
      : null;

    return (
      <div
        key={task.id}
        className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-amber-50/40 transition-colors ${
          isCompleted ? 'opacity-50' : ''
        } ${isContactTask ? 'bg-teal-50/50 border border-teal-100' : ''}`}
      >
        {/* Status icon */}
        <span className="flex-shrink-0">
          {isCompleted ? <CheckSquare className="w-3.5 h-3.5 text-green-500" /> : <Square className="w-3.5 h-3.5 text-gray-300" />}
        </span>
        {/* Priority dot */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
        {/* Task title */}
        <span className={`text-xs flex-1 min-w-0 truncate ${isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
          {task.title}
        </span>
        {/* Status badge */}
        {statusBadge}
        {/* Contact badge */}
        {isContactTask && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-600 font-medium">assigned</span>
        )}
        {/* Assignee */}
        {task.assignee && (
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
            <Users className="w-2.5 h-2.5" /> {task.assignee}
          </span>
        )}
        {/* Due date */}
        {task.due_date && (
          <span className={`text-[10px] flex items-center gap-0.5 flex-shrink-0 ${
            new Date(task.due_date) < new Date() && !isCompleted ? 'text-red-500 font-semibold' : 'text-gray-400'
          }`}>
            <Calendar className="w-2.5 h-2.5" /> {formatRelativeDate(task.due_date)}
          </span>
        )}
        {/* AI badge */}
        {task.source === 'ai_extracted' && (
          <span className="text-[8px] text-purple-500 bg-purple-50 px-1 rounded flex-shrink-0">AI</span>
        )}
      </div>
    );
  };

  // --- Render topic card + inline tasks (matching internal tasks view) ---
  const renderTopicWithTasks = (topic: Topic, depth: number = 0) => {
    const topicTasks = tasksByTopic[topic.id] || [];
    const activeTasks = topicTasks.filter(t => t.status !== 'archived');
    const children = childTopics[topic.id] || [];
    const isExpanded = expandedTopics.has(topic.id);
    const isContactTopic = contactTopicIds.includes(topic.id);
    const areaColor = areaBorderColors[topic.area] || 'border-l-gray-300';
    const hasExpandableContent = activeTasks.length > 0 || children.length > 0;

    return (
      <div key={topic.id}>
        {/* Topic card */}
        <div
          className={`block px-3 py-2.5 bg-white rounded-xl border border-gray-100 border-l-[3px] ${areaColor} hover:border-blue-200 hover:shadow-sm transition-all shadow-sm cursor-pointer ${
            isContactTopic ? 'ring-1 ring-teal-200' : ''
          }`}
          onClick={() => toggleTopic(topic.id)}
        >
          {/* Row 1: Title */}
          <div className="flex items-center gap-2">
            {hasExpandableContent ? (
              isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            ) : (
              <div className="w-3.5" />
            )}
            <span className="font-semibold text-sm text-gray-900 flex-1 min-w-0 truncate">{topic.title}</span>
            {topic.status && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[topic.status] || 'bg-gray-100 text-gray-600'}`}>{topic.status}</span>
            )}
            {topic.area && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${areaColors[topic.area] || 'bg-gray-100 text-gray-600'}`}>{topic.area}</span>
            )}
            {topic.owner && (
              <span className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <User className="w-3 h-3" />{topic.owner}
              </span>
            )}
          </div>
          {/* Row 2: Meta */}
          <div className="flex items-center gap-2 mt-1 ml-5.5">
            {topic.due_date && (
              <span className={`text-[10px] flex items-center gap-0.5 ${
                new Date(topic.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'
              }`}>
                <Clock className="w-3 h-3" /> Due {formatRelativeDate(topic.due_date)}
              </span>
            )}
            {topic.tags?.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
            ))}
            {activeTasks.length > 0 && (
              <span className="text-[10px] text-gray-400 ml-auto">
                {activeTasks.filter(t => t.status === 'completed').length}/{activeTasks.length} tasks
              </span>
            )}
          </div>
          {/* Description */}
          {topic.description && (
            <p className="text-xs text-gray-500 mt-1 ml-5.5 line-clamp-1">{topic.description}</p>
          )}
        </div>

        {/* Inline tasks (expanded) */}
        {isExpanded && activeTasks.length > 0 && (
          <div className="ml-6 mb-2 pl-3 border-l-2 border-amber-100 space-y-0">
            {activeTasks.map(task => renderTask(task, contactTaskIds.includes(task.id)))}
            {/* Goal */}
            {topic.goal && (
              <>
                <div className="flex items-center gap-2 px-2 py-0.5">
                  <div className="w-3.5 flex justify-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                      <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                      <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-50/60 border border-dashed border-blue-200">
                  <Target className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-blue-700 flex-1 min-w-0 truncate">Goal: {topic.goal}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Children topics */}
        {isExpanded && children.length > 0 && (
          <div className="ml-5 pl-3 border-l-2 border-indigo-100 space-y-1.5 mt-1">
            {children.map(child => renderTopicWithTasks(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // --- Render folder node with hierarchy ---
  const renderFolderNode = (folder: Folder, depth: number = 0) => {
    const folderTopics = topicsByFolder[folder.id] || [];
    const childFolders = childFoldersMap[folder.id] || [];
    const isExpanded = expandedFolders.has(folder.id);
    const totalTopics = folderTopics.length + childFolders.reduce((sum, cf) => sum + (topicsByFolder[cf.id]?.length || 0), 0);
    const folderColor = folder.color ? (folderColorMap[folder.color] || 'text-amber-500') : 'text-amber-500';

    if (totalTopics === 0 && childFolders.length === 0) return null;

    return (
      <div key={folder.id} className="mb-0.5">
        <div
          className={`flex items-center gap-1.5 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${folder.color ? 'border-l-2' : ''}`}
          style={{
            marginLeft: `${depth * 20}px`,
            ...(folder.color ? { borderLeftColor: folderBorderColorMap[folder.color] || undefined } : {}),
          }}
          onClick={() => toggleFolder(folder.id)}
        >
          <span className={`block transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </span>
          {isExpanded
            ? <FolderOpen className={`w-4 h-4 ${folderColor} flex-shrink-0`} />
            : <Folder className={`w-4 h-4 ${folderColor} flex-shrink-0`} />
          }
          <span className="text-sm font-medium text-gray-700 flex-1">{folder.name}</span>
          <span className={`text-[10px] font-semibold min-w-[20px] text-center px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            totalTopics > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-300'
          }`}>
            {totalTopics}
          </span>
        </div>
        <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="relative" style={{ marginLeft: `${depth * 20 + 10}px` }}>
            {/* Child folders */}
            {childFolders.map(cf => renderFolderNode(cf, depth + 1))}
            {/* Topics */}
            <div className="space-y-1.5 mt-1 mb-2 ml-3">
              {folderTopics.map(t => renderTopicWithTasks(t))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- Notes section renderer (shared between overview + assignments) ---
  const renderTopicNotes = (topicId: string) => {
    const topicComments = commentsByTopic[topicId] || [];
    const isNotesExpanded = expandedNotes.has(topicId);

    return (
      <div className="mt-3 pt-2 border-t border-gray-100">
        <button
          onClick={() => toggleNotes(topicId)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <StickyNote className="w-3.5 h-3.5" />
          Notes {topicComments.length > 0 && `(${topicComments.length})`}
          {isNotesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {isNotesExpanded && (
          <div className="mt-2 space-y-2">
            {topicComments.length > 0 && (
              <div className="space-y-2">
                {topicComments.map(note => (
                  <div key={note.id} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-800">{note.author_name}</span>
                      <span className="text-[10px] text-gray-400">{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{note.body}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={topicNoteBody[topicId] || ''}
                onChange={e => setTopicNoteBody(prev => ({ ...prev, [topicId]: e.target.value }))}
                placeholder={commentName.trim() ? 'Add a note...' : 'Set your name first, then add a note...'}
                rows={2}
                className="flex-1 px-2 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitTopicNote(topicId);
                }}
              />
              <button
                onClick={() => submitTopicNote(topicId)}
                disabled={topicNoteSubmitting === topicId || !commentName.trim() || !topicNoteBody[topicId]?.trim()}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                {topicNoteSubmitting === topicId ? '...' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {shareLink.label || `${shareLink.area?.charAt(0).toUpperCase()}${shareLink.area?.slice(1)} Topics`}
              </h1>
              <p className="text-sm text-gray-500">
                Shared with {shareLink.contactName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      {hasContactView && (
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 flex gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              All Topics
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'assignments'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Your Assignments
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === 'assignments' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {contactAssignedTasks.length}
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ========== Overview Tab ========== */}
        {activeTab === 'overview' && (
          <div>
            {/* Folder hierarchy */}
            {rootFolders.map(f => renderFolderNode(f))}

            {/* Unfiled topics */}
            {unfolderedTopics.length > 0 && (
              <div className={rootFolders.length > 0 ? 'mt-6' : ''}>
                {rootFolders.length > 0 && (
                  <div className="border-t border-gray-200 pt-4 mb-3">
                    <div className="flex items-center gap-2 px-2">
                      <Inbox className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">Topics without a folder</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{unfolderedTopics.length}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  {unfolderedTopics.map(t => renderTopicWithTasks(t))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== Assignments Tab ========== */}
        {activeTab === 'assignments' && hasContactView && (
          <div className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <h2 className="font-semibold text-teal-800 flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-5 h-5" />
                Topics & Tasks for {shareLink.contactName}
              </h2>
              <p className="text-sm text-teal-600">
                {contactAssignedTasks.length} task{contactAssignedTasks.length !== 1 ? 's' : ''} assigned across {contactRelevantTopics.length} topic{contactRelevantTopics.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Cross-topic Shared Next Steps */}
            {(() => {
              const taskTitleMap: Record<string, Array<{ task: Task; topicId: string; topicTitle: string }>> = {};
              for (const ct of contactRelevantTopics) {
                const topicTasks = tasksByTopic[ct.id] || [];
                const assigned = topicTasks.filter(t => contactTaskIds.includes(t.id));
                for (const task of assigned) {
                  if (task.status === 'completed') continue;
                  const key = task.title.trim().toLowerCase();
                  if (!taskTitleMap[key]) taskTitleMap[key] = [];
                  taskTitleMap[key].push({ task, topicId: ct.id, topicTitle: ct.title });
                }
              }
              const sharedTasks = Object.entries(taskTitleMap)
                .filter(([, entries]) => new Set(entries.map(e => e.topicId)).size >= 2)
                .map(([, entries]) => ({
                  title: entries[0].task.title,
                  priority: entries[0].task.priority,
                  due_date: entries[0].task.due_date,
                  topics: [...new Set(entries.map(e => e.topicTitle))],
                }));
              if (sharedTasks.length === 0) return null;
              return (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-indigo-800 flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4" />
                    Shared Next Steps
                    <span className="text-xs font-normal text-indigo-600">Tasks spanning multiple topics</span>
                  </h3>
                  <div className="space-y-1.5">
                    {sharedTasks.map((st, i) => (
                      <div key={i} className="flex items-start gap-2 py-1.5 px-2 bg-white rounded-lg border border-indigo-100">
                        <Zap className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-800">{st.title}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {st.topics.map(topicTitle => (
                              <span key={topicTitle} className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">{topicTitle}</span>
                            ))}
                          </div>
                        </div>
                        {st.priority === 'high' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">HIGH</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Per-topic cards with dedup badges, notes, and goals */}
            {(() => {
              const _titleCount: Record<string, Set<string>> = {};
              for (const ct of contactRelevantTopics) {
                for (const task of (tasksByTopic[ct.id] || []).filter(t => contactTaskIds.includes(t.id))) {
                  if (task.status === 'completed') continue;
                  const key = task.title.trim().toLowerCase();
                  if (!_titleCount[key]) _titleCount[key] = new Set();
                  _titleCount[key].add(ct.id);
                }
              }
              const sharedTaskTitles = new Set(Object.entries(_titleCount).filter(([, s]) => s.size >= 2).map(([k]) => k));

              return contactRelevantTopics.map(topic => {
                const topicTasks = tasksByTopic[topic.id] || [];
                const assignedToContact = topicTasks.filter(t => contactTaskIds.includes(t.id));
                const otherTasks = topicTasks.filter(t => !contactTaskIds.includes(t.id) && t.status !== 'archived');
                const areaColor = areaBorderColors[topic.area] || 'border-l-gray-300';

                return (
                  <div key={topic.id} className={`bg-white rounded-xl shadow-sm border border-l-[3px] ${areaColor} overflow-hidden`}>
                    {/* Topic header */}
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 flex-1">{topic.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[topic.status] || 'bg-gray-100 text-gray-600'}`}>{topic.status}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${areaColors[topic.area] || 'bg-gray-100 text-gray-600'}`}>{topic.area}</span>
                        {topic.owner && (
                          <span className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <User className="w-3 h-3" />{topic.owner}
                          </span>
                        )}
                      </div>
                      {topic.due_date && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span className={new Date(topic.due_date) < new Date() ? 'text-red-500 font-medium' : ''}>Due {formatRelativeDate(topic.due_date)}</span>
                        </div>
                      )}
                      {topic.description && (
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{topic.description}</p>
                      )}
                    </div>

                    {/* Tasks section */}
                    {(assignedToContact.length > 0 || otherTasks.length > 0) && (
                      <div className="border-t border-gray-100 px-4 py-2 space-y-0">
                        {/* Assigned tasks */}
                        {assignedToContact.length > 0 && (
                          <div className="mb-1">
                            <div className="text-[10px] font-semibold text-teal-600 mb-0.5 uppercase tracking-wider">Your tasks</div>
                            {assignedToContact.map(task => {
                              const isCompleted = task.status === 'completed';
                              const dotColor = task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-green-400';
                              const stBadge = task.status === 'in_progress'
                                ? <span className="text-[9px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">In Progress</span>
                                : task.status === 'completed'
                                ? <span className="text-[9px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Done</span>
                                : null;
                              return (
                                <div key={task.id} className={`flex items-center gap-2 py-1 bg-teal-50/50 -mx-1 px-1 rounded ${isCompleted ? 'opacity-50' : ''}`}>
                                  <span className="flex-shrink-0">
                                    {isCompleted ? <CheckSquare className="w-3.5 h-3.5 text-teal-500" /> : <Square className="w-3.5 h-3.5 text-gray-300" />}
                                  </span>
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                                  <span className={`text-xs flex-1 min-w-0 truncate ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {task.title}
                                  </span>
                                  {stBadge}
                                  {task.priority === 'high' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">HIGH</span>}
                                  {task.due_date && (
                                    <span className={`text-[10px] flex items-center gap-0.5 flex-shrink-0 ${
                                      new Date(task.due_date) < new Date() && !isCompleted ? 'text-red-500 font-medium' : 'text-gray-400'
                                    }`}>
                                      <Calendar className="w-2.5 h-2.5" /> {formatRelativeDate(task.due_date)}
                                    </span>
                                  )}
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-600 font-medium">assigned</span>
                                  {sharedTaskTitles.has(task.title.trim().toLowerCase()) && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium flex items-center gap-0.5">
                                      <Layers className="w-2.5 h-2.5" /> shared
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Other tasks */}
                        {otherTasks.length > 0 && (
                          <div className="pt-1 border-t border-gray-100/50">
                            <div className="text-[10px] font-semibold text-gray-400 mb-0.5 uppercase tracking-wider">Other tasks</div>
                            {otherTasks.slice(0, 5).map(task => (
                              <div key={task.id} className="flex items-center gap-2 py-0.5 opacity-50">
                                <Square className="w-3 h-3 text-gray-300 flex-shrink-0" />
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-green-400'}`} />
                                <span className="text-xs text-gray-500 flex-1 truncate">{task.title}</span>
                                {task.assignee && <span className="text-[9px] text-gray-400">{task.assignee}</span>}
                              </div>
                            ))}
                            {otherTasks.length > 5 && (
                              <span className="text-[10px] text-gray-400 pl-5">+{otherTasks.length - 5} more tasks</span>
                            )}
                          </div>
                        )}

                        {/* Goal */}
                        {topic.goal && (
                          <div className="pt-1.5 mt-1 border-t border-blue-100/50">
                            <div className="flex items-center gap-0.5 justify-center mb-1">
                              <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                              <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                              <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-50/60 border border-dashed border-blue-200">
                              <Target className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                              <span className="text-xs font-medium text-blue-700 flex-1 min-w-0 truncate">Goal: {topic.goal}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* No tasks fallback with goal */}
                    {assignedToContact.length === 0 && otherTasks.length === 0 && (
                      <div className="border-t border-gray-100 px-4 py-2">
                        <span className="text-xs text-gray-400 italic">No active tasks</span>
                        {topic.goal && (
                          <div className="flex items-center gap-2 px-2 py-1.5 mt-1 rounded-lg bg-blue-50/60 border border-dashed border-blue-200">
                            <Target className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-blue-700 flex-1 min-w-0 truncate">Goal: {topic.goal}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Per-topic Notes */}
                    <div className="px-4 pb-3">
                      {renderTopicNotes(topic.id)}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Your Name (shared across notes + comments) */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Your name (used for notes & comments)</label>
          <input
            type="text"
            value={commentName}
            onChange={e => setCommentName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* General Comments Section */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            General Comments
            {generalComments.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{generalComments.length}</span>
            )}
          </h2>

          {generalComments.length > 0 && (
            <div className="space-y-3 mb-4">
              {generalComments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm text-gray-900">{comment.author_name}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={generalComments.length > 0 ? 'border-t pt-4' : ''}>
            <div className="flex gap-2">
              <textarea
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder={commentName.trim() ? 'Leave a general comment...' : 'Set your name above first...'}
                rows={2}
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment();
                }}
              />
              <button
                onClick={submitComment}
                disabled={submitting || !commentName.trim() || !commentBody.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-end flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Developer / API Connection Details */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <button
            onClick={() => setDevSectionOpen(!devSectionOpen)}
            className="w-full flex items-center gap-2 p-4 hover:bg-gray-50 transition-colors"
          >
            <Code className="w-5 h-5 text-gray-400" />
            <span className="font-semibold text-gray-900">Developer &amp; API Access</span>
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full ml-1">Beta</span>
            {devSectionOpen ? <ChevronUp className="w-4 h-4 text-gray-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />}
          </button>
          {devSectionOpen && (
            <div className="px-4 pb-4 space-y-4 border-t">
              <p className="text-sm text-gray-500 pt-3">
                Connect your own tools to this shared workspace. Use the REST API or connect directly to Supabase.
              </p>

              {/* REST API */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">REST API Endpoints</h3>
                <div className="space-y-2">
                  <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs">
                    <div className="text-green-600 font-semibold mb-1">GET</div>
                    <div className="text-gray-700 break-all">/api/public/share/{token}</div>
                    <div className="text-gray-500 mt-1 font-sans">Fetch all topics, tasks, folders, and comments for this share link.</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs">
                    <div className="text-amber-600 font-semibold mb-1">POST</div>
                    <div className="text-gray-700 break-all">/api/public/share/{token}/comments</div>
                    <div className="text-gray-500 mt-1 font-sans">Post a comment or topic note.</div>
                    <pre className="mt-2 text-[10px] text-gray-600 overflow-x-auto">{`{
  "author_name": "Your Name",
  "body": "Comment text",
  "topic_id": "optional-topic-uuid"
}`}</pre>
                  </div>
                </div>
                <div className="mt-2">
                  <h4 className="text-xs font-medium text-gray-600 mb-1">Example (fetch):</h4>
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-[10px] overflow-x-auto">{`const res = await fetch(
  '${typeof window !== 'undefined' ? window.location.origin : ''}/api/public/share/${token}'
);
const data = await res.json();
console.log(data.topics, data.tasks);`}</pre>
                </div>
              </div>

              {/* Supabase Direct */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Supabase Direct Connection</h3>
                <p className="text-xs text-gray-500 mb-2">
                  Connect directly to the database (read-only via RLS). Great for building dashboards or AI integrations.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 w-24 flex-shrink-0">Project URL:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 break-all select-all">https://tgxkcapqesnqsdivsfgi.supabase.co</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 w-24 flex-shrink-0">Anon Key:</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 break-all select-all">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRneGtjYXBxZXNucXNkaXZzZmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDA5MzYsImV4cCI6MjA4NjU3NjkzNn0.aX3ABXV65RoVWNmOgZ1CdOgE-dLKRdSnWghtB0V-VEY</code>
                  </div>
                </div>
                <div className="mt-2">
                  <h4 className="text-xs font-medium text-gray-600 mb-1">Example (supabase-js):</h4>
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-[10px] overflow-x-auto">{`import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tgxkcapqesnqsdivsfgi.supabase.co',
  '<anon-key>'
);

// Read topics (public read via share_links RLS)
const { data } = await supabase
  .from('share_links')
  .select('*')
  .eq('token', '${token}');`}</pre>
                </div>
              </div>

              {/* Schema Reference */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Key Tables</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { name: 'topics', cols: 'id, title, description, goal, status, area, folder_id, due_date, priority, owner, tags' },
                    { name: 'topic_tasks', cols: 'id, topic_id, title, status, priority, due_date, assignee, assignee_contact_id, position' },
                    { name: 'share_comments', cols: 'id, share_link_id, author_name, body, topic_id, task_id, created_at' },
                    { name: 'contacts', cols: 'id, user_id, name, email, organization, role' },
                  ].map(table => (
                    <div key={table.name} className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs font-semibold text-purple-700 font-mono">{table.name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{table.cols}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-4">
          Powered by YouOS
        </div>
      </div>
    </div>
  );
}
