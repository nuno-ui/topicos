import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AgentsClient } from '@/components/agents/agents-client';

export default async function AgentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: agentRuns } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(50);

  return <AgentsClient runs={agentRuns ?? []} />;
}
