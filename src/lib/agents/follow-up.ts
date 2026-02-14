import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { FollowUpDetectionOutputSchema } from '@/types/ai-schemas';

export class FollowUpAgent extends BaseAgent {
  constructor() {
    super('follow_up');
  }

  protected async run(userId: string): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];
    let totalTokens = 0;

    // Get recent email items (last 14 days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: emailItems } = await this.supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'gmail')
      .gte('occurred_at', twoWeeksAgo.toISOString())
      .order('occurred_at', { ascending: false })
      .limit(100);

    if (!emailItems || emailItems.length === 0) {
      return { success: true, output: { message: 'No recent emails to check' }, actions, tokensUsed: 0 };
    }

    const provider = getAIProvider();

    const systemPrompt = `You are the Follow-up Agent for TopicOS. Analyze email threads to find messages that need a reply from the user.

Look for:
1. Emails where someone asked the user a question and the user hasn't replied
2. Action items assigned to the user
3. Threads where the user was the last recipient (someone sent TO the user)
4. Time-sensitive requests

For each follow-up found, suggest a brief reply and rate the urgency.
Return only genuine follow-ups, not newsletters or automated messages.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsList = emailItems.map((item: any, idx: number) => {
      const meta = item.metadata as Record<string, unknown>;
      return `[${idx}] id="${item.id}" thread="${meta?.threadId ?? 'none'}" from="${meta?.from ?? ''}" to="${meta?.to ?? ''}" subject="${item.title}" date="${item.occurred_at}" snippet="${item.snippet ?? ''}"`;
    }).join('\n');

    try {
      const result = await provider.complete(
        systemPrompt,
        `Analyze these ${emailItems.length} emails for follow-ups:\n${itemsList}`,
        FollowUpDetectionOutputSchema,
      );
      totalTokens += result.tokensUsed;

      for (const followUp of result.data.follow_ups) {
        actions.push({
          action: 'detect_follow_up',
          target_type: 'item',
          target_id: followUp.item_id,
          description: `${followUp.urgency} urgency: ${followUp.reason}`,
        });

        // Create a task for high urgency follow-ups
        if (followUp.urgency === 'high' || followUp.urgency === 'critical') {
          await this.supabase.from('tasks').insert({
            user_id: userId,
            title: `Follow up: ${followUp.suggested_action}`,
            status: 'pending',
            source_item_id: followUp.item_id,
            created_by: 'executor',
            rationale: followUp.reason,
          });
        }
      }

      return {
        success: true,
        output: { follow_ups_found: result.data.follow_ups.length, follow_ups: result.data.follow_ups },
        actions,
        tokensUsed: totalTokens,
      };
    } catch (err) {
      return { success: false, output: {}, actions, tokensUsed: totalTokens, error: String(err) };
    }
  }
}
