import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CuratorAgent } from '@/lib/agents/curator';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = new CuratorAgent();
  const result = await agent.execute(user.id, 'manual');

  return NextResponse.json(result);
}
