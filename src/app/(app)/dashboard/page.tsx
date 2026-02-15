import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { sourceIcon, formatRelativeDate } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [topicsRes, googleRes, slackRes, notionRes, recentItemsRes, aiRunsRes] = await Promise.all([
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
  ]);

  const topics = topicsRes.data ?? [];
  const googleAccounts = googleRes.data ?? [];
  const slackAccounts = slackRes.data ?? [];
  const notionAccounts = notionRes.data ?? [];
  const recentItems = recentItemsRes.data ?? [];
  const aiRuns = aiRunsRes.data ?? [];
  const hasGoogle = googleAccounts.length > 0;
  const hasSlack = slackAccounts.length > 0;
  const hasNotion = notionAccounts.length > 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const sourceCounts = recentItems.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-8 max-w-6xl">
      {/* Welcome + Stats */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}</h1>
          <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{topics.length}</p>
            <p className="text-xs text-gray-500">Active Topics</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{recentItems.length}</p>
            <p className="text-xs text-gray-500">Recent Items</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{aiRuns.length}</p>
            <p className="text-xs text-gray-500">AI Runs</p>
          </div>
        </div>
      </div>

      {/* Connected Sources */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Connected Sources</h2>
          {(!hasGoogle || !hasSlack || !hasNotion) && (
            <Link href="/settings" className="text-xs text-blue-600 hover:underline">Connect more &rarr;</Link>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${hasGoogle ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {sourceIcon('gmail')} Email {hasGoogle ? '\u2713' : '\u2014'}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${hasGoogle ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {sourceIcon('calendar')} Calendar {hasGoogle ? '\u2713' : '\u2014'}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${hasGoogle ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {sourceIcon('drive')} Drive {hasGoogle ? '\u2713' : '\u2014'}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${hasSlack ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {sourceIcon('slack')} Slack {hasSlack ? '\u2713' : '\u2014'}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${hasNotion ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {sourceIcon('notion')} Notion {hasNotion ? '\u2713' : '\u2014'}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8">
        <Link href="/topics" className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + New Topic
        </Link>
        <Link href="/search" className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Search Sources
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Topics - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Topics</h2>
              <Link href="/topics" className="text-sm text-blue-600 hover:underline">View all &rarr;</Link>
            </div>
            {topics.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500">No topics yet</p>
                <Link href="/topics" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Create your first topic &rarr;</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {topics.map((topic) => {
                  const itemCount = topic.topic_items?.[0]?.count || 0;
                  const overdue = topic.due_date && new Date(topic.due_date) < new Date();
                  return (
                    <Link key={topic.id} href={`/topics/${topic.id}`}
                      className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                          {topic.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{topic.description}</p>}
                          <div className="flex gap-2 mt-2 flex-wrap items-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              topic.area === 'work' ? 'bg-blue-100 text-blue-700' :
                              topic.area === 'personal' ? 'bg-green-100 text-green-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>{topic.area}</span>
                            {itemCount > 0 && (
                              <span className="text-xs text-gray-400">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                            )}
                            {topic.due_date && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                overdue ? 'bg-red-50 text-red-600 font-medium' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {overdue ? 'Overdue: ' : 'Due: '}{new Date(topic.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {topic.summary && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">AI analyzed</span>
                            )}
                          </div>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent AI Activity</h2>
              <div className="space-y-2">
                {aiRuns.map((run) => (
                  <div key={run.id} className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-500 text-sm mt-0.5">
                        {run.kind === 'ai_find' ? '\uD83D\uDD0D' : run.kind === 'analyze_topic' ? '\uD83E\uDDE0' : '\uD83E\uDD16'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          {run.kind === 'ai_find' ? 'AI Find' : run.kind === 'analyze_topic' ? 'AI Analysis' : run.kind}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{run.input_summary}</p>
                        <div className="flex gap-2 mt-1 text-xs text-gray-400">
                          {run.tokens_used ? <span>{run.tokens_used.toLocaleString()} tokens</span> : null}
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Items</h2>
            {recentItems.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-400">No recent activity</p>
                <p className="text-xs text-gray-300 mt-1">Link items to topics to see activity here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentItems.map((item) => (
                  <div key={item.id} className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className="text-sm">{sourceIcon(item.source)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <div className="flex gap-2 mt-0.5 text-xs text-gray-400">
                          <span className="truncate">
                            {(item.topics as unknown as { title: string } | null)?.title || 'Unknown topic'}
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
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Items by Source</h3>
              <div className="space-y-2">
                {Object.entries(sourceCounts).sort(([,a], [,b]) => b - a).map(([src, count]) => (
                  <div key={src} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      {sourceIcon(src)} {src === 'gmail' ? 'Email' : src === 'calendar' ? 'Calendar' : src === 'drive' ? 'Drive' : src === 'slack' ? 'Slack' : src === 'notion' ? 'Notion' : src}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
