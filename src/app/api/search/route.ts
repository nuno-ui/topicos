import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchAllSources } from '@/lib/search';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { query, sources = ['gmail', 'calendar', 'drive', 'slack'], topic_id, date_from, date_to, max_results } = body;
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    const results = await searchAllSources(user.id, { query, sources, topic_id, date_from, date_to, max_results });
    return NextResponse.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
