import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { SmartComposeOutputSchema } from '@/types/ai-schemas';

export class SmartComposeAgent extends BaseAgent {
  constructor() {
    super('smart_compose');
  }

  protected async run(userId: string, input: Record<string, unknown>): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];
    const topicId = input.topic_id as string | undefined;
    const action_type = input.action_type as string ?? 'email';
    const to = input.to as string | undefined;
    const context = input.context as string | undefined;

    // Fetch topic context if provided
    let topicContext = '';
    if (topicId) {
      const { data: topic } = await this.supabase
        .from('topics')
        .select('*')
        .eq('id', topicId)
        .single();

      if (topic) {
        topicContext = `Topic: "${topic.title}" (${topic.area})\nDescription: ${topic.description}\nSummary: ${topic.summary ?? 'None'}`;

        // Get linked items
        const { data: links } = await this.supabase
          .from('topic_links')
          .select('item_id')
          .eq('topic_id', topicId)
          .limit(10);

        if (links?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const itemIds = links.map((l: any) => l.item_id);
          const { data: items } = await this.supabase
            .from('items')
            .select('title, snippet, source, occurred_at')
            .in('id', itemIds)
            .order('occurred_at', { ascending: false });

          if (items?.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            topicContext += '\n\nRecent items:\n' + items.map((i: any) =>
              `- [${i.source}] "${i.title}" (${i.occurred_at})`
            ).join('\n');
          }
        }
      }
    }

    const provider = getAIProvider();

    const systemPrompt = `You are the Smart Compose Agent for TopicOS. Draft a professional ${action_type} based on the topic context.

Create content that is:
- Clear and concise
- Professional but personable
- Actionable with specific next steps
- Properly formatted HTML for emails

Return the compose output with both HTML and plain text versions.`;

    const userPrompt = [
      topicContext,
      to ? `To: ${to}` : '',
      context ? `Additional context: ${context}` : '',
      `Action type: ${action_type}`,
    ].filter(Boolean).join('\n\n');

    try {
      const result = await provider.complete(systemPrompt, userPrompt, SmartComposeOutputSchema);

      actions.push({
        action: 'compose_draft',
        target_type: 'email_draft',
        description: `Composed ${action_type}: "${result.data.subject}"`,
      });

      // Save as email draft
      if (topicId) {
        await this.supabase.from('email_drafts').insert({
          user_id: userId,
          topic_id: topicId,
          to_addresses: to ? [to] : [],
          cc_addresses: [],
          subject: result.data.subject,
          body_html: result.data.body_html,
          body_text: result.data.body_text,
          status: 'draft',
          agent_generated: true,
        });
      }

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
