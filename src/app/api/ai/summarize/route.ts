import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { summarizeTopic } from '@/lib/ai/functions';
import { storeAiOutput } from '@/lib/ai/store';

const requestSchema = z.object({
  topic_id: z.string().uuid('topic_id must be a valid UUID'),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { topic_id } = parsed.data;

  // Fetch the topic (RLS ensures it belongs to the user)
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topic_id)
    .single();

  if (topicError || !topic) {
    return NextResponse.json(
      { error: 'Topic not found' },
      { status: 404 },
    );
  }

  // Fetch linked items via topic_links
  const { data: topicLinks, error: linksError } = await supabase
    .from('topic_links')
    .select('item_id')
    .eq('topic_id', topic_id);

  if (linksError) {
    return NextResponse.json(
      { error: linksError.message },
      { status: 500 },
    );
  }

  const itemIds = (topicLinks ?? []).map((link) => link.item_id);

  if (itemIds.length === 0) {
    return NextResponse.json(
      { error: 'No items linked to this topic. Link some items first.' },
      { status: 400 },
    );
  }

  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('title, snippet, source, occurred_at')
    .in('id', itemIds)
    .order('occurred_at', { ascending: false });

  if (itemsError) {
    return NextResponse.json(
      { error: itemsError.message },
      { status: 500 },
    );
  }

  // Call the AI function
  const itemsForAi = (items ?? []).map((item) => ({
    title: item.title,
    snippet: item.snippet ?? '',
    source: item.source,
    occurred_at: item.occurred_at,
  }));

  try {
    const result = await summarizeTopic(itemsForAi);

    // Update the topic summary using service client (bypasses RLS for server-side update)
    const serviceClient = createServiceClient();
    const { error: updateError } = await serviceClient
      .from('topics')
      .update({ summary: result.data.summary })
      .eq('id', topic_id)
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update topic summary: ${updateError.message}` },
        { status: 500 },
      );
    }

    // Store AI output
    await storeAiOutput({
      userId: user.id,
      kind: 'summarize_topic',
      model: result.model,
      inputJson: { topic_id, items: itemsForAi },
      outputJson: result.data as unknown as Record<string, unknown>,
      tokensUsed: result.tokensUsed,
    });

    return NextResponse.json({
      summary: result.data.summary,
      key_points: result.data.key_points,
      risks: result.data.risks,
      next_steps: result.data.next_steps,
    });
  } catch (error) {
    console.error('[ai/summarize] Error:', error);
    const message =
      error instanceof Error ? error.message : 'AI summarization failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
