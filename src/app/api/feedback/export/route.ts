import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackRow {
  id: string;
  type: string;
  title: string;
  description: string;
  page: string | null;
  status: string;
  priority: string;
  ai_analysis: {
    category?: string;
    priority?: string;
    technical_summary?: string;
    suggested_fix?: string;
  } | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// GET — export all feedback as a structured Claude Code prompt
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (feedback ?? []) as FeedbackRow[];

    if (items.length === 0) {
      return new NextResponse('No feedback to export.', {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="youos-feedback-${today()}.md"`,
        },
      });
    }

    // Group by type
    const bugs = items.filter(f => f.type === 'bug');
    const improvements = items.filter(f => f.type === 'improvement');
    const ideas = items.filter(f => f.type === 'idea');

    // Group by status
    const byStatus: Record<string, FeedbackRow[]> = {};
    for (const item of items) {
      (byStatus[item.status] ??= []).push(item);
    }

    // Build the prompt
    const lines: string[] = [];

    lines.push('# YouOS Feedback Report');
    lines.push('');
    lines.push('## Project Context');
    lines.push('');
    lines.push('- **Application**: YouOS - AI-Powered Life Operating System');
    lines.push('- **Stack**: Next.js 16, React 19, Supabase (PostgreSQL + Auth), Tailwind CSS v4, TypeScript');
    lines.push('- **AI**: Anthropic Claude API via `@anthropic-ai/sdk`');
    lines.push('- **Integrations**: Google (Gmail, Calendar, Drive), Slack, Notion');
    lines.push(`- **Exported**: ${new Date().toISOString()}`);
    lines.push(`- **Total items**: ${items.length} (${bugs.length} bugs, ${improvements.length} improvements, ${ideas.length} ideas)`);
    lines.push('');

    // Stats summary
    lines.push('## Summary Statistics');
    lines.push('');
    lines.push(`| Status | Count |`);
    lines.push(`|--------|-------|`);
    for (const [status, group] of Object.entries(byStatus)) {
      lines.push(`| ${status} | ${group.length} |`);
    }
    lines.push('');

    const priorityCounts: Record<string, number> = {};
    for (const item of items) {
      priorityCounts[item.priority] = (priorityCounts[item.priority] ?? 0) + 1;
    }
    lines.push(`| Priority | Count |`);
    lines.push(`|----------|-------|`);
    for (const p of ['critical', 'high', 'medium', 'low']) {
      if (priorityCounts[p]) lines.push(`| ${p} | ${priorityCounts[p]} |`);
    }
    lines.push('');

    // Sections by type
    if (bugs.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## Bugs');
      lines.push('');
      lines.push('Please investigate and fix the following bugs:');
      lines.push('');
      for (const bug of bugs) {
        renderFeedbackItem(lines, bug);
      }
    }

    if (improvements.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## Improvements');
      lines.push('');
      lines.push('Please implement the following improvements:');
      lines.push('');
      for (const imp of improvements) {
        renderFeedbackItem(lines, imp);
      }
    }

    if (ideas.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## Ideas');
      lines.push('');
      lines.push('Consider the following feature ideas:');
      lines.push('');
      for (const idea of ideas) {
        renderFeedbackItem(lines, idea);
      }
    }

    // Section by status (actionable overview)
    lines.push('---');
    lines.push('');
    lines.push('## By Status');
    lines.push('');
    for (const status of ['new', 'reviewed', 'implemented', 'dismissed']) {
      const group = byStatus[status];
      if (!group || group.length === 0) continue;
      lines.push(`### ${capitalize(status)} (${group.length})`);
      lines.push('');
      for (const item of group) {
        lines.push(`- **[${item.type.toUpperCase()}]** ${item.title} (priority: ${item.priority})`);
      }
      lines.push('');
    }

    // Instructions for Claude Code
    lines.push('---');
    lines.push('');
    lines.push('## Instructions');
    lines.push('');
    lines.push('Please address the items above in the following priority order:');
    lines.push('1. Critical bugs');
    lines.push('2. High-priority bugs');
    lines.push('3. High-priority improvements');
    lines.push('4. Medium-priority bugs and improvements');
    lines.push('5. Ideas and low-priority items');
    lines.push('');
    lines.push('For each item:');
    lines.push('- Read the relevant files before making changes');
    lines.push('- Follow the existing code patterns and conventions');
    lines.push('- Ensure TypeScript compiles cleanly');
    lines.push('- Test the change if possible');
    lines.push('');

    const content = lines.join('\n');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="youos-feedback-${today()}.md"`,
      },
    });
  } catch (err) {
    console.error('GET /api/feedback/export error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderFeedbackItem(lines: string[], item: FeedbackRow) {
  lines.push(`### ${item.title}`);
  lines.push('');
  lines.push(`- **Priority**: ${item.priority}`);
  lines.push(`- **Status**: ${item.status}`);
  if (item.page) lines.push(`- **Page**: ${item.page}`);
  lines.push(`- **Reported**: ${new Date(item.created_at).toLocaleDateString()}`);
  lines.push('');
  lines.push(`**Description**: ${item.description}`);
  lines.push('');

  if (item.ai_analysis) {
    const ai = item.ai_analysis;
    lines.push('**AI Analysis**:');
    if (ai.category) lines.push(`- Category: ${ai.category}`);
    if (ai.technical_summary) lines.push(`- Technical Summary: ${ai.technical_summary}`);
    if (ai.suggested_fix) lines.push(`- Suggested Fix: ${ai.suggested_fix}`);
    lines.push('');
  }
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
