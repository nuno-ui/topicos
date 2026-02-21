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
        {isExpanded && (
          <div className="ml-6 mb-2">
            {activeTasks.map(task => renderTask(task, contactTaskIds.includes(task.id)))}
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

            {contactRelevantTopics.map(topic => {
              const topicTasks = tasksByTopic[topic.id] || [];
              const assignedToContact = topicTasks.filter(t => contactTaskIds.includes(t.id));
              const otherTasks = topicTasks.filter(t => !contactTaskIds.includes(t.id) && t.status !== 'archived');

              return (
                <div key={topic.id} className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold text-gray-900">{topic.title}</span>
                    {topic.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {topic.due_date && (
                      <span className="text-xs text-gray-400 ml-auto">
                        Due {new Date(topic.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {assignedToContact.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-teal-600 mb-1">Your tasks:</div>
                      <div className="space-y-1">
                        {assignedToContact.map(task => renderTask(task, true))}
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
                </div>
              );
            })}
          </div>
        )}

        {/* Comments Section */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            Comments
            {comments.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{comments.length}</span>
            )}
          </h2>

          {comments.length > 0 && (
            <div className="space-y-3 mb-4">
              {comments.map(comment => (
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

          <div className="border-t pt-4">
            <div className="space-y-3">
              <input
                type="text"
                value={commentName}
                onChange={e => setCommentName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <div className="flex gap-2">
                <textarea
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  placeholder="Leave a comment..."
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
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-4">
          Powered by YouOS
        </div>
      </div>
    </div>
  );
}
