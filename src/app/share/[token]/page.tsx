'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  FolderOpen,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Send,
  User,
  Briefcase,
  ArrowUpRight,
  Target,
  Layers,
  Zap,
  Code,
  ChevronUp,
  StickyNote,
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
}

interface Comment {
  id: string;
  author_name: string;
  body: string;
  topic_id: string | null;
  task_id: string | null;
  created_at: string;
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
    case 'archived': return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    default: return <Circle className="w-4 h-4 text-gray-400" />;
  }
};

const priorityBadge = (priority: string) => {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[priority] || colors.medium}`}>
      {priority}
    </span>
  );
};

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

  const renderTask = (task: Task, isContactTask: boolean = false) => (
    <div
      key={task.id}
      className={`flex items-start gap-2 py-1.5 px-2 rounded text-sm ${
        isContactTask ? 'bg-teal-50 border border-teal-100' : ''
      }`}
    >
      {statusIcon(task.status)}
      <span className={task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}>
        {task.title}
      </span>
      {task.priority === 'high' && priorityBadge('high')}
      {task.due_date && (
        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
          {new Date(task.due_date).toLocaleDateString()}
        </span>
      )}
      {task.assignee && (
        <span className="text-xs text-gray-400 flex items-center gap-0.5">
          <User className="w-3 h-3" />{task.assignee}
        </span>
      )}
    </div>
  );

  const renderTopic = (topic: Topic, indent: number = 0) => {
    const topicTasks = tasksByTopic[topic.id] || [];
    const activeTasks = topicTasks.filter(t => t.status !== 'archived');
    const completedCount = activeTasks.filter(t => t.status === 'completed').length;
    const children = childTopics[topic.id] || [];
    const isExpanded = expandedTopics.has(topic.id);
    const isContactTopic = contactTopicIds.includes(topic.id);

    return (
      <div key={topic.id} className={`${indent > 0 ? 'ml-4' : ''}`}>
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
            isContactTopic ? 'border-l-2 border-teal-400' : ''
          }`}
          onClick={() => toggleTopic(topic.id)}
        >
          {(activeTasks.length > 0 || children.length > 0) ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <div className="w-4" />
          )}
          <span className="font-medium text-gray-900 text-sm">{topic.title}</span>
          {topic.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          {topic.owner && (
            <span className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <User className="w-3 h-3" />{topic.owner}
            </span>
          )}
          {topic.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
          ))}
          {activeTasks.length > 0 && (
            <span className="text-xs text-gray-400 ml-auto">
              {completedCount}/{activeTasks.length} tasks
            </span>
          )}
          {topic.due_date && (
            <span className="text-xs text-gray-400">{new Date(topic.due_date).toLocaleDateString()}</span>
          )}
        </div>
        {/* Description below title */}
        {topic.description && (
          <p className="text-xs text-gray-500 px-3 pb-1 line-clamp-2">{topic.description}</p>
        )}
        {isExpanded && (
          <div className="ml-6 mb-2">
            {activeTasks.map(task => renderTask(task, contactTaskIds.includes(task.id)))}
            {/* Goal as final destination */}
            {topic.goal && activeTasks.length > 0 && (
              <>
                <div className="flex justify-center py-0.5">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                    <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                    <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                  </div>
                </div>
                <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-blue-50 border border-dashed border-blue-200">
                  <Target className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-blue-700">Goal: {topic.goal}</span>
                </div>
              </>
            )}
            {children.map(child => renderTopic(child, indent + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderFolder = (folder: Folder) => {
    const folderTopics = topicsByFolder[folder.id] || [];
    if (folderTopics.length === 0) return null;
    const isExpanded = expandedFolders.has(folder.id);

    return (
      <div key={folder.id} className="mb-3">
        <div
          className="flex items-center gap-2 py-2 px-3 bg-white rounded-lg shadow-sm border cursor-pointer hover:border-gray-300 transition-colors"
          onClick={() => toggleFolder(folder.id)}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <FolderOpen className="w-4 h-4" style={{ color: folder.color || '#6B7280' }} />
          <span className="font-semibold text-gray-800 text-sm">{folder.name}</span>
          <span className="text-xs text-gray-400 ml-auto">{folderTopics.length} topics</span>
        </div>
        {isExpanded && (
          <div className="mt-1 ml-2 space-y-0.5">
            {folderTopics.map(t => renderTopic(t))}
          </div>
        )}
      </div>
    );
  };

  // Contact-specific topics
  const contactRelevantTopics = topics.filter(t => contactTopicIds.includes(t.id));
  const contactAssignedTasks = tasks.filter(t => contactTaskIds.includes(t.id));

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
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {folders.map(f => renderFolder(f))}
            {unfolderedTopics.length > 0 && (
              <div>
                {unfolderedTopics.length > 0 && folders.length > 0 && (
                  <div className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2 px-3">
                    Unfiled
                  </div>
                )}
                <div className="space-y-0.5">
                  {unfolderedTopics.map(t => renderTopic(t))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assignments Tab */}
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
              // Compute shared task titles for badge display
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
                const topicComments = commentsByTopic[topic.id] || [];
                const isNotesExpanded = expandedNotes.has(topic.id);

                return (
                  <div key={topic.id} className="bg-white rounded-xl shadow-sm border p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{topic.title}</span>
                      {topic.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {topic.due_date && (
                        <span className="text-xs text-gray-400 ml-auto">
                          Due {new Date(topic.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {topic.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-3">{topic.description}</p>
                    )}

                    {assignedToContact.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-medium text-teal-600 mb-1">Your tasks:</div>
                        <div className="space-y-1">
                          {assignedToContact.map(task => (
                            <div
                              key={task.id}
                              className="flex items-start gap-2 py-1.5 px-2 rounded text-sm bg-teal-50 border border-teal-100"
                            >
                              {statusIcon(task.status)}
                              <span className={task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}>
                                {task.title}
                              </span>
                              {task.priority === 'high' && priorityBadge('high')}
                              {sharedTaskTitles.has(task.title.trim().toLowerCase()) && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium flex items-center gap-0.5">
                                  <Layers className="w-2.5 h-2.5" /> shared
                                </span>
                              )}
                              {task.due_date && (
                                <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {otherTasks.length > 0 && (
                      <div className="opacity-50">
                        <div className="text-xs font-medium text-gray-400 mb-1">Other tasks:</div>
                        <div className="space-y-0.5">
                          {otherTasks.map(task => renderTask(task))}
                        </div>
                      </div>
                    )}

                    {/* Goal as final destination */}
                    {topic.goal && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-blue-50 border border-dashed border-blue-200">
                          <Target className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-blue-700">Goal: {topic.goal}</span>
                        </div>
                      </div>
                    )}

                    {/* Per-topic Notes */}
                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => toggleNotes(topic.id)}
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
                              value={topicNoteBody[topic.id] || ''}
                              onChange={e => setTopicNoteBody(prev => ({ ...prev, [topic.id]: e.target.value }))}
                              placeholder={commentName.trim() ? 'Add a note...' : 'Set your name above first, then add a note...'}
                              rows={2}
                              className="flex-1 px-2 py-1.5 text-xs border rounded-lg focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitTopicNote(topic.id);
                              }}
                            />
                            <button
                              onClick={() => submitTopicNote(topic.id)}
                              disabled={topicNoteSubmitting === topic.id || !commentName.trim() || !topicNoteBody[topic.id]?.trim()}
                              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                            >
                              {topicNoteSubmitting === topic.id ? '...' : 'Add'}
                            </button>
                          </div>
                        </div>
                      )}
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
