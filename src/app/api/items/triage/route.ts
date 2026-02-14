import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// POST /api/items/triage - Update triage status for an item
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { item_id, triage_status } = body;

  if (!item_id || !triage_status) {
    return NextResponse.json({ error: 'item_id and triage_status are required' }, { status: 400 });
  }

  const validStatuses = ['pending', 'relevant', 'low_relevance', 'noise', 'archived'];
  if (!validStatuses.includes(triage_status)) {
    return NextResponse.json({ error: 'Invalid triage_status' }, { status: 400 });
  }

  const { error } = await supabase
    .from('items')
    .update({ triage_status })
    .eq('id', item_id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
