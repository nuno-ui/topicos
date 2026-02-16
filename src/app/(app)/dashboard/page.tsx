import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { sourceColor, sourceLabel, formatRelativeDate } from '@/lib/utils';
import { Zap, Clock, BarChart3, FolderKanban, Newspaper, PieChart, Mail, Calendar, FileText, MessageSquare, BookOpen, StickyNote, Link2, File, Search, Users, Plus, Sparkles, Paperclip, TrendingUp, TrendingDown, ArrowRight, Brain, Flame, LinkIcon } from 'lucide-react';
import { DashboardAgents } from '@/components/dashboard/dashboard-agents';

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

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [topicsRes, googleRes, slackRes, notionRes, recentItemsRes, aiRunsRes, allItemsCountRes, itemsLast7Res, itemsPrior7Res, streakItemsRes] = await Promise.all([
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
  ]);

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
  const hasGoogle = googleAccounts.length > 0;
  const hasSlack = slackAccounts.length > 0;
  const hasNotion = notionAccounts.length > 0;

  // Compute trend: positive means more items this week than last
  const itemsTrend = itemsLast7 - itemsPrior7;

  // Compute active streak: consecutive days with at least one topic_item created
  const activeStreak = (() => {
    if (streakItems.length === 0) return 0;
    const activeDays = new Set(streakItems.map(i => new Date(i.created_at).toDateString()));
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
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const productivityTip = () => {
    const tips = [
      { tip: 'Try using ⌘K to quickly navigate with the command palette', icon: '⌨️' },
      { tip: 'Link items to topics to build a knowledge graph of your work', icon: '🔗' },
      { tip: 'Use AI Find to automatically discover relevant items for your topics', icon: '🤖' },
      { tip: 'Run the Daily Briefing to get an AI summary of what matters today', icon: '📋' },
      { tip: 'Set due dates on topics to track deadlines and see urgency indicators', icon: '⏰' },
      { tip: 'Use keyboard shortcuts 1-5 to quickly navigate between sections', icon: '🚀' },
      { tip: 'Extract contacts from your topics to build your relationship network', icon: '👥' },
      { tip: 'Create folders to organize your topics into projects or categories', icon: '📁' },
    ];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    return tips[dayOfYear % tips.length];
  };

  // Memoize productivity tip so it's not recomputed on each reference
  const currentTip = productivityTip();

  const sourceCounts = recentItems.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSourceCount = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8 max-w-6xl animate-fade-in">
      {/* Quick Actions Bar */}
      <div className="mb-6 flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
        <Link href="/topics" className="px-4 py-2 brand-gradient text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Topic
        </Link>
        <Link href="/search" className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" /> Search
        </Link>
        <Link href="#ai-agents" className="px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg text-sm font-medium text-purple-700 hover:from-purple-100 hover:to-indigo-100 transition-all flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" /> AI Briefing
        </Link>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <span>{currentTip.icon}</span>
          <span>{currentTip.tip}</span>
        </div>
      </div>

      {/* Welcome + Stats */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {displayName}</h1>
          <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[100px]">
            <p className="text-3xl font-bold text-blue-600">{topics.length}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">Active Topics</p>
          </div>
          <div className="text-center px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[100px]">
            <p className="text-3xl font-bold text-emerald-600">{totalItems}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">Total Items</p>
            {itemsTrend !== 0 && (
              <div className={`flex items-center justify-center gap-0.5 mt-1 text-[10px] font-medium ${itemsTrend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {itemsTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{itemsTrend > 0 ? '+' : ''}{itemsTrend} this week</span>
              </div>
            )}
          </div>
          <div className="text-center px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[100px]">
            <p className="text-3xl font-bold text-purple-600">{aiRuns.length}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-1">AI Runs</p>
          </div>
          {activeStreak > 0 && (
            <div className="text-center px-5 py-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm min-w-[100px]">
              <p className="text-3xl font-bold text-amber-600 flex items-center justify-center gap-1">{activeStreak} <Flame className="w-5 h-5 text-orange-500" /></p>
              <p className="text-[11px] text-amber-600 font-medium mt-1">Day Streak</p>
            </div>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Topics - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><FolderKanban className="w-5 h-5 text-blue-500" /> Active Topics</h2>
              <Link href="/topics" className="text-sm text-blue-600 hover:underline font-medium">View all &rarr;</Link>
            </div>
            {topics.length === 0 ? (
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
                {topics.map((topic) => {
                  const itemCount = topic.topic_items?.[0]?.count || 0;
                  const overdue = topic.due_date && new Date(topic.due_date) < new Date();
                  const progress = topic.progress_percent;
                  return (
                    <Link key={topic.id} href={`/topics/${topic.id}`}
                      className="block p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all shadow-sm group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{topic.title}</h3>
                            {topic.priority >= 4 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md font-bold uppercase">Urgent</span>
                            )}
                            {topic.priority === 3 && (
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
                                {overdue ? 'Overdue: ' : 'Due: '}{new Date(topic.due_date).toLocaleDateString()}
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
                        <span className="text-xs text-gray-400 ml-3 flex-shrink-0">{formatRelativeDate(topic.updated_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Activity */}
          {aiRuns.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-purple-500" /> Recent AI Activity</h2>
              <div className="space-y-2">
                {aiRuns.map((run) => (
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
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{run.input_summary}</p>
                        <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                          {run.tokens_used ? <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> {run.tokens_used.toLocaleString()} tokens</span> : null}
                          <span>{formatRelativeDate(run.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                {recentItems.map((item) => (
                  <div key={item.id} className="p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${sourceColor(item.source)}`}>
                        <DashSourceIcon source={item.source} className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
                          <span className="truncate">
                            {(item.topics as unknown as { title: string } | null)?.title || 'Unlinked'}
                          </span>
                          <span className="flex-shrink-0">{formatRelativeDate(item.occurred_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source breakdown */}
          {Object.keys(sourceCounts).length > 0 && (
            <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><PieChart className="w-4 h-4 text-blue-500" /> Items by Source</h3>
              <div className="space-y-3">
                {Object.entries(sourceCounts).sort(([,a], [,b]) => b - a).map(([src, count]) => {
                  const pct = totalSourceCount > 0 ? (count / totalSourceCount * 100) : 0;
                  const barColor = src === 'gmail' ? 'bg-red-400' : src === 'calendar' ? 'bg-blue-400' : src === 'drive' ? 'bg-amber-400' : src === 'slack' ? 'bg-purple-400' : src === 'notion' ? 'bg-gray-400' : src === 'manual' ? 'bg-green-400' : src === 'link' ? 'bg-cyan-400' : 'bg-gray-300';
                  return (
                    <div key={src}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          <DashSourceIcon source={src} className="w-3.5 h-3.5" /> {sourceLabel(src)}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
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
