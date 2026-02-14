import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CuratorAgent } from '@/lib/agents/curator';

export const maxDuration = 120; // Allow up to 2 minutes for AI processing

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agent = new CuratorAgent();
    const result = await agent.execute(user.id, 'manual');

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Curator API error:', message);
    return NextResponse.json(
      { success: false, error: message, output: {}, actions: [], tokensUsed: 0 },
      { status: 500 },
    );
  }
}
