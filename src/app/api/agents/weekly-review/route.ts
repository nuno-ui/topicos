import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { WeeklyReviewAgent } from '@/lib/agents/weekly-review';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const agent = new WeeklyReviewAgent();
  return NextResponse.json(await agent.execute(user.id, 'manual'));
}
