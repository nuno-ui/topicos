import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, contact_topic_links(topic_id)')
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (!contacts || contacts.length === 0) {
    return new NextResponse('No contacts to export', { status: 404 });
  }

  // Build CSV
  const headers = ['Name', 'Email', 'Organization', 'Role', 'Area', 'Notes', 'Topics Count', 'Last Interaction', 'Interaction Count', 'Phone', 'Created At'];
  const rows = contacts.map(c => {
    const meta = c.metadata || {};
    return [
      escapeCSV(c.name || ''),
      escapeCSV(c.email || ''),
      escapeCSV(c.organization || ''),
      escapeCSV(c.role || ''),
      escapeCSV(c.area || ''),
      escapeCSV(c.notes || ''),
      String(c.contact_topic_links?.length || 0),
      c.last_interaction_at ? new Date(c.last_interaction_at).toISOString().split('T')[0] : '',
      String(c.interaction_count || 0),
      escapeCSV((meta as Record<string, string>).phone || ''),
      c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="topicos_contacts_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
