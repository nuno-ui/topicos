import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getContactKnowledgeBase } from '@/lib/contacts/interaction-stats';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Verify contact exists and belongs to user
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    const kb = await getContactKnowledgeBase(supabase, user.id, contact, { limit, source, search });

    return NextResponse.json({
      contact,
      contactItems: kb.contactItems,
      topicItems: kb.topicItems,
      mentionItems: kb.mentionItems,
      allItems: kb.allItems,
      stats: kb.stats,
    });
  } catch (err) {
    console.error('GET /api/contacts/[id]/knowledge-base error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
