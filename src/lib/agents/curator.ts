import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { AutoOrganizeOutputSchema } from '@/types/ai-schemas';

const BATCH_SIZE = 25;

export class CuratorAgent extends BaseAgent {
  constructor() {
    super('curator');
  }

  protected async run(userId: string): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];
    let totalTokens = 0;

    // 1. Fetch all pending triage items
    const { data: pendingItems } = await this.supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('triage_status', 'pending')
      .order('occurred_at', { ascending: false })
      .limit(100);

    if (!pendingItems || pendingItems.length === 0) {
      return {
        success: true,
        output: { message: 'No pending items to organize', items_processed: 0 },
        actions,
        tokensUsed: 0,
      };
    }

    // 2. Fetch existing topics for context
    const { data: existingTopics } = await this.supabase
      .from('topics')
      .select('id, title, area, description, summary')
      .eq('user_id', userId)
      .eq('status', 'active');

    // 3. Process items in batches
    const provider = getAIProvider();
    let totalProcessed = 0;
    let topicsCreated = 0;
    let topicsMatched = 0;
    let contactsFound = 0;

    for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
      const batch = pendingItems.slice(i, i + BATCH_SIZE);

      const systemPrompt = [
        'You are the Curator Agent for TopicOS, a personal organization system.',
        'Your job is to analyze incoming items (emails, calendar events, drive files) and:',
        '1. Classify each item as relevant, low_relevance, or noise',
        '2. Match items to existing topics or propose new topics',
        '3. Extract contact information from items',
        '4. Score relevance/triage for each item (0-1)',
        '',
        'IMPORTANT RULES:',
        '- Match items to existing topics when there is a clear connection (>0.5 confidence)',
        '- Propose new topics only for truly distinct themes not covered by existing topics',
        '- When proposing new topics, use temp_id like "new_1", "new_2" and reference them in item assignments',
        '- Items that are generic newsletters, promotions, or spam should be marked as "noise"',
        '- Items that are informational but not actionable should be "low_relevance"',
        '- Items that require attention/action should be "relevant"',
        '- Extract contacts from email from/to fields and calendar attendees',
        '',
        'Return a JSON object matching the schema exactly.',
      ].join('\n');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topicsList = (existingTopics ?? []).map((t: any) =>
        `- [${t.id}] "${t.title}" (${t.area})${t.description ? `: ${t.description}` : ''}`
      ).join('\n');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsList = batch.map((item: any, idx: number) => {
        const meta = item.metadata as Record<string, unknown>;
        return [
          `[Item ${idx}] id="${item.id}" source=${item.source}`,
          `  Title: ${item.title}`,
          item.snippet ? `  Snippet: ${item.snippet}` : null,
          meta?.from ? `  From: ${meta.from}` : null,
          meta?.to ? `  To: ${meta.to}` : null,
          meta?.attendees ? `  Attendees: ${JSON.stringify(meta.attendees)}` : null,
          `  Date: ${item.occurred_at}`,
        ].filter(Boolean).join('\n');
      }).join('\n\n');

      const userPrompt = [
        'EXISTING TOPICS:',
        topicsList || '(none yet)',
        '',
        `ITEMS TO ORGANIZE (${batch.length} items):`,
        itemsList,
      ].join('\n');

      try {
        const result = await provider.complete(
          systemPrompt,
          userPrompt,
          AutoOrganizeOutputSchema,
        );

        totalTokens += result.tokensUsed;

        // 4. Process the AI output
        const output = result.data;

        // Create new topics first
        const topicIdMap: Record<string, string> = {};
        for (const newTopic of output.new_topics) {
          const { data: created } = await this.supabase
            .from('topics')
            .insert({
              user_id: userId,
              title: newTopic.title,
              area: newTopic.area,
              description: newTopic.description,
              status: 'active',
              priority: 5,
            })
            .select('id')
            .single();

          if (created) {
            topicIdMap[newTopic.temp_id] = created.id;
            topicsCreated++;
            actions.push({
              action: 'create_topic',
              target_type: 'topic',
              target_id: created.id,
              description: `Created topic "${newTopic.title}" (${newTopic.area})`,
            });
          }
        }

        // Process each item result
        for (const itemResult of output.items) {
          // Update triage status
          await this.supabase
            .from('items')
            .update({
              triage_status: itemResult.triage_status,
              triage_score: itemResult.triage_score,
              triage_reason: itemResult.reason,
            })
            .eq('id', itemResult.item_id)
            .eq('user_id', userId);

          actions.push({
            action: 'triage_item',
            target_type: 'item',
            target_id: itemResult.item_id,
            description: `Triaged as ${itemResult.triage_status} (score: ${itemResult.triage_score.toFixed(2)})`,
          });

          // Link to topic if matched
          let resolvedTopicId = itemResult.topic_id;
          if (resolvedTopicId && topicIdMap[resolvedTopicId]) {
            resolvedTopicId = topicIdMap[resolvedTopicId];
          }

          if (resolvedTopicId && itemResult.triage_status !== 'noise') {
            const { error: linkError } = await this.supabase
              .from('topic_links')
              .insert({
                user_id: userId,
                topic_id: resolvedTopicId,
                item_id: itemResult.item_id,
                confidence: itemResult.confidence,
                reason: itemResult.reason,
                created_by: 'curator',
              });

            if (!linkError) {
              topicsMatched++;
              actions.push({
                action: 'link_item',
                target_type: 'topic_link',
                target_id: resolvedTopicId,
                description: `Linked item to topic (confidence: ${itemResult.confidence.toFixed(2)})`,
              });
            }
          }

          // Upsert contacts
          for (const contact of itemResult.contacts_found) {
            if (!contact.email) continue;

            const { error: contactError } = await this.supabase
              .from('contacts')
              .upsert({
                user_id: userId,
                email: contact.email.toLowerCase(),
                name: contact.name,
                organization: contact.organization,
                role: contact.role,
                last_interaction_at: new Date().toISOString(),
                interaction_count: 1,
                metadata: {},
              }, {
                onConflict: 'user_id,email',
              });

            if (!contactError) {
              contactsFound++;
            }
          }

          totalProcessed++;
        }
      } catch (err) {
        console.error(`Curator batch error:`, err);
        // Continue with next batch
      }
    }

    return {
      success: true,
      output: {
        items_processed: totalProcessed,
        topics_created: topicsCreated,
        topics_matched: topicsMatched,
        contacts_found: contactsFound,
      },
      actions,
      tokensUsed: totalTokens,
    };
  }
}
