import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaudeJSON } from '@/lib/ai/provider';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { description, topic_title } = body;
    if (!description) return NextResponse.json({ error: 'Description is required' }, { status: 400 });

    const system = 'You are a helpful assistant that generates search queries for finding relevant emails, calendar events, files, and messages. Generate 3-5 search queries that would help find relevant items across Gmail, Google Calendar, Google Drive, and Slack.';
    const prompt = 'Generate search queries for: ' + (topic_title ? topic_title + ' - ' : '') + description;

    const { data } = await callClaudeJSON<{ queries: string[] }>(system, prompt);
    return NextResponse.json({ queries: data.queries });
  } catch (err) {
    console.error('AI find error:', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
