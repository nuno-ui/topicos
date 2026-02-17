'use client';
import { useState, useMemo } from 'react';
import {
  Clock, Calendar, Users, Layers, Link2, Target, Compass,
  Brain, StickyNote, RefreshCw, CircleDot,
  ChevronDown, ChevronUp, ExternalLink, Mail, MessageSquare,
  FileText, Globe, Pencil, Zap, AlertTriangle, CheckCircle2,
  ArrowRight
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

function getSourceColor(source: string): { dot: string; bg: string; text: string; border: string; gradient: string } {
  switch (source) {
    case 'gmail': return { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', gradient: 'from-red-500 to-rose-400' };
    case 'calendar': return { dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', gradient: 'from-blue-500 to-indigo-400' };
    case 'drive': return { dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', gradient: 'from-amber-500 to-yellow-400' };
    case 'slack': return { dot: 'bg-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', gradient: 'from-purple-500 to-violet-400' };
    case 'notion': return { dot: 'bg-gray-500', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', gradient: 'from-gray-500 to-slate-400' };
    case 'manual': return { dot: 'bg-green-400', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', gradient: 'from-green-500 to-emerald-400' };
    case 'link': return { dot: 'bg-cyan-400', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', gradient: 'from-cyan-500 to-teal-400' };
    default: return { dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', gradient: 'from-gray-400 to-slate-400' };
  }
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'gmail': return <Mail className="w-3.5 h-3.5" />;
    case 'calendar': return <Calendar className="w-3.5 h-3.5" />;
    case 'drive': return <FileText className="w-3.5 h-3.5" />;
    case 'slack': return <MessageSquare className="w-3.5 h-3.5" />;
    case 'notion': return <FileText className="w-3.5 h-3.5" />;
    case 'manual': return <Pencil className="w-3.5 h-3.5" />;
    case 'link': return <Globe className="w-3.5 h-3.5" />;
    default: return <Layers className="w-3.5 h-3.5" />;
  }
}

function getEventIcon(type: TimelineEventType) {
  switch (type) {
    case 'topic_created': return <Zap className="w-3.5 h-3.5" />;
    case 'topic_updated': return <RefreshCw className="w-3.5 h-3.5" />;
    case 'item_linked': return <Link2 className="w-3.5 h-3.5" />;
    case 'contact_linked': return <Users className="w-3.5 h-3.5" />;
    case 'milestone_start': return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'milestone_due': return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'notes_updated': return <StickyNote className="w-3.5 h-3.5" />;
    case 'ai_analysis': return <Brain className="w-3.5 h-3.5" />;
    default: return <CircleDot className="w-3.5 h-3.5" />;
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

function getGroupStyle(group: DateGroup): { headerColor: string; lineColor: string; bgAccent: string } {
  switch (group) {
    case 'Upcoming': return { headerColor: 'text-blue-600', lineColor: 'from-blue-300', bgAccent: 'bg-blue-50' };
    case 'Today': return { headerColor: 'text-emerald-600', lineColor: 'from-emerald-300', bgAccent: 'bg-emerald-50' };
    case 'Yesterday': return { headerColor: 'text-amber-600', lineColor: 'from-amber-200', bgAccent: 'bg-amber-50' };
    case 'This Week': return { headerColor: 'text-violet-500', lineColor: 'from-violet-200', bgAccent: 'bg-violet-50' };
    case 'This Month': return { headerColor: 'text-gray-500', lineColor: 'from-gray-200', bgAccent: 'bg-gray-50' };
    default: return { headerColor: 'text-gray-400', lineColor: 'from-gray-200', bgAccent: 'bg-gray-50' };
  }
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
      title: isOverdue ? 'Due date (Overdue!)' : 'Due date',
      description: new Date(topic.due_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      dotColor: isOverdue ? 'bg-red-500' : 'bg-amber-400',
      isFuture: !isOverdue,
    });
  }

  // Item events
  items.forEach((item) => {
    events.push({
      id: `item-${item.id}`,
      type: 'item_occurred',
      category: 'items',
      timestamp: item.occurred_at,
      title: decodeHtmlEntities(item.title),
      description: item.snippet ? decodeHtmlEntities(item.snippet).substring(0, 200) : undefined,
      dotColor: getSourceColor(item.source).dot,
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
      description: [lc.role, lc.contacts?.organization, lc.contacts?.role].filter(Boolean).join(' · ') || lc.contacts?.email || undefined,
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
      description: topic.summary.substring(0, 150) + (topic.summary.length > 150 ? '...' : ''),
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

// --- Source breakdown mini-chart ---
function SourceBreakdown({ items }: { items: TopicItem[] }) {
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(i => { counts[i.source] = (counts[i.source] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count, pct: Math.round((count / items.length) * 100) }));
  }, [items]);

  if (breakdown.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden flex-1 max-w-[200px]">
        {breakdown.map(({ source, pct }) => (
          <div key={source} className={`${getSourceColor(source).dot} transition-all`} style={{ width: `${Math.max(pct, 3)}%` }} />
        ))}
      </div>
      {/* Labels */}
      <div className="flex items-center gap-2 flex-wrap">
        {breakdown.slice(0, 5).map(({ source, count }) => (
          <span key={source} className={`inline-flex items-center gap-1 text-[10px] font-medium ${getSourceColor(source).text}`}>
            {getSourceIcon(source)}
            {count}
          </span>
        ))}
      </div>
    </div>
  );
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<DateGroup>>(new Set());

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

  const toggleGroup = (group: DateGroup) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  return (
    <div id="section-timeline" className="scroll-mt-8 space-y-5">
      {/* Header + Stats */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50/30 to-transparent rounded-xl p-4 border border-blue-100/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-sm">
              <Clock className="w-4 h-4 text-white" />
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">Timeline</h2>
              <p className="text-[11px] text-gray-500">{allEvents.length} events across all sources</p>
            </div>
          </div>
        </div>

        {/* Source breakdown bar */}
        <SourceBreakdown items={items} />
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-px">
        {FILTERS.map(filter => {
          const count = filter.key === 'all' ? allEvents.length : (categoryCounts[filter.key] || 0);
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full transition-all whitespace-nowrap border ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {filter.icon}
              {filter.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timeline groups */}
      {filteredEvents.length > 0 ? (
        <div className="space-y-6">
          {GROUP_ORDER.filter(group => groupedEvents.has(group)).map(group => {
            const style = getGroupStyle(group);
            const events = groupedEvents.get(group)!;
            const isCollapsed = collapsedGroups.has(group);

            return (
              <div key={group} className="animate-fade-in">
                {/* Group header — clickable to collapse */}
                <button
                  onClick={() => toggleGroup(group)}
                  className="flex items-center gap-2 mb-3 w-full group/header"
                >
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${style.headerColor} ${style.bgAccent}`}>
                    {group === 'Upcoming' && <ArrowRight className="w-3 h-3" />}
                    {group === 'Today' && <Zap className="w-3 h-3" />}
                    {group}
                  </span>
                  <div className={`flex-1 h-px bg-gradient-to-r ${style.lineColor} to-transparent`} />
                  <span className="text-[10px] text-gray-400 group-hover/header:text-gray-600 transition-colors">
                    {events.length} event{events.length !== 1 ? 's' : ''}
                    {isCollapsed ? ' ▸' : ' ▾'}
                  </span>
                </button>

                {/* Events */}
                {!isCollapsed && (
                  <div className="relative pl-7 space-y-1.5">
                    {/* Vertical line */}
                    <div className={`absolute left-[13px] top-2 bottom-2 w-[2px] bg-gradient-to-b ${style.lineColor} via-gray-100 to-transparent rounded-full`} />

                    {events.map((event) => {
                      const isItem = event.type === 'item_occurred';
                      const isExpanded = expandedEvents.has(event.id);
                      const isMilestone = event.category === 'milestones';
                      const isContact = event.type === 'contact_linked';
                      const colors = event.source ? getSourceColor(event.source) : null;

                      return (
                        <div key={event.id} className={`relative group ${event.isFuture ? 'opacity-75' : ''}`}>
                          {/* Dot — larger for milestones, source-colored for items */}
                          <div className={`absolute -left-7 z-10 flex items-center justify-center ${
                            isMilestone
                              ? `top-2.5 w-4 h-4 rounded-full ${event.dotColor} ring-3 ring-white shadow-sm`
                              : isItem
                                ? `top-3 w-3.5 h-3.5 rounded-full ${event.dotColor} ring-2 ring-white`
                                : `top-3 w-2.5 h-2.5 rounded-full ${event.dotColor} ring-2 ring-white`
                          } ${
                            event.type === 'milestone_due' && event.title.includes('Overdue') ? 'animate-pulse' : ''
                          }`} />

                          {/* Event card */}
                          <div
                            className={`ml-2 rounded-xl transition-all ${
                              isMilestone
                                ? `p-3.5 border-2 ${event.title.includes('Overdue') ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/30'} shadow-sm`
                                : isItem
                                  ? `p-3 bg-white border ${colors?.border || 'border-gray-100'} hover:shadow-md cursor-pointer border-l-[3px] ${sourceBorderClass(event.source!)}`
                                  : isContact
                                    ? 'p-3 bg-teal-50/40 border border-teal-100 rounded-xl'
                                    : 'p-2.5 hover:bg-gray-50/50 rounded-lg'
                            }`}
                            onClick={isItem ? () => toggleExpand(event.id) : undefined}
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Icon */}
                              {isItem && event.source ? (
                                <span className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${colors?.gradient || 'from-gray-400 to-slate-400'} shadow-sm`}>
                                  <span className="text-white">{getSourceIcon(event.source)}</span>
                                </span>
                              ) : isMilestone ? (
                                <span className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                                  event.title.includes('Overdue') ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                  {getEventIcon(event.type)}
                                </span>
                              ) : isContact ? (
                                <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600">
                                  <Users className="w-4 h-4" />
                                </span>
                              ) : (
                                <span className="mt-0.5 flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400">
                                  {getEventIcon(event.type)}
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
                                      className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate transition-colors"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      {event.title}
                                    </a>
                                  ) : (
                                    <span className={`text-sm font-semibold truncate ${
                                      event.isFuture ? 'text-blue-600' :
                                      event.title.includes('Overdue') ? 'text-red-600' :
                                      event.type === 'topic_created' ? 'text-blue-700' :
                                      isContact ? 'text-teal-700' :
                                      'text-gray-900'
                                    }`}>
                                      {event.title}
                                    </span>
                                  )}
                                  {event.source && isItem && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${colors?.bg || 'bg-gray-50'} ${colors?.text || 'text-gray-600'}`}>
                                      <SourceIcon source={event.source} className="w-2.5 h-2.5" />
                                      {sourceLabel(event.source)}
                                    </span>
                                  )}
                                </div>

                                {/* Description/snippet — show more for expanded, truncate for collapsed */}
                                {event.description && !isExpanded && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{event.description}</p>
                                )}

                                {/* Metadata pills for items */}
                                {isItem && event.metadata && !isExpanded && (
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {typeof event.metadata.from === 'string' && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                        <span className="font-medium">From</span> {event.metadata.from.split('<')[0].trim().substring(0, 30)}
                                      </span>
                                    )}
                                    {typeof event.metadata.channel_name === 'string' && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                        #{event.metadata.channel_name}
                                      </span>
                                    )}
                                    {Array.isArray(event.metadata.attendees) && event.metadata.attendees.length > 0 && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                        <Users className="w-2.5 h-2.5" /> {event.metadata.attendees.length} attendees
                                      </span>
                                    )}
                                    {event.metadata.has_attachments === true && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                        📎 {typeof event.metadata.attachment_count === 'number' ? String(event.metadata.attachment_count) : ''} files
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Timestamp */}
                                <span className="text-[10px] text-gray-400 mt-1.5 inline-flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatSmartDate(event.timestamp)}
                                </span>
                              </div>

                              {/* Expand indicator */}
                              {isItem && (
                                <span className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </span>
                              )}
                            </div>

                            {/* Expanded details */}
                            {isExpanded && isItem && (
                              <div className="mt-3 ml-10 p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 animate-fade-in space-y-2">
                                {event.metadata && typeof event.metadata.from === 'string' && (
                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-gray-700 w-16 flex-shrink-0">From:</span>
                                    <span>{event.metadata.from}</span>
                                  </div>
                                )}
                                {event.metadata && typeof event.metadata.to === 'string' && (
                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-gray-700 w-16 flex-shrink-0">To:</span>
                                    <span>{event.metadata.to}</span>
                                  </div>
                                )}
                                {event.metadata && typeof event.metadata.cc === 'string' && (
                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-gray-700 w-16 flex-shrink-0">CC:</span>
                                    <span>{event.metadata.cc}</span>
                                  </div>
                                )}
                                {event.metadata && typeof event.metadata.channel_name === 'string' && (
                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-gray-700 w-16 flex-shrink-0">Channel:</span>
                                    <span className="text-purple-600 font-medium">#{event.metadata.channel_name}</span>
                                  </div>
                                )}
                                {event.metadata && typeof event.metadata.username === 'string' && (
                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-gray-700 w-16 flex-shrink-0">User:</span>
                                    <span>@{event.metadata.username}</span>
                                  </div>
                                )}
                                {event.metadata && Array.isArray(event.metadata.attendees) && (
                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-gray-700 w-16 flex-shrink-0">Attendees:</span>
                                    <span>{event.metadata.attendees.map((a: unknown) =>
                                      typeof a === 'string' ? a : (a as Record<string, unknown>)?.email || (a as Record<string, unknown>)?.displayName || ''
                                    ).filter(Boolean).join(', ')}</span>
                                  </div>
                                )}
                                {event.metadata && event.metadata.has_attachments === true && (
                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-gray-700 w-16 flex-shrink-0">Files:</span>
                                    <span>{Array.isArray(event.metadata.attachment_names) ? (event.metadata.attachment_names as string[]).join(', ') : 'Attached files'}</span>
                                  </div>
                                )}
                                {event.description && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <p className="text-gray-500 leading-relaxed line-clamp-6">{event.description}</p>
                                  </div>
                                )}
                                {event.url && (
                                  <a href={event.url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 mt-1 font-semibold bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
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
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="py-16 bg-gradient-to-b from-white to-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-blue-500" />
          </div>
          <h3 className="text-gray-700 text-sm font-bold mb-1.5">No timeline events</h3>
          <p className="text-gray-400 text-xs max-w-[280px] mx-auto">
            {activeFilter !== 'all'
              ? 'No events match this filter. Try selecting "All".'
              : 'Link items and contacts to build your topic timeline.'}
          </p>
        </div>
      )}
    </div>
  );
}
