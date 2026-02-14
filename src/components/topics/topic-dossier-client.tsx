'use client';

import { useState } from 'react';
import type { Topic, Item, Task, TopicLink, Area, TaskStatus, ItemSource } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Pencil,
  Sparkles,
  Plus,
  Mail,
  Calendar,
  FileText,
  StickyNote,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

/* ---------- constants ---------- */

const AREA_COLORS: Record<Area, { badge: string; hex: string }> = {
  personal: {
    badge: 'bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20',
    hex: '#8b5cf6',
  },
  career: {
    badge: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20',
    hex: '#3b82f6',
  },
  work: {
    badge: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20',
    hex: '#f97316',
  },
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const TASK_STATUS_STYLES: Record<TaskStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  done: {
    label: 'Done',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
};

const SOURCE_ICONS: Record<ItemSource, React.ElementType> = {
  gmail: Mail,
  calendar: Calendar,
  drive: FileText,
  manual: StickyNote,
};

/* ---------- types ---------- */

interface LinkedItem {
  link: TopicLink;
  item: Item;
}

interface TopicDossierClientProps {
  topic: Topic;
  linkedItems: LinkedItem[];
  tasks: Task[];
}

/* ---------- component ---------- */

export function TopicDossierClient({
  topic,
  linkedItems,
  tasks: initialTasks,
}: TopicDossierClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(topic.summary);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Add task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const areaColor = AREA_COLORS[topic.area];

  // Sort linked items chronologically (oldest first)
  const sortedItems = [...linkedItems].sort(
    (a, b) =>
      new Date(a.item.occurred_at).getTime() - new Date(b.item.occurred_at).getTime()
  );

  /* ---------- handlers ---------- */

  const handleGenerateSummary = async () => {
    setSummarizing(true);
    setSummaryError(null);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topic.id }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSummaryError(body.error ?? 'Failed to generate summary');
        return;
      }

      const data = await res.json();
      setSummary(data.summary ?? data.output ?? null);
    } catch {
      setSummaryError('Network error. Please try again.');
    } finally {
      setSummarizing(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);
    setCreatingTask(true);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          topic_id: topic.id,
          due_at: taskDue || undefined,
          created_by: 'user',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTaskError(body.error ?? 'Failed to create task');
        return;
      }

      const newTask: Task = await res.json();
      setTasks((prev) => [newTask, ...prev]);
      setTaskTitle('');
      setTaskDue('');
      setShowTaskForm(false);
    } catch {
      setTaskError('Network error. Please try again.');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      pending: 'in_progress',
      in_progress: 'done',
      done: 'pending',
    };
    const newStatus = nextStatus[task.status];

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const updated: Task = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      }
    } catch {
      // silently ignore
    }
  };

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/topics"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Topics
      </Link>

      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium capitalize',
                  areaColor.badge
                )}
              >
                {topic.area}
              </span>
              <span
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium capitalize',
                  STATUS_STYLES[topic.status]
                )}
              >
                {topic.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{topic.title}</h1>
            {topic.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {topic.description}
              </p>
            )}
          </div>
          <Link
            href={`/topics/${topic.id}/edit`}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>

        {/* Area accent bar */}
        <div
          className="mt-4 h-1 w-full rounded-full opacity-40"
          style={{ backgroundColor: areaColor.hex }}
        />
      </div>

      {/* Summary section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">AI Summary</h2>
          <button
            onClick={handleGenerateSummary}
            disabled={summarizing}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {summarizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Summary
              </>
            )}
          </button>
        </div>

        {summaryError && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {summaryError}
          </div>
        )}

        <div className="mt-4">
          {summary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {summary}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No AI summary yet. Click &quot;Generate Summary&quot; to create one from linked items.
            </p>
          )}
        </div>
      </div>

      {/* Timeline section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Linked items in chronological order
        </p>

        {sortedItems.length === 0 ? (
          <div className="mt-4 rounded-md border border-border bg-background p-6 text-center text-sm text-muted-foreground">
            No linked items yet. Items will appear here as they are linked to this topic.
          </div>
        ) : (
          <div className="mt-4 space-y-1">
            {sortedItems.map(({ link, item }) => {
              const SourceIcon = SOURCE_ICONS[item.source as ItemSource] ?? StickyNote;
              return (
                <div
                  key={link.id}
                  className="flex items-center gap-4 rounded-md border border-border bg-background px-4 py-3 transition-colors hover:border-primary/20"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `${areaColor.hex}15`,
                      color: areaColor.hex,
                    }}
                  >
                    <SourceIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    {item.snippet && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.snippet}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(item.occurred_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tasks section */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} for this topic
            </p>
          </div>
          <button
            onClick={() => setShowTaskForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
          >
            {showTaskForm ? (
              'Cancel'
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add Task
              </>
            )}
          </button>
        </div>

        {/* Add Task form */}
        {showTaskForm && (
          <form
            onSubmit={handleAddTask}
            className="mt-4 space-y-3 rounded-md border border-border bg-background p-4"
          >
            {taskError && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {taskError}
              </div>
            )}

            <div className="flex gap-3">
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title..."
                className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={creatingTask}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {creatingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Add'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Task list */}
        {tasks.length === 0 && !showTaskForm ? (
          <div className="mt-4 rounded-md border border-border bg-background p-6 text-center text-sm text-muted-foreground">
            No tasks yet. Click &quot;Add Task&quot; to create one.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {tasks.map((task) => {
              const statusInfo = TASK_STATUS_STYLES[task.status];
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 rounded-md border border-border bg-background px-4 py-3"
                >
                  <button
                    onClick={() => handleToggleTaskStatus(task)}
                    className="shrink-0"
                    title={`Status: ${statusInfo.label}. Click to cycle.`}
                  >
                    <CheckCircle2
                      className={cn(
                        'h-5 w-5 transition-colors',
                        task.status === 'done'
                          ? 'text-emerald-400'
                          : task.status === 'in_progress'
                            ? 'text-blue-400'
                            : 'text-muted-foreground'
                      )}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        task.status === 'done'
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                      )}
                    >
                      {task.title}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {task.due_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(task.due_at).toLocaleDateString()}
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-xs font-medium',
                        statusInfo.className
                      )}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
