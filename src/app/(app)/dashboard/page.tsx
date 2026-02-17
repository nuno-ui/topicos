import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { sourceLabel, formatRelativeDate, getTopicHealthScore, getDaysUntil, formatSmartDate, decodeHtmlEntities } from '@/lib/utils';
import { Zap, Clock, FolderKanban, Newspaper, PieChart, Mail, Calendar, FileText, MessageSquare, BookOpen, StickyNote, Link2, File, Search, Users, Plus, Sparkles, Paperclip, TrendingUp, TrendingDown, ArrowRight, Brain, Flame, LinkIcon, CheckCircle2, Circle, Rocket, AlertTriangle } from 'lucide-react';
import { DashboardAgents } from '@/components/dashboard/dashboard-agents';
import { ClientGreeting, ClientDate } from '@/components/dashboard/client-date';

const sourceIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  gmail: Mail,
  calendar: Calendar,
  drive: FileText,
  slack: MessageSquare,
  notion: BookOpen,
  manual: StickyNote,
  link: Link2,
};

const sourceIconColorMap: Record<string, string> = {
  gmail: 'text-red-500',
  calendar: 'text-blue-500',
  drive: 'text-amber-500',
  slack: 'text-purple-500',
  notion: 'text-gray-700',
  manual: 'text-green-500',
  link: 'text-cyan-500',
};

function DashSourceIcon({ source, className = 'w-4 h-4' }: { source: string; className?: string }) {
  const Icon = sourceIconMap[source] || File;
  const color = sourceIconColorMap[source] || 'text-gray-400';
  return <Icon className={`${color} ${className}`} />;
}

/** Format a due date as relative text: "in 3 days", "overdue by 2 days", "today" */
function formatDueRelative(dueDate: string): string {
  const days = getDaysUntil(dueDate);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return 'Overdue by 1 day';
  return `Overdue by ${Math.abs(days)} days`;
}

/** Get a left-border color class based on topic area */
function areaBorderColor(area: string): string {
  switch (area) {
    case 'work': return 'border-l-blue-500';
    case 'personal': return 'border-l-green-500';
    case 'career': return 'border-l-purple-500';
    default: return 'border-l-gray-300';
  }
}

/** Health score indicator dot color */
function healthDotClass(color: string): string {
  switch (color) {
    case 'green': return 'status-dot status-dot-active';
    case 'amber': return 'status-dot status-dot-warning';
    case 'red': return 'status-dot status-dot-error';
    default: return 'status-dot status-dot-active';
  }
}

/** Bar gradient class based on source */
function barGradient(src: string): string {
  switch (src) {
    case 'gmail': return 'bg-gradient-to-r from-red-400 to-red-500';
    case 'calendar': return 'bg-gradient-to-r from-blue-400 to-blue-500';
    case 'drive': return 'bg-gradient-to-r from-amber-400 to-amber-500';
    case 'slack': return 'bg-gradient-to-r from-purple-400 to-purple-500';
    case 'notion': return 'bg-gradient-to-r from-gray-400 to-gray-500';
    case 'manual': return 'bg-gradient-to-r from-green-400 to-green-500';
    case 'link': return 'bg-gradient-to-r from-cyan-400 to-cyan-500';
    default: return 'bg-gradient-to-r from-gray-300 to-gray-400';
  }
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Wrap the entire Promise.all in try/catch so individual failures don't break the page
  let topicsRes: { data: any[] | null; error: any; count: number | null } = { data: null, error: null, count: null };
  let googleRes: { data: any[] | null; error: any } = { data: null, error: null };
  let slackRes: { data: any[] | null; error: any } = { data: null, error: null };
  let notionRes: { data: any[] | null; error: any } = { data: null, error: null };
  let recentItemsRes: { data: any[] | null; error: any } = { data: null, error: null };
  let aiRunsRes: { data: any[] | null; error: any } = { data: null, error: null };
  let allItemsCountRes: { count: number | null; error: any } = { count: 0, error: null };
  let itemsLast7Res: { count: number | null; error: any } = { count: 0, error: null };
  let itemsPrior7Res: { count: number | null; error: any } = { count: 0, error: null };
  let streakItemsRes: { data: any[] | null; error: any } = { data: null, error: null };
  let contactsCountRes: { count: number | null; error: any } = { count: 0, error: null };

  try {
    const results = await Promise.all([
      supabase
        .from('topics')
        .select('*, topic_items(count)')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(15),
      supabase
        .from('google_accounts')
        .select('id, email')
        .eq('user_id', user!.id),
      supabase
        .from('slack_accounts')
        .select('id, team_name')
        .eq('user_id', user!.id),
      supabase
        .from('notion_accounts')
        .select('id, workspace_name')
        .eq('user_id', user!.id),
      supabase
        .from('topic_items')
        .select('id, title, source, occurred_at, created_at, topic_id, topics(title)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('ai_runs')
        .select('id, kind, input_summary, created_at, tokens_used, topic_id, topics(title)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('topic_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id),
      // Items added in last 7 days (for trend)
      supabase
        .from('topic_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .gte('created_at', sevenDaysAgo),
      // Items added in prior 7 days (for trend comparison)
      supabase
        .from('topic_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .gte('created_at', fourteenDaysAgo)
        .lt('created_at', sevenDaysAgo),
      // Recent items with dates for active streak calculation
      supabase
        .from('topic_items')
        .select('created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(200),
      // Contacts count for getting started tracker
      supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id),
    ]);

    topicsRes = results[0] as any;
    googleRes = results[1] as any;
    slackRes = results[2] as any;
    notionRes = results[3] as any;
    recentItemsRes = results[4];
    aiRunsRes = results[5];
    allItemsCountRes = results[6];
    itemsLast7Res = results[7];
    itemsPrior7Res = results[8];
    streakItemsRes = results[9];
    contactsCountRes = results[10];
  } catch (error) {
    // If the entire Promise.all fails, all variables remain at their safe defaults
    console.error('Dashboard data fetch failed:', error);
  }

  const topics = topicsRes.data ?? [];
  const googleAccounts = googleRes.data ?? [];
  const slackAccounts = slackRes.data ?? [];
  const notionAccounts = notionRes.data ?? [];
  const recentItems = recentItemsRes.data ?? [];
  const aiRuns = aiRunsRes.data ?? [];
  const totalItems = allItemsCountRes.count ?? 0;
  const itemsLast7 = itemsLast7Res.count ?? 0;
  const itemsPrior7 = itemsPrior7Res.count ?? 0;
  const streakItems = streakItemsRes.data ?? [];
  const contactsCount = contactsCountRes.count ?? 0;
  const hasGoogle = googleAccounts.length > 0;
  const hasSlack = slackAccounts.length > 0;
  const hasNotion = notionAccounts.length > 0;

  // Connected sources count for getting started tracker
  const connectedSourcesCount = (hasGoogle ? 1 : 0) + (hasSlack ? 1 : 0) + (hasNotion ? 1 : 0);

  // Overdue topics: active topics with a due_date in the past
  const overdueTopics = topics.filter((t: any) => t.due_date && new Date(t.due_date) < now);

  // Compute trend: positive means more items this week than last
  const itemsTrend = itemsLast7 - itemsPrior7;

  // Compute active streak: consecutive days with at least one topic_item created
  const activeStreak = (() => {
    if (streakItems.length === 0) return 0;
    const activeDays = new Set(streakItems.map((i: { created_at: string }) => new Date(i.created_at).toDateString()));
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (activeDays.has(d.toDateString())) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  })();

  // Compute last sync time per source (most recent topic_item created_at per source)
  const lastSyncBySource: Record<string, string> = {};
  for (const item of recentItems) {
    if (!lastSyncBySource[item.source]) {
      lastSyncBySource[item.source] = item.created_at;
    }
  }

  // Count items per source from the last 7 days (for sparkline text)
  const itemsThisWeekBySource: Record<string, number> = {};
  for (const item of recentItems) {
    if (new Date(item.created_at) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      itemsThisWeekBySource[item.source] = (itemsThisWeekBySource[item.source] || 0) + 1;
    }
  }

  // Map agent kind to a user-friendly badge label
  const agentKindLabel = (kind: string): string => {
    const labels: Record<string, string> = {
      ai_find: 'AI Find',
      analyze_topic: 'Deep Dive',
      daily_briefing: 'Daily Briefing',
      weekly_review: 'Weekly Review',
      suggest_topics: 'Suggestions',
      action_items: 'Action Items',
      extract_contacts: 'Contacts',
      summarize: 'Summary',
    };
    return labels[kind] || kind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const displayName = user!.user_metadata?.full_name || user!.email?.split('@')[0] || 'there';

  const productivityTip = () => {
    const tips = [
      { tip: 'Try using \u2318K to quickly navigate with the command palette', icon: '\u2328\uFE0F' },
      { tip: 'Link items to topics to build a knowledge graph of your work', icon: '\uD83D\uDD17' },
      { tip: 'Use AI Find to automatically discover relevant items for your topics', icon: '\uD83E\uDD16' },
      { tip: 'Run the Daily Briefing to get an AI summary of what matters today', icon: '\uD83D\uDCCB' },
      { tip: 'Set due dates on topics to track deadlines and see urgency indicators', icon: '\u23F0' },
      { tip: 'Use keyboard shortcuts 1-5 to quickly navigate between sections', icon: '\uD83D\uDE80' },
      { tip: 'Extract contacts from your topics to build your relationship network', icon: '\uD83D\uDC65' },
      { tip: 'Create folders to organize your topics into projects or categories', icon: '\uD83D\uDCC1' },
    ];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    return tips[dayOfYear % tips.length];
  };

  // Memoize productivity tip so it's not recomputed on each reference
  const currentTip = productivityTip();

  const sourceCounts = recentItems.reduce((acc: Record<string, number>, item: { source: string }) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSourceCount = (Object.values(sourceCounts) as number[]).reduce((a, b) => a + b, 0);

  // Getting Started tracker: show only if user has < 3 topics AND < 3 connected sources
  const showGettingStarted = topics.length < 3 && connectedSourcesCount < 3;
  const gettingStartedSteps = [
    { label: 'Connect a source', done: connectedSourcesCount > 0, href: '/settings' },
    { label: 'Create your first topic', done: topics.length > 0, href: '/topics' },
    { label: 'Run an AI agent', done: aiRuns.length > 0, href: '#ai-agents' },
    { label: 'Add a contact', done: contactsCount > 0, href: '/contacts' },
  ];
  const stepsCompleted = gettingStartedSteps.filter(s => s.done).length;

  return (
    <div className="p-8 max-w-6xl animate-page-enter">
      {/* Quick Actions Bar */}
      <div className="mb-6 flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto thin-scrollbar">
        <Link href="/topics" className="px-4 py-2 brand-gradient text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Topic
        </Link>
        <Link href="/search" className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" /> Search
          <kbd className="hidden sm:inline-flex ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 border border-gray-200 rounded text-gray-400">\u2318K</kbd>
        </Link>
        <Link href="#ai-agents" className="px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg text-sm font-medium text-purple-700 hover:from-purple-100 hover:to-indigo-100 transition-all flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" /> AI Briefing
        </Link>
        <Link href="/contacts" className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg text-sm font-medium text-emerald-700 hover:from-emerald-100 hover:to-teal-100 transition-all flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-500" /> Contacts
        </Link>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-1.5">
          <span>{currentTip.icon}</span>
          <span>{currentTip.tip}</span>
        </div>
      </div>

      {/* Overdue Topics Alert Banner */}
      {overdueTopics.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-500 to-amber-500 rounded-xl shadow-sm text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">
                {overdueTopics.length} overdue topic{overdueTopics.length !== 1 ? 's' : ''} need{overdueTopics.length === 1 ? 's' : ''} attention
              </p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {overdueTopics.slice(0, 5).map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/topics/${t.id}`}
                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md font-medium transition-colors truncate max-w-[200px]"
                  >
                    {t.title}
                  </Link>
                ))}
                {overdueTopics.length > 5 && (
                  <Link href="/topics" className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md font-medium transition-colors">
                    +{overdueTopics.length - 5} more
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Welcome + Stats */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            <ClientGreeting />{' '}
            <span className="brand-gradient-text">{displayName}</span>
          </h1>
          <ClientDate />
        </div>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto thin-scrollbar pb-1">
          <div className="text-center px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[100px] animate-count-up">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <FolderKanban className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{topics.length}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">Active Topics</p>
          </div>
          <div className="text-center px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[100px] animate-count-up" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Paperclip className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">{totalItems}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">Total Items</p>
            {itemsTrend !== 0 && (
              <div className={`flex items-center justify-center gap-0.5 mt-1 text-[10px] font-medium ${itemsTrend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {itemsTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{itemsTrend > 0 ? '+' : ''}{itemsTrend} this week</span>
              </div>
            )}
          </div>
          <div className="text-center px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[100px] animate-count-up" style={{ animationDelay: '160ms' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-purple-600">{aiRuns.length}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">AI Runs</p>
          </div>
          {activeStreak > 0 && (
            <div className="text-center px-5 py-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm min-w-[100px] animate-count-up" style={{ animationDelay: '240ms' }}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Flame className="w-4 h-4 text-orange-400" />
              </div>
              <p className="text-3xl font-bold text-amber-600 flex items-center justify-center gap-1">{activeStreak}</p>
              <p className="text-[11px] text-amber-600 font-medium mt-1">Day Streak</p>
            </div>
          )}
        </div>
      </div>

      {/* Getting Started Progress Tracker */}
      {showGettingStarted && (
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-800">Getting Started</h2>
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
              {stepsCompleted} / {gettingStartedSteps.length} complete
            </span>
          </div>
          <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
              style={{ width: `${(stepsCompleted / gettingStartedSteps.length) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {gettingStartedSteps.map((step, i) => (
              <Link
                key={i}
                href={step.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  step.done
                    ? 'bg-white/80 text-green-700 border border-green-200'
                    : 'bg-white/60 text-gray-600 border border-gray-200 hover:bg-white hover:border-indigo-200 hover:text-indigo-700'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                )}
                <span className={step.done ? 'line-through opacity-70' : ''}>{step.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Summary Card */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-100 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          Weekly Summary
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/80 rounded-lg p-3 text-center border border-blue-100">
            <p className="text-2xl font-bold text-blue-600">{itemsLast7}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Items added this week</p>
          </div>
          <div className="bg-white/80 rounded-lg p-3 text-center border border-purple-100">
            <p className="text-2xl font-bold text-purple-600">{topics.filter((t: any) => new Date(t.updated_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">Topics updated</p>
          </div>
          <div className="bg-white/80 rounded-lg p-3 text-center border border-indigo-100">
            <p className="text-2xl font-bold text-indigo-600">{aiRuns.length}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">AI runs performed</p>
          </div>
        </div>
      </div>

      {/* Connected Sources */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Connected Sources</h2>
          {(!hasGoogle || !hasSlack || !hasNotion) && (
            <Link href="/settings" className="text-xs text-blue-600 hover:underline font-medium">Connect more &rarr;</Link>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { connected: hasGoogle, icon: 'gmail', label: 'Email', color: 'border-red-200 bg-red-50 text-red-700', sourceKey: 'gmail' },
            { connected: hasGoogle, icon: 'calendar', label: 'Calendar', color: 'border-blue-200 bg-blue-50 text-blue-700', sourceKey: 'calendar' },
            { connected: hasGoogle, icon: 'drive', label: 'Drive', color: 'border-amber-200 bg-amber-50 text-amber-700', sourceKey: 'drive' },
            { connected: hasSlack, icon: 'slack', label: 'Slack', color: 'border-purple-200 bg-purple-50 text-purple-700', sourceKey: 'slack' },
            { connected: hasNotion, icon: 'notion', label: 'Notion', color: 'border-gray-300 bg-gray-50 text-gray-700', sourceKey: 'notion' },
          ].map((s) => (
            <div key={s.label} className={`inline-flex flex-col items-start px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              s.connected ? s.color : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
              <span className="inline-flex items-center gap-1.5">
                <DashSourceIcon source={s.icon} className="w-3.5 h-3.5" /> {s.label}
                {s.connected ? (
                  <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse-dot" />
                ) : (
                  <span className="text-[10px] text-gray-400 ml-1">--</span>
                )}
              </span>
              {s.connected && lastSyncBySource[s.sourceKey] && (
                <span className="text-[10px] opacity-60 mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> {formatRelativeDate(lastSyncBySource[s.sourceKey])}
                  {itemsThisWeekBySource[s.sourceKey] && (
                    <span className="ml-1 opacity-80">&middot; {itemsThisWeekBySource[s.sourceKey]} this week</span>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Agents */}
      <div id="ai-agents" className="mb-8 scroll-mt-8">
        <DashboardAgents />
      </div>

      {/* Recent Activity Feed */}
      {(recentItems.length > 0 || aiRuns.length > 0 || topics.length > 0) && (
        <div className="mb-8 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
            Recent Activity
          </h2>
          <div className="relative pl-6 space-y-3">
            {[
              ...topics
                .filter((t: any) => new Date(t.updated_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                .slice(0, 3)
                .map((t: any) => ({ type: 'topic' as const, title: `Updated topic: ${t.title}`, date: t.updated_at, href: `/topics/${t.id}` })),
              ...recentItems
                .slice(0, 3)
                .map((item: any) => ({ type: 'item' as const, title: `New item: ${decodeHtmlEntities(item.title)}`, date: item.created_at, href: item.topic_id ? `/topics/${item.topic_id}` : '/search' })),
              ...aiRuns
                .slice(0, 2)
                .map((run: any) => ({ type: 'ai' as const, title: `AI ${agentKindLabel(run.kind)}: ${run.input_summary || 'completed'}`, date: run.created_at, href: run.topic_id ? `/topics/${run.topic_id}` : '#' })),
            ]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((entry, i, arr) => (
                <div key={`${entry.type}-${i}`} className="relative">
                  <div className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                    entry.type === 'topic' ? 'bg-blue-400' : entry.type === 'item' ? 'bg-emerald-400' : 'bg-purple-400'
                  }`} />
                  {i < arr.length - 1 && <div className="absolute -left-[19px] top-3.5 w-0.5 h-full bg-gray-100" />}
                  <Link href={entry.href} className="group block">
                    <p className="text-xs font-medium text-gray-700 group-hover:text-blue-600 transition-colors truncate">{entry.title}</p>
                    <p className="text-[11px] text-gray-400">{formatSmartDate(entry.date)}</p>
                  </Link>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Topics - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><FolderKanban className="w-5 h-5 text-blue-500" /> Active Topics</h2>
              <Link href="/topics" className="text-sm text-blue-600 hover:underline font-medium">View all &rarr;</Link>
            </div>
            {topics.length === 0 && totalItems === 0 ? (
              <div className="p-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-lg text-white text-center">
                <div className="w-16 h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-5">
                  <Rocket className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Welcome to YouOS</h2>
                <p className="text-blue-100 max-w-md mx-auto mb-6">
                  Your personal operating system for knowledge. Connect your sources, create topics, and let AI help you stay on top of everything.
                </p>
                <Link
                  href="/topics"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-700 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all shadow-md"
                >
                  <Plus className="w-5 h-5" /> Create your first topic
                </Link>
              </div>
            ) : topics.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/topics" className="group p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all text-center">
                  <div className="w-12 h-12 mx-auto bg-blue-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                    <Plus className="w-6 h-6 text-blue-500" />
                  </div>
                  <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">Create your first topic</p>
                  <p className="text-sm text-gray-400 mt-1">Organize your work, ideas, and projects into focused topics</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 font-medium">
                    Get started <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
                <Link href="/settings" className="group p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all text-center">
                  <div className="w-12 h-12 mx-auto bg-emerald-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                    <LinkIcon className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">Connect a source</p>
                  <p className="text-sm text-gray-400 mt-1">Link Gmail, Slack, Notion, or Google Drive to import content</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm text-emerald-600 font-medium">
                    Connect <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
                <Link href="/search" className="group p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-purple-200 hover:shadow-md transition-all text-center">
                  <div className="w-12 h-12 mx-auto bg-purple-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
                    <Search className="w-6 h-6 text-purple-500" />
                  </div>
                  <p className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">Search existing content</p>
                  <p className="text-sm text-gray-400 mt-1">Find emails, messages, and documents across all your sources</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-sm text-purple-600 font-medium">
                    Search <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {topics.map((topic: any) => {
                  const itemCount = topic.topic_items?.[0]?.count || 0;
                  const overdue = topic.due_date && new Date(topic.due_date) < new Date();
                  const progress = topic.progress_percent;
                  const health = getTopicHealthScore(
                    { updated_at: topic.updated_at, description: topic.description, due_date: topic.due_date, tags: topic.tags ?? [], progress_percent: topic.progress_percent },
                    itemCount
                  );
                  return (
                    <Link key={topic.id} href={`/topics/${topic.id}`}
                      className={`block p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all shadow-sm group border-l-4 ${areaBorderColor(topic.area)}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={healthDotClass(health.color)} title={`Health: ${health.label} (${health.score}%)`} />
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{topic.title}</h3>
                            {(topic.priority ?? 0) >= 4 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md font-bold uppercase">Urgent</span>
                            )}
                            {(topic.priority ?? 0) === 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold uppercase">High</span>
                            )}
                          </div>
                          {topic.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{topic.description}</p>}
                          <div className="flex gap-2 mt-2.5 flex-wrap items-center">
                            <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                              topic.area === 'work' ? 'bg-blue-100 text-blue-700' :
                              topic.area === 'personal' ? 'bg-green-100 text-green-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>{topic.area}</span>
                            {itemCount > 0 && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Paperclip className="w-3 h-3" /> {itemCount} item{itemCount !== 1 ? 's' : ''}
                              </span>
                            )}
                            {topic.due_date && (
                              <span className={`text-xs px-2 py-0.5 rounded-lg ${
                                overdue ? 'bg-red-600 text-white font-semibold' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {formatDueRelative(topic.due_date)}
                              </span>
                            )}
                            {topic.summary && (
                              <span className="text-xs px-2 py-0.5 rounded-lg bg-purple-50 text-purple-600 font-medium flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> AI analyzed
                              </span>
                            )}
                          </div>
                          {/* Progress bar */}
                          {progress != null && progress > 0 && (
                            <div className="mt-2.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : progress >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.min(progress, 100)}%` }} />
                              </div>
                              <span className="text-[11px] text-gray-400 font-medium">{progress}%</span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 ml-3 flex-shrink-0 flex items-center gap-1.5">
                          {formatSmartDate(topic.updated_at)}
                          {new Date(topic.updated_at) < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-semibold">Stale</span>
                          )}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Activity */}
          {aiRuns.length > 0 ? (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-purple-500" /> Recent AI Activity</h2>
              <div className="space-y-2">
                {aiRuns.map((run: any) => (
                  <div key={run.id} className="p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-purple-200 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        run.kind === 'ai_find' ? 'bg-blue-50' : run.kind === 'analyze_topic' ? 'bg-purple-50' : 'bg-indigo-50'
                      }`}>
                        {run.kind === 'ai_find' ? <Search className="w-4 h-4 text-blue-500" /> : run.kind === 'analyze_topic' ? <Sparkles className="w-4 h-4 text-purple-500" /> : <Zap className="w-4 h-4 text-indigo-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {run.kind === 'ai_find' ? 'AI Find' : run.kind === 'analyze_topic' ? 'AI Analysis' : run.kind.replace(/_/g, ' ')}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                            run.kind === 'ai_find' ? 'bg-blue-100 text-blue-700' :
                            run.kind === 'analyze_topic' ? 'bg-purple-100 text-purple-700' :
                            run.kind === 'daily_briefing' ? 'bg-indigo-100 text-indigo-700' :
                            run.kind === 'weekly_review' ? 'bg-green-100 text-green-700' :
                            run.kind === 'action_items' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {agentKindLabel(run.kind)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-500 truncate">{run.input_summary}</p>
                          {run.topic_id && (run.topics as unknown as { title: string } | null)?.title && (
                            <Link
                              href={`/topics/${run.topic_id}`}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium hover:bg-blue-100 transition-colors flex-shrink-0"
                            >
                              <FolderKanban className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{(run.topics as unknown as { title: string }).title}</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                          {run.tokens_used ? <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> {run.tokens_used.toLocaleString()} tokens</span> : null}
                          <span>{formatSmartDate(run.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Empty state for AI runs: call-to-action card */
            <div className="p-6 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-xl border border-purple-100 shadow-sm text-center">
              <div className="w-12 h-12 mx-auto bg-white rounded-xl flex items-center justify-center mb-3 shadow-sm">
                <Brain className="w-6 h-6 text-purple-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">No AI runs yet</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
                Let AI analyze your topics, find relevant items, or generate a daily briefing to get started.
              </p>
              <Link
                href="#ai-agents"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4" /> Run your first AI agent
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Newspaper className="w-5 h-5 text-emerald-500" /> Recent Items</h2>
            {recentItems.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 mx-auto bg-gray-50 rounded-lg flex items-center justify-center mb-2">
                  <Newspaper className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-400 font-medium">No recent activity</p>
                <p className="text-xs text-gray-300 mt-1">Connect sources to see items here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentItems.map((item: any) => {
                  const topicTitle = (item.topics as unknown as { title: string } | null)?.title;
                  return (
                    <Link
                      key={item.id}
                      href={item.topic_id ? `/topics/${item.topic_id}` : '/search'}
                      className="block p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all shadow-sm group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ring-inset ${
                          item.source === 'gmail' ? 'bg-red-50 ring-red-200' :
                          item.source === 'calendar' ? 'bg-blue-50 ring-blue-200' :
                          item.source === 'drive' ? 'bg-amber-50 ring-amber-200' :
                          item.source === 'slack' ? 'bg-purple-50 ring-purple-200' :
                          item.source === 'notion' ? 'bg-gray-50 ring-gray-200' :
                          item.source === 'manual' ? 'bg-green-50 ring-green-200' :
                          item.source === 'link' ? 'bg-cyan-50 ring-cyan-200' :
                          'bg-gray-50 ring-gray-200'
                        }`}>
                          <DashSourceIcon source={item.source} className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">{decodeHtmlEntities(item.title)}</p>
                          <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
                            <span className={`truncate px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.source === 'gmail' ? 'bg-red-50 text-red-600' :
                              item.source === 'slack' ? 'bg-purple-50 text-purple-600' :
                              item.source === 'calendar' ? 'bg-blue-50 text-blue-600' :
                              item.source === 'drive' ? 'bg-amber-50 text-amber-600' :
                              item.source === 'notion' ? 'bg-gray-100 text-gray-600' :
                              'bg-gray-50 text-gray-500'
                            }`}>
                              {sourceLabel(item.source)}
                            </span>
                            <span className="truncate">{topicTitle || 'Unlinked'}</span>
                            <span className="flex-shrink-0">{formatRelativeDate(item.occurred_at)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {/* View all items link */}
                <Link
                  href="/search"
                  className="block text-center py-2.5 text-sm text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50/50 rounded-lg transition-colors"
                >
                  View all items &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* Source breakdown */}
          {Object.keys(sourceCounts).length > 0 && (
            <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><PieChart className="w-4 h-4 text-blue-500" /> Items by Source</h3>
              <div className="space-y-3">
                {(Object.entries(sourceCounts) as [string, number][]).sort(([,a], [,b]) => b - a).map(([src, count]) => {
                  const pct = totalSourceCount > 0 ? (count / totalSourceCount * 100) : 0;
                  return (
                    <div key={src}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <DashSourceIcon source={src} className="w-3.5 h-3.5" /> {sourceLabel(src)}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                          {count}
                          <span className="text-[10px] font-medium text-gray-400">({Math.round(pct)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barGradient(src)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
