import { createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', user!.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(10);

  const { data: googleAccounts } = await supabase
    .from('google_accounts')
    .select('id, email')
    .eq('user_id', user!.id);

  const { data: slackAccounts } = await supabase
    .from('slack_accounts')
    .select('id, team_name')
    .eq('user_id', user!.id);

  const hasGoogle = (googleAccounts?.length ?? 0) > 0;
  const hasSlack = (slackAccounts?.length ?? 0) > 0;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back</p>
      </div>

      {/* Connected Sources */}
      <div className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Connected Sources</h2>
        <div className="flex gap-3">
          <span className={hasGoogle ? "px-3 py-1 rounded-full text-sm bg-green-100 text-green-700" : "px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-500"}>
            Email {hasGoogle ? '✓' : '—'}
          </span>
          <span className={hasGoogle ? "px-3 py-1 rounded-full text-sm bg-green-100 text-green-700" : "px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-500"}>
            Calendar {hasGoogle ? '✓' : '—'}
          </span>
          <span className={hasSlack ? "px-3 py-1 rounded-full text-sm bg-green-100 text-green-700" : "px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-500"}>
            Slack {hasSlack ? '✓' : '—'}
          </span>
          {!hasGoogle && !hasSlack && (
            <Link href="/settings" className="text-sm text-blue-600 hover:underline ml-2">Connect sources →</Link>
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

      {/* Active Topics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Topics</h2>
        {(!topics || topics.length === 0) ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No topics yet</p>
            <Link href="/topics" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Create your first topic →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topics.map((topic) => (
              <Link key={topic.id} href={'/topics/' + topic.id} className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{topic.title}</h3>
                    {topic.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{topic.description}</p>}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{topic.area}</span>
                </div>
                {topic.due_date && (
                  <p className="text-xs text-gray-400 mt-2">Due: {new Date(topic.due_date).toLocaleDateString()}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
