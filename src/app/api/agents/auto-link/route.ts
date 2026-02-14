import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AutoLinkAgent } from '@/lib/agents/auto-link';

export const maxDuration = 120; // Allow up to 2 minutes for AI processing

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { topic_id?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!body.topic_id) {
      return NextResponse.json({ error: 'topic_id is required' }, { status: 400 });
    }

    const agent = new AutoLinkAgent();
    const result = await agent.execute(user.id, 'manual', { topic_id: body.topic_id });

    return NextResponse.json(result.output);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('AutoLink API error:', message);
    return NextResponse.json(
      { error: message, items_scanned: 0, items_linked: 0 },
      { status: 500 },
    );
  }
}
