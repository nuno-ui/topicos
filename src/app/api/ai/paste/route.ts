import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { analyzePaste } from '@/lib/ai/functions';
import { storeAiOutput } from '@/lib/ai/store';

const requestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(50000, 'Text is too long'),
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

  const { text } = parsed.data;

  // Fetch user's existing topics for matching
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, title, area')
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (topicsError) {
    return NextResponse.json(
      { error: topicsError.message },
      { status: 500 },
    );
  }

  const existingTopics = (topics ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    area: t.area,
  }));

  try {
    const result = await analyzePaste(text, existingTopics);

    // Create a manual item from the pasted text
    const serviceClient = createServiceClient();
    const snippet = text.length > 500 ? `${text.slice(0, 497)}...` : text;

    const { data: item, error: itemError } = await serviceClient
      .from('items')
      .insert({
        user_id: user.id,
        account_id: null,
        source: 'manual' as const,
        external_id: null,
        title: `Pasted text: ${snippet.slice(0, 100)}`,
        snippet,
        body: text,
        url: null,
        occurred_at: new Date().toISOString(),
        metadata: {
          paste_analysis: true,
          detected_area: result.data.detected_area,
        },
      })
      .select()
      .single();

    if (itemError) {
      console.error('[ai/paste] Failed to create item:', itemError.message);
      // Continue even if item creation fails -- the analysis is still valuable
    }

    // Store AI output
    await storeAiOutput({
      userId: user.id,
      kind: 'suggest_topics', // paste analysis is a superset of topic suggestion
      model: result.model,
      inputJson: { text, existingTopics },
      outputJson: result.data as unknown as Record<string, unknown>,
      tokensUsed: result.tokensUsed,
    });

    return NextResponse.json({
      analysis: result.data,
      item: item ?? null,
    });
  } catch (error) {
    console.error('[ai/paste] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Paste analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
