import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ContactIntelligenceAgent } from '@/lib/agents/contact-intelligence';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const agent = new ContactIntelligenceAgent();
  return NextResponse.json(await agent.execute(user.id, 'manual'));
}
