import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { WeeklyReviewOutputSchema } from '@/types/ai-schemas';

export class WeeklyReviewAgent extends BaseAgent {
  constructor() {
    super('weekly_review');
  }

  protected async run(userId: string): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekStart = oneWeekAgo.toISOString();

    // Gather data
    const [topicsRes, tasksRes, itemsRes, completedTasksRes] = await Promise.all([
      this.supabase.from('topics').select('*').eq('user_id', userId).eq('status', 'active'),
      this.supabase.from('tasks').select('*').eq('user_id', userId).gte('created_at', weekStart),
      this.supabase.from('items').select('id').eq('user_id', userId).gte('created_at', weekStart),
      this.supabase.from('tasks').select('id').eq('user_id', userId).eq('status', 'done').gte('updated_at', weekStart),
    ]);

    const topics = topicsRes.data ?? [];
    const newTasks = tasksRes.data ?? [];
    const newItems = itemsRes.data ?? [];
    const completedTasks = completedTasksRes.data ?? [];

    const provider = getAIProvider();

    const systemPrompt = `You are the Weekly Review Agent for TopicOS. Generate a comprehensive weekly review.

Analyze the past 7 days and provide:
1. Summary of what happened
2. Progress on each active topic
3. Highlights and concerns
4. Priorities for next week

Be specific and actionable. Reference real topics and tasks.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topicsList = topics.map((t: any) =>
      `- "${t.title}" (${t.area}, priority: ${t.priority})${t.summary ? `: ${t.summary}` : ''}`
    ).join('\n');

    const userPrompt = `WEEKLY REVIEW for ${oneWeekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}

Active Topics (${topics.length}):\n${topicsList || '(none)'}

Stats:
- New items this week: ${newItems.length}
- Tasks created: ${newTasks.length}
- Tasks completed: ${completedTasks.length}
- Pending tasks: ${newTasks.filter((t: any) => t.status === 'pending').length}`; // eslint-disable-line @typescript-eslint/no-explicit-any

    try {
      const result = await provider.complete(systemPrompt, userPrompt, WeeklyReviewOutputSchema);

      actions.push({
        action: 'generate_review',
        target_type: 'weekly_review',
        description: `Generated weekly review with ${result.data.priorities_next_week.length} priorities`,
      });

      return {
        success: true,
        output: result.data,
        actions,
        tokensUsed: result.tokensUsed,
      };
    } catch (err) {
      return { success: false, output: {}, actions, tokensUsed: 0, error: String(err) };
    }
  }
}
