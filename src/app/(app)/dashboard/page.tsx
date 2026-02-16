import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { sourceColor, sourceLabel, formatRelativeDate } from '@/lib/utils';
import { Zap, Clock, BarChart3, FolderKanban, Newspaper, PieChart, Mail, Calendar, FileText, MessageSquare, BookOpen, StickyNote, Link2, File, Search, Users, Plus, Sparkles, Paperclip } from 'lucide-react';
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

  const [topicsRes, googleRes, slackRes, notionRes, recentItemsRes, aiRunsRes, allItemsCountRes] = await Promise.all([
    supabase
      .from('topics')
      .select('*, topic_items(count)')
      .eq('user_id', user!.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(10),
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
      .select('id, title, source, occurred_at, topic_id, topics(title)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10),
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
  ]);

  const topics = topicsRes.data ?? [];
  const googleAccounts = googleRes.data ?? [];
  const slackAccounts = slackRes.data ?? [];
  const notionAccounts = notionRes.data ?? [];
  const recentItems = recentItemsRes.data ?? [];
  const aiRuns = aiRunsRes.data ?? [];
  const totalItems = allItemsCountRes.count ?? 0;
  const hasGoogle = googleAccounts.length > 0;
  const hasSlack = slackAccounts.length > 0;
  const hasNotion = notionAccounts.length > 0;

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

  const sourceCounts = recentItems.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSourceCount = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8 max-w-6xl animate-fade-in">
      {/* Welcome + Stats */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {displayName}</h1>
          <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>{productivityTip().icon}</span>
            <span>{productivityTip().tip}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-center px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[90px]">
            <p className="text-2xl font-bold text-blue-600">{topics.length}</p>
            <p className="text-[11px] text-gray-500 font-medium">Active Topics</p>
          </div>
          <div className="text-center px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[90px]">
            <p className="text-2xl font-bold text-emerald-600">{totalItems}</p>
            <p className="text-[11px] text-gray-500 font-medium">Total Items</p>
          </div>
          <div className="text-center px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[90px]">
            <p className="text-2xl font-bold text-purple-600">{aiRuns.length}</p>
            <p className="text-[11px] text-gray-500 font-medium">AI Runs</p>
          </div>
          {aiRuns.length > 0 && (() => {
            const dates = new Set(aiRuns.map(r => new Date(r.created_at).toDateString()));
            const today = new Date();
            let streak = 0;
            for (let i = 0; i < 30; i++) {
              const d = new Date(today);
              d.setDate(d.getDate() - i);
              if (dates.has(d.toDateString())) streak++;
              else if (i > 0) break;
            }
            if (streak > 0) return (
              <div className="text-center px-4 py-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm min-w-[90px]">
                <p className="text-2xl font-bold text-amber-600">{streak}🔥</p>
                <p className="text-[11px] text-amber-600 font-medium">Day Streak</p>
              </div>
            );
            return null;
          })()}
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
            { connected: hasGoogle, icon: 'gmail', label: 'Email', color: 'border-red-200 bg-red-50 text-red-700' },
            { connected: hasGoogle, icon: 'calendar', label: 'Calendar', color: 'border-blue-200 bg-blue-50 text-blue-700' },
            { connected: hasGoogle, icon: 'drive', label: 'Drive', color: 'border-amber-200 bg-amber-50 text-amber-700' },
            { connected: hasSlack, icon: 'slack', label: 'Slack', color: 'border-purple-200 bg-purple-50 text-purple-700' },
            { connected: hasNotion, icon: 'notion', label: 'Notion', color: 'border-gray-300 bg-gray-50 text-gray-700' },
          ].map((s) => (
            <span key={s.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              s.connected ? s.color : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
              <DashSourceIcon source={s.icon} className="w-3.5 h-3.5" /> {s.label}
              {s.connected ? (
                <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse-dot" />
              ) : (
                <span className="text-[10px] text-gray-400 ml-1">--</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        <Link href="/topics" className="px-4 py-2.5 brand-gradient text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Topic
        </Link>
        <Link href="/search" className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" /> Search Sources
        </Link>
        <Link href="/contacts" className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" /> Contacts
        </Link>
      </div>

      {/* AI Agents */}
      <div className="mb-8">
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
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 mx-auto bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                  <FolderKanban className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-gray-500 font-medium">No topics yet</p>
                <p className="text-sm text-gray-400 mt-1">Create your first topic to get started</p>
                <Link href="/topics" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 brand-gradient text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all">
                  + Create topic
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
                                overdue ? 'bg-red-50 text-red-600 font-medium' : 'bg-gray-100 text-gray-500'
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
                        <p className="text-sm font-medium text-gray-900">
                          {run.kind === 'ai_find' ? 'AI Find' : run.kind === 'analyze_topic' ? 'AI Analysis' : run.kind.replace(/_/g, ' ')}
                        </p>
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
