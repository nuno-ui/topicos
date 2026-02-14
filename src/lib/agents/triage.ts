import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { TriageBatchOutputSchema } from '@/types/ai-schemas';

export class TriageAgent extends BaseAgent {
  constructor() {
    super('triage');
  }

  protected async run(userId: string): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];
    let totalTokens = 0;

    const { data: pendingItems } = await this.supabase
      .from('items')
      .select('id, title, snippet, source, metadata, occurred_at')
      .eq('user_id', userId)
      .eq('triage_status', 'pending')
      .order('occurred_at', { ascending: false })
      .limit(100);

    if (!pendingItems || pendingItems.length === 0) {
      return { success: true, output: { message: 'No pending items to triage' }, actions, tokensUsed: 0 };
    }

    const provider = getAIProvider();
    const BATCH = 30;
    let processed = 0;

    for (let i = 0; i < pendingItems.length; i += BATCH) {
      const batch = pendingItems.slice(i, i + BATCH);

      const systemPrompt = `You are the Triage Agent for TopicOS. Score each item's relevance to the user on a 0-1 scale.
- "relevant" (score > 0.6): Requires attention, action, or is about an active project/relationship
- "low_relevance" (score 0.3-0.6): Informational but not actionable right now
- "noise" (score < 0.3): Promotional, automated notifications, spam-like

Be strict about noise. Marketing emails, automated notifications from services, and mass-CC'd threads are usually noise.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsList = batch.map((item: any, idx: number) => {
        const meta = item.metadata as Record<string, unknown>;
        return `[${idx}] id="${item.id}" source=${item.source} title="${item.title}" ${item.snippet ? `snippet="${item.snippet}"` : ''} ${meta?.from ? `from="${meta.from}"` : ''}`;
      }).join('\n');

      try {
        const result = await provider.complete(
          systemPrompt,
          `Triage these ${batch.length} items:\n${itemsList}`,
          TriageBatchOutputSchema,
        );
        totalTokens += result.tokensUsed;

        for (const item of result.data.items) {
          await this.supabase
            .from('items')
            .update({
              triage_status: item.triage_status,
              triage_score: item.triage_score,
              triage_reason: item.triage_reason,
            })
            .eq('id', item.item_id)
            .eq('user_id', userId);

          actions.push({
            action: 'triage_item',
            target_type: 'item',
            target_id: item.item_id,
            description: `${item.triage_status} (${(item.triage_score * 100).toFixed(0)}%): ${item.triage_reason}`,
          });
          processed++;
        }
      } catch (err) {
        console.error('Triage batch error:', err);
      }
    }

    return { success: true, output: { items_processed: processed }, actions, tokensUsed: totalTokens };
  }
}
