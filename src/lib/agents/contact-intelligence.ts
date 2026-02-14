import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { ContactExtractOutputSchema } from '@/types/ai-schemas';

export class ContactIntelligenceAgent extends BaseAgent {
  constructor() {
    super('contact_intelligence');
  }

  protected async run(userId: string): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];
    let totalTokens = 0;

    // Get recent items to extract contacts from
    const { data: recentItems } = await this.supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(200);

    if (!recentItems || recentItems.length === 0) {
      return { success: true, output: { message: 'No items to extract contacts from' }, actions, tokensUsed: 0 };
    }

    const provider = getAIProvider();
    const BATCH = 40;
    let contactsUpserted = 0;

    for (let i = 0; i < recentItems.length; i += BATCH) {
      const batch = recentItems.slice(i, i + BATCH);

      const systemPrompt = `You are the Contact Intelligence Agent for TopicOS. Extract contact information from items.

For each contact found:
- Extract email, name, organization, and role
- Determine the area (personal/career/work) based on context
- Add useful notes about the relationship

Only extract real people, not automated senders (no-reply@, notifications@, etc).
Deduplicate contacts by email address.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsList = batch.map((item: any) => {
        const meta = item.metadata as Record<string, unknown>;
        return `[${item.source}] "${item.title}" from="${meta?.from ?? ''}" to="${meta?.to ?? ''}" attendees=${JSON.stringify(meta?.attendees ?? [])}`;
      }).join('\n');

      try {
        const result = await provider.complete(
          systemPrompt,
          `Extract contacts from these ${batch.length} items:\n${itemsList}`,
          ContactExtractOutputSchema,
        );
        totalTokens += result.tokensUsed;

        for (const contact of result.data.contacts) {
          if (!contact.email || contact.email.includes('noreply') || contact.email.includes('no-reply')) continue;

          const { error } = await this.supabase
            .from('contacts')
            .upsert({
              user_id: userId,
              email: contact.email.toLowerCase(),
              name: contact.name,
              organization: contact.organization,
              role: contact.role,
              area: contact.area,
              notes: contact.notes,
              last_interaction_at: new Date().toISOString(),
              metadata: {},
            }, { onConflict: 'user_id,email' });

          if (!error) {
            contactsUpserted++;
            actions.push({
              action: 'upsert_contact',
              target_type: 'contact',
              description: `${contact.name ?? contact.email}${contact.organization ? ` @ ${contact.organization}` : ''}`,
            });
          }
        }
      } catch (err) {
        console.error('Contact extraction batch error:', err);
      }
    }

    return {
      success: true,
      output: { contacts_upserted: contactsUpserted },
      actions,
      tokensUsed: totalTokens,
    };
  }
}
