import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Verify the share link exists and is active
  const { data: shareLink } = await supabase
    .from('share_links')
    .select('id, is_active, expires_at')
    .eq('token', token)
    .eq('is_active', true)
    .single();

  if (!shareLink) {
    return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
  }

  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
  }

  const body = await request.json();
  const { author_name, body: commentBody, topic_id, task_id } = body;

  if (!author_name || !commentBody) {
    return NextResponse.json({ error: 'author_name and body are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('share_comments')
    .insert({
      share_link_id: shareLink.id,
      author_name,
      body: commentBody,
      topic_id: topic_id || null,
      task_id: task_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comment: data }, { status: 201 });
}
