'use client';
import { useState, useMemo } from 'react';
import {
  Clock, Calendar, Users, Layers, Link2, Target, Compass,
  Brain, StickyNote, RefreshCw, CircleDot,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { SourceIcon } from '@/components/ui/source-icon';
import {
  formatSmartDate, sourceLabel, sourceBorderClass,
  sourceIconBgClass, decodeHtmlEntities, capitalize,
  STATUS_COLORS, PRIORITY_LABELS
} from '@/lib/utils';

// --- Interfaces (re-declared per codebase convention) ---

interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: string;
  area: string;
  due_date: string | null;
  start_date: string | null;
  priority: number;
  tags: string[];
  summary: string | null;
  notes: string | null;
  owner: string | null;
  stakeholders: string[];
  progress_percent: number | null;
  created_at: string;
  updated_at: string;
}

interface TopicItem {
  id: string;
  topic_id: string;
  source: string;
  title: string;
  snippet: string;
  body?: string | null;
  url: string;
  occurred_at: string;
  created_at: string;
  metadata: Record<string, unknown>;
  linked_by?: string;
  confidence?: number;
  link_reason?: string;
}

interface LinkedContact {
  id: string;
  contact_id: string;
  topic_id: string;
  role: string | null;
  created_at: string;
  contacts: {
    id: string;
    name: string;
    email: string | null;
    organization: string | null;
    role: string | null;
  } | null;
}

// --- Timeline types ---

type TimelineEventType =
  | 'topic_created' | 'topic_updated' | 'item_occurred' | 'item_linked'
  | 'contact_linked' | 'milestone_start' | 'milestone_due'
  | 'notes_updated' | 'ai_analysis';

type TimelineCategory = 'system' | 'items' | 'contacts' | 'milestones';
type TimelineFilter = 'all' | TimelineCategory;
type DateGroup = 'Upcoming' | 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Earlier';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  category: TimelineCategory;
  timestamp: string;
  title: string;
  description?: string;
  dotColor: string;
  source?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  isFuture?: boolean;
}

const GROUP_ORDER: DateGroup[] = ['Upcoming', 'Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];

const FILTERS: Array<{ key: TimelineFilter; label: string; icon: React.ReactNode }> = [
  { key: 'all', label: 'All', icon: <Layers className="w-3 h-3" /> },
  { key: 'items', label: 'Items', icon: <Layers className="w-3 h-3" /> },
  { key: 'contacts', label: 'People', icon: <Users className="w-3 h-3" /> },
  { key: 'milestones', label: 'Milestones', icon: <Target className="w-3 h-3" /> },
  { key: 'system', label: 'System', icon: <Compass className="w-3 h-3" /> },
];

// --- Helpers ---

function getSourceDotColor(source: string): string {
  switch (source) {
    case 'gmail': return 'bg-red-400';
    case 'calendar': return 'bg-blue-400';
    case 'drive': return 'bg-amber-400';
    case 'slack': return 'bg-purple-400';
    case 'notion': return 'bg-gray-500';
    case 'manual': return 'bg-green-400';
    case 'link': return 'bg-cyan-400';
    default: return 'bg-gray-400';
  }
}

function getDateGroup(timestamp: string): DateGroup {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);

  if (date > now) return 'Upcoming';
  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  if (date >= monthAgo) return 'This Month';
  return 'Earlier';
}

function buildTimelineEvents(topic: Topic, items: TopicItem[], contacts: LinkedContact[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Topic created
  events.push({
    id: 'topic-created',
    type: 'topic_created',
    category: 'system',
    timestamp: topic.created_at,
    title: 'Topic created',
    description: `"${topic.title}" was created in ${capitalize(topic.area)}`,
    dotColor: 'bg-blue-400',
  });

  // Topic updated
  if (topic.updated_at !== topic.created_at) {
    events.push({
      id: 'topic-updated',
      type: 'topic_updated',
      category: 'system',
      timestamp: topic.updated_at,
      title: 'Topic updated',
      description: `Status: ${capitalize(topic.status)} · Priority: ${PRIORITY_LABELS[topic.priority]?.label || 'None'}${topic.progress_percent ? ` · ${topic.progress_percent}% complete` : ''}`,
      dotColor: STATUS_COLORS[topic.status]?.dot || 'bg-green-400',
    });
  }

  // Start date milestone
  if (topic.start_date) {
    events.push({
      id: 'milestone-start',
      type: 'milestone_start',
      category: 'milestones',
      timestamp: topic.start_date,
      title: 'Start date',
      description: new Date(topic.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      dotColor: 'bg-emerald-400',
      isFuture: new Date(topic.start_date) > new Date(),
    });
  }

  // Due date milestone
  if (topic.due_date) {
    const isOverdue = new Date(topic.due_date) < new Date();
    events.push({
      id: 'milestone-due',
      type: 'milestone_due',
      category: 'milestones',
      timestamp: topic.due_date,
      title: isOverdue ? 'Due date (Overdue)' : 'Due date',
      description: new Date(topic.due_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      dotColor: isOverdue ? 'bg-red-500' : 'bg-amber-400',
      isFuture: !isOverdue,
    });
  }

  // Item events
  items.forEach((item) => {
    // Original occurrence
    events.push({
      id: `item-${item.id}`,
      type: 'item_occurred',
      category: 'items',
      timestamp: item.occurred_at,
      title: decodeHtmlEntities(item.title),
      description: item.snippet ? decodeHtmlEntities(item.snippet).substring(0, 150) : undefined,
      dotColor: getSourceDotColor(item.source),
      source: item.source,
      url: item.url,
      metadata: item.metadata,
    });

    // Linked event (only if meaningfully different from occurred_at)
    const diffMs = Math.abs(new Date(item.created_at).getTime() - new Date(item.occurred_at).getTime());
    if (diffMs > 60 * 60 * 1000) {
      events.push({
        id: `item-linked-${item.id}`,
        type: 'item_linked',
        category: 'items',
        timestamp: item.created_at,
        title: `Linked: ${decodeHtmlEntities(item.title)}`,
        description: item.linked_by === 'ai' ? 'Linked by AI' : item.linked_by === 'curator' ? 'Linked by AI curator' : 'Manually linked',
        dotColor: 'bg-indigo-300',
        source: item.source,
      });
    }
  });

  // Contact events
  contacts.forEach((lc) => {
    events.push({
      id: `contact-${lc.id}`,
      type: 'contact_linked',
      category: 'contacts',
      timestamp: lc.created_at,
      title: `Contact linked: ${lc.contacts?.name || 'Unknown'}`,
      description: [lc.role, lc.contacts?.organization].filter(Boolean).join(' · ') || lc.contacts?.email || undefined,
      dotColor: 'bg-teal-400',
    });
  });

  // Notes activity
  if (topic.notes && topic.notes.trim()) {
    events.push({
      id: 'notes-updated',
      type: 'notes_updated',
      category: 'system',
      timestamp: topic.updated_at,
      title: 'Notes updated',
      description: `${topic.notes.trim().split(/\s+/).length} words`,
      dotColor: 'bg-amber-400',
    });
  }

  // AI analysis
  if (topic.summary) {
    events.push({
      id: 'ai-analysis',
      type: 'ai_analysis',
      category: 'system',
      timestamp: topic.updated_at,
      title: 'AI analysis generated',
      description: topic.summary.substring(0, 120) + (topic.summary.length > 120 ? '...' : ''),
      dotColor: 'bg-purple-400',
    });
  }

  // Sort: future events first (ascending), then past (newest first)
  events.sort((a, b) => {
    if (a.isFuture && !b.isFuture) return -1;
    if (!a.isFuture && b.isFuture) return 1;
    if (a.isFuture && b.isFuture) return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return events;
}

function groupEvents(events: TimelineEvent[]): Map<DateGroup, TimelineEvent[]> {
  const groups = new Map<DateGroup, TimelineEvent[]>();
  for (const event of events) {
    const group = getDateGroup(event.timestamp);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(event);
  }
  return groups;
}

// --- Component ---

interface TopicTimelineProps {
  topic: Topic;
  items: TopicItem[];
  linkedContacts: LinkedContact[];
}

export function TopicTimeline({ topic, items, linkedContacts }: TopicTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const allEvents = useMemo(() => buildTimelineEvents(topic, items, linkedContacts), [topic, items, linkedContacts]);

  const filteredEvents = useMemo(() =>
    activeFilter === 'all' ? allEvents : allEvents.filter(e => e.category === activeFilter),
    [allEvents, activeFilter]
  );

  const groupedEvents = useMemo(() => groupEvents(filteredEvents), [filteredEvents]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEvents.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
    return counts;
  }, [allEvents]);

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  return (
    <div id="section-timeline" className="scroll-mt-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-white" />
          </span>
          <h2 className="text-base font-bold text-gray-900">Timeline</h2>
          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{allEvents.length}</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto pb-px">
        {FILTERS.map(filter => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all relative whitespace-nowrap ${
              activeFilter === filter.key ? 'text-gray-900 tab-active' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {filter.icon}
            {filter.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeFilter === filter.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {filter.key === 'all' ? allEvents.length : (categoryCounts[filter.key] || 0)}
            </span>
          </button>
        ))}
      </div>

      {/* Timeline groups */}
      {filteredEvents.length > 0 ? (
        <div className="space-y-6">
          {GROUP_ORDER.filter(group => groupedEvents.has(group)).map(group => (
            <div key={group} className="animate-fade-in">
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  group === 'Upcoming' ? 'text-blue-500' :
                  group === 'Today' ? 'text-emerald-600' :
                  group === 'Yesterday' ? 'text-amber-600' :
                  'text-gray-400'
                }`}>
                  {group}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] text-gray-400">
                  {groupedEvents.get(group)!.length} event{groupedEvents.get(group)!.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Events */}
              <div className="relative pl-6 space-y-1">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-gray-200 via-gray-200 to-transparent" />

                {groupedEvents.get(group)!.map((event) => {
                  const isItem = event.type === 'item_occurred';
                  const isExpanded = expandedEvents.has(event.id);

                  return (
                    <div key={event.id} className={`relative group ${event.isFuture ? 'opacity-70' : ''}`}>
                      {/* Dot */}
                      <div className={`absolute -left-6 top-3 w-3 h-3 rounded-full ${event.dotColor} ring-2 ring-white z-10 ${
                        event.type === 'milestone_due' && event.title.includes('Overdue') ? 'animate-pulse-dot' : ''
                      }`} />

                      {/* Event card */}
                      <div
                        className={`ml-2 p-3 rounded-lg transition-all ${
                          isItem
                            ? `bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm cursor-pointer ${
                                event.source ? `border-l-[3px] ${sourceBorderClass(event.source)}` : ''
                              }`
                            : 'hover:bg-gray-50/50 rounded-lg'
                        }`}
                        onClick={isItem ? () => toggleExpand(event.id) : undefined}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Icon */}
                          {isItem && event.source ? (
                            <span className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${sourceIconBgClass(event.source)}`}>
                              <SourceIcon source={event.source} className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400">
                              {event.type === 'topic_created' && <CircleDot className="w-3.5 h-3.5" />}
                              {event.type === 'topic_updated' && <RefreshCw className="w-3.5 h-3.5" />}
                              {event.type === 'item_linked' && <Link2 className="w-3.5 h-3.5" />}
                              {event.type === 'contact_linked' && <Users className="w-3.5 h-3.5" />}
                              {event.type === 'milestone_start' && <Calendar className="w-3.5 h-3.5" />}
                              {event.type === 'milestone_due' && <Target className="w-3.5 h-3.5" />}
                              {event.type === 'notes_updated' && <StickyNote className="w-3.5 h-3.5" />}
                              {event.type === 'ai_analysis' && <Brain className="w-3.5 h-3.5" />}
                            </span>
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {event.url ? (
                                <a
                                  href={event.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate transition-colors"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {event.title}
                                </a>
                              ) : (
                                <span className={`text-sm font-medium truncate ${
                                  event.isFuture ? 'text-blue-600' :
                                  event.type === 'milestone_due' && event.title.includes('Overdue') ? 'text-red-600' :
                                  event.type === 'topic_created' ? 'text-blue-700' :
                                  'text-gray-800'
                                }`}>
                                  {event.title}
                                </span>
                              )}
                              {event.source && isItem && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${sourceIconBgClass(event.source)}`}>
                                  <SourceIcon source={event.source} className="w-2.5 h-2.5" />
                                  {sourceLabel(event.source)}
                                </span>
                              )}
                            </div>
                            {event.description && !isExpanded && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{event.description}</p>
                            )}
                            <span className="text-[11px] text-gray-400 mt-1 inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatSmartDate(event.timestamp)}
                            </span>
                          </div>

                          {/* Expand indicator */}
                          {isItem && (
                            <span className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && isItem && (
                          <div className="mt-2.5 ml-9 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600 animate-fade-in space-y-1.5">
                            {event.metadata && typeof event.metadata.from === 'string' && (
                              <p><span className="font-medium text-gray-700">From:</span> {event.metadata.from.split('<')[0].trim()}</p>
                            )}
                            {event.metadata && typeof event.metadata.to === 'string' && (
                              <p><span className="font-medium text-gray-700">To:</span> {event.metadata.to.split('<')[0].trim()}</p>
                            )}
                            {event.metadata && typeof event.metadata.channel_name === 'string' && (
                              <p><span className="font-medium text-gray-700">Channel:</span> #{event.metadata.channel_name}</p>
                            )}
                            {event.metadata && Array.isArray(event.metadata.attendees) && (
                              <p><span className="font-medium text-gray-700">Attendees:</span> {event.metadata.attendees.length}</p>
                            )}
                            {event.description && (
                              <p className="mt-1 text-gray-500 line-clamp-4">{event.description}</p>
                            )}
                            {event.url && (
                              <a href={event.url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 mt-1 font-medium">
                                <ExternalLink className="w-3 h-3" /> Open in source
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="py-12 bg-gradient-to-b from-white to-gray-50/50 rounded-xl border border-dashed border-gray-200 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-gray-700 text-sm font-semibold mb-1">No timeline events</h3>
          <p className="text-gray-400 text-xs">
            {activeFilter !== 'all'
              ? 'No events match this filter. Try selecting "All".'
              : 'Link items and contacts to build your topic timeline.'}
          </p>
        </div>
      )}
    </div>
  );
}
