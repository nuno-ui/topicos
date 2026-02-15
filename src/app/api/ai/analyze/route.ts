import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaude } from '@/lib/ai/provider';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { topic_id, question } = body;
    if (!topic_id) return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 });

    // Get topic and items
    const { data: topic } = await supabase.from('topics').select('*').eq('id', topic_id).eq('user_id', user.id).single();
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

    const { data: items } = await supabase.from('topic_items').select('*').eq('topic_id', topic_id).order('occurred_at', { ascending: false });

    const system = 'You are a helpful assistant that analyzes topics and their linked items (emails, calendar events, files, messages). Provide concise, actionable insights.';
    const context = 'Topic: ' + topic.title + '\nDescription: ' + (topic.description || 'None') + '\n\nLinked Items:\n' + (items || []).map((item: Record<string, unknown>, i: number) => (i + 1) + '. [' + item.source + '] ' + item.title + ': ' + item.snippet).join('\n');

    const prompt = context + '\n\nQuestion: ' + (question || 'Provide a summary and key insights about this topic.');

    const { text } = await callClaude(system, prompt);
    return NextResponse.json({ analysis: text });
  } catch (err) {
    console.error('AI analyze error:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
