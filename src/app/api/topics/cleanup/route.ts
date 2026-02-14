import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get all active topics
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (!topics || topics.length === 0) {
    return NextResponse.json({ merged: 0, deleted: 0, remaining: 0 });
  }

  // Group by normalized title (case-insensitive)
  const groups: Record<string, typeof topics> = {};
  for (const t of topics) {
    const key = t.title.trim().toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  let merged = 0;
  let deleted = 0;

  for (const [, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;

    // Keep the first (oldest) topic, merge others into it
    const keeper = group[0];
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      // Move topic_links from duplicate to keeper (ignore conflicts)
      const { data: dupLinks } = await supabase
        .from('topic_links')
        .select('id, item_id')
        .eq('topic_id', dup.id)
        .eq('user_id', user.id);

      for (const link of dupLinks ?? []) {
        // Check if keeper already has this item linked
        const { data: existing } = await supabase
          .from('topic_links')
          .select('id')
          .eq('topic_id', keeper.id)
          .eq('item_id', link.item_id)
          .limit(1);

        if (existing && existing.length > 0) {
          // Duplicate link — just delete it
          await supabase.from('topic_links').delete().eq('id', link.id);
        } else {
          // Move link to keeper
          await supabase.from('topic_links').update({ topic_id: keeper.id }).eq('id', link.id);
        }
      }

      // Move tasks from duplicate to keeper
      await supabase
        .from('tasks')
        .update({ topic_id: keeper.id })
        .eq('topic_id', dup.id);

      // Delete the duplicate topic
      await supabase
        .from('topics')
        .delete()
        .eq('id', dup.id)
        .eq('user_id', user.id);

      deleted++;
    }
    merged++;
  }

  return NextResponse.json({
    merged,
    deleted,
    remaining: topics.length - deleted,
  });
}
