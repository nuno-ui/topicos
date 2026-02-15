import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { sourceIcon } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [topicsRes, googleRes, slackRes, recentItemsRes] = await Promise.all([
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
      .from('topic_items')
      .select('id, title, source, occurred_at, topic_id, topics(title)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const topics = topicsRes.data ?? [];
  const googleAccounts = googleRes.data ?? [];
  const slackAccounts = slackRes.data ?? [];
  const recentItems = recentItemsRes.data ?? [];
  const hasGoogle = googleAccounts.length > 0;
  const hasSlack = slackAccounts.length > 0;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-8 max-w-5xl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{greeting()}</h1>
        <p className="text-gray-500 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Connected Sources */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Connected Sources</h2>
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
          {!hasGoogle && !hasSlack && (
            <Link href="/settings" className="text-sm text-blue-600 hover:underline ml-2 self-center">Connect sources &rarr;</Link>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8">
        <Link href="/topics" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Topic
        </Link>
        <Link href="/search" className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Search Sources
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Topics - 2/3 width */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Topics</h2>
          {topics.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No topics yet</p>
              <Link href="/topics" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Create your first topic &rarr;</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((topic) => {
                const itemCount = topic.topic_items?.[0]?.count || 0;
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
                            <span className="text-xs text-gray-400">Due: {new Date(topic.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity - 1/3 width */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {recentItems.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
              <p className="text-sm text-gray-400">No recent activity</p>
              <p className="text-xs text-gray-300 mt-1">Link items to topics to see activity here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentItems.map((item) => (
                <div key={item.id} className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-start gap-2">
                    <span className="text-sm">{sourceIcon(item.source)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {(item.topics as unknown as { title: string } | null)?.title || 'Unknown topic'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
