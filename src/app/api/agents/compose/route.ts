import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SmartComposeAgent } from '@/lib/agents/smart-compose';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const agent = new SmartComposeAgent();
  return NextResponse.json(await agent.execute(user.id, 'manual', body));
}
