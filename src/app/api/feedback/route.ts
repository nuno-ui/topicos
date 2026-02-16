import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callClaudeJSON } from '@/lib/ai/provider';

/*
 * SQL Migration — run this in Supabase SQL editor before using this API:
 *
 * CREATE TABLE IF NOT EXISTS feedback (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   type text NOT NULL CHECK (type IN ('bug', 'improvement', 'idea')),
 *   title text NOT NULL,
 *   description text NOT NULL,
 *   page text,
 *   ai_analysis jsonb,
 *   status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'implemented', 'dismissed')),
 *   priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
 *   created_at timestamptz DEFAULT now(),
 *   updated_at timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX idx_feedback_user_id ON feedback(user_id);
 * CREATE INDEX idx_feedback_status ON feedback(status);
 * CREATE INDEX idx_feedback_type ON feedback(type);
 *
 * ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can view own feedback"
 *   ON feedback FOR SELECT
 *   USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert own feedback"
 *   ON feedback FOR INSERT
 *   WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can update own feedback"
 *   ON feedback FOR UPDATE
 *   USING (auth.uid() = user_id);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIAnalysis {
  category: string;
  priority: string;
  technical_summary: string;
  suggested_fix: string;
}

// ---------------------------------------------------------------------------
// GET — fetch all feedback for the authenticated user
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      // Gracefully handle missing feedback table (migration not yet run)
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ feedback: [], table_missing: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feedback: data ?? [] });
  } catch (err) {
    console.error('GET /api/feedback error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create new feedback entry with AI analysis
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { type, title, description, page } = body;

    // Validation
    if (!type || !['bug', 'improvement', 'idea'].includes(type)) {
      return NextResponse.json({ error: 'Type must be bug, improvement, or idea' }, { status: 400 });
    }
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      return NextResponse.json({ error: 'Title must be at least 2 characters' }, { status: 400 });
    }
    if (title.trim().length > 255) {
      return NextResponse.json({ error: 'Title must be 255 characters or less' }, { status: 400 });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return NextResponse.json({ error: 'Description must be at least 5 characters' }, { status: 400 });
    }

    // AI analysis
    const systemPrompt = `You are a software engineering assistant analyzing user feedback for a web application called YouOS (a personal AI-powered life operating system built with Next.js 16, React 19, Supabase, and Tailwind CSS).

Analyze the user's feedback and provide a structured analysis. Return a JSON object with these fields:
- "category": one of "UI", "performance", "data", "integration", "security", "UX"
- "priority": one of "low", "medium", "high", "critical"
- "technical_summary": a concise 1-2 sentence technical summary of the issue or suggestion
- "suggested_fix": a concise 1-3 sentence description of the potential fix or implementation approach`;

    const userPrompt = `Feedback type: ${type}
Title: ${title.trim()}
Description: ${description.trim()}
Page: ${page || 'Unknown'}`;

    let aiAnalysis: AIAnalysis | null = null;
    let aiPriority = 'medium';

    try {
      const { data: analysisData } = await callClaudeJSON<AIAnalysis>(systemPrompt, userPrompt, {
        maxTokens: 512,
      });
      aiAnalysis = analysisData;
      // Use AI-suggested priority if valid
      if (['low', 'medium', 'high', 'critical'].includes(analysisData.priority)) {
        aiPriority = analysisData.priority;
      }
    } catch (aiErr) {
      console.error('AI analysis failed (proceeding without):', aiErr);
      // Continue without AI analysis — it's not critical
    }

    // Insert feedback
    const { data: feedback, error } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        type: type.trim(),
        title: title.trim(),
        description: description.trim(),
        page: page || null,
        ai_analysis: aiAnalysis,
        status: 'new',
        priority: aiPriority,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log AI run if analysis succeeded
    if (aiAnalysis) {
      await supabase.from('ai_runs').insert({
        user_id: user.id,
        kind: 'feedback_analysis',
        model: 'claude-sonnet-4-5-20250929',
        input_summary: `Analyzed ${type}: "${title.trim()}"`,
        output_json: aiAnalysis,
        tokens_used: 0, // callClaudeJSON doesn't expose tokensUsed in the same way
      }).then(() => {}, () => {}); // Fire-and-forget; ignore errors
    }

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (err) {
    console.error('POST /api/feedback error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
