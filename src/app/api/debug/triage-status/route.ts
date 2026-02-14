import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Count items by triage_status
  const { data: allItems, error } = await supabase
    .from('items')
    .select('triage_status')
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const item of allItems ?? []) {
    const status = item.triage_status ?? 'NULL';
    counts[status] = (counts[status] || 0) + 1;
  }

  // Also check if items have bodies
  const { data: withBody } = await supabase
    .from('items')
    .select('id')
    .eq('user_id', user.id)
    .not('body', 'is', null)
    .limit(1);

  const { count: totalCount } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return NextResponse.json({
    total_items: totalCount,
    triage_status_counts: counts,
    has_items_with_body: (withBody?.length ?? 0) > 0,
    user_id: user.id,
    message: counts['NULL']
      ? `⚠️ ${counts['NULL']} items have NULL triage_status. Run: UPDATE public.items SET triage_status = 'pending' WHERE triage_status IS NULL;`
      : '✅ No items with NULL triage_status',
  });
}
