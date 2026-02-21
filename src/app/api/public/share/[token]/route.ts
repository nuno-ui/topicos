import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Look up the share link
  const { data: shareLink, error: linkError } = await supabase
    .from('share_links')
    .select('*, contacts(name, email, organization)')
    .eq('token', token)
    .eq('is_active', true)
    .single();

  if (linkError || !shareLink) {
    return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
  }

  // Check expiration
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
  }

  const userId = shareLink.user_id;
  const area = shareLink.area || 'work';

  // Fetch all topics for this user in the specified area
  const { data: topics } = await supabase
    .from('topics')
    .select('*, topic_tasks(count)')
    .eq('user_id', userId)
    .eq('area', area)
    .order('updated_at', { ascending: false });

  // Fetch all folders
  const { data: folders } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  // Fetch all tasks for these topics
  const topicIds = (topics || []).map((t: { id: string }) => t.id);
  let allTasks: Record<string, unknown>[] = [];
  if (topicIds.length > 0) {
    const { data: tasks } = await supabase
      .from('topic_tasks')
      .select('*')
      .in('topic_id', topicIds)
      .in('status', ['pending', 'in_progress', 'completed'])
      .order('position', { ascending: true });
    allTasks = tasks || [];
  }

  // If there's a contact, find their assigned tasks and linked topics
  let contactTopics: string[] = [];
  let contactTasks: Record<string, unknown>[] = [];
  const contactName = shareLink.contacts?.name || shareLink.label || 'Recipient';

  if (shareLink.contact_id) {
    // Get contact_topic_links
    const { data: links } = await supabase
      .from('contact_topic_links')
      .select('topic_id')
      .eq('contact_id', shareLink.contact_id);
    contactTopics = (links || []).map((l: { topic_id: string }) => l.topic_id);

    // Get tasks assigned to this contact
    contactTasks = allTasks.filter(
      (t: Record<string, unknown>) => t.assignee_contact_id === shareLink.contact_id
    );

    // Add topic IDs from assigned tasks
    contactTasks.forEach((t: Record<string, unknown>) => {
      if (t.topic_id && !contactTopics.includes(t.topic_id as string)) {
        contactTopics.push(t.topic_id as string);
      }
    });
  }

  // Fetch comments for this share link
  const { data: comments } = await supabase
    .from('share_comments')
    .select('*')
    .eq('share_link_id', shareLink.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    shareLink: {
      id: shareLink.id,
      label: shareLink.label,
      area: shareLink.area,
      contact_id: shareLink.contact_id,
      contactName,
    },
    topics: topics || [],
    folders: folders || [],
    tasks: allTasks,
    contactTopicIds: contactTopics,
    contactTaskIds: contactTasks.map((t: Record<string, unknown>) => t.id),
    comments: comments || [],
  });
}
