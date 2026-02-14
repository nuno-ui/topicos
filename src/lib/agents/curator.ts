import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { AutoOrganizeOutputSchema } from '@/types/ai-schemas';

// Small batches to stay within output token limits and avoid rate limits
const BATCH_SIZE = 5;
const MAX_ITEMS = 50;
const DELAY_BETWEEN_BATCHES_MS = 3000; // 3s delay to avoid rate limits

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CuratorAgent extends BaseAgent {
  constructor() {
    super('curator');
  }

  protected async run(userId: string): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];
    let totalTokens = 0;

    // 1. Fetch all pending triage items
    const { data: pendingItems, error: fetchError } = await this.supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .or('triage_status.eq.pending,triage_status.is.null')
      .order('occurred_at', { ascending: false })
      .limit(MAX_ITEMS);

    if (fetchError) {
      console.error('Curator: failed to fetch items:', fetchError.message);
      return {
        success: false,
        output: { error: `Failed to fetch items: ${fetchError.message}`, items_processed: 0 },
        actions: [{ action: 'fetch_error', target_type: 'query', description: fetchError.message }],
        tokensUsed: 0,
      };
    }

    if (!pendingItems || pendingItems.length === 0) {
      const { count } = await this.supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      return {
        success: true,
        output: {
          message: `No pending items to organize. Total items for user: ${count ?? 0}. Items may need triage_status set to 'pending'.`,
          items_processed: 0,
          total_user_items: count ?? 0,
        },
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

    // 3. Process items in batches — use Haiku for cost/speed/rate-limit reasons
    const provider = getAIProvider('claude-haiku-4-5-20251001');
    let totalProcessed = 0;
    let topicsCreated = 0;
    let topicsMatched = 0;
    let contactsFound = 0;

    for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
      const batch = pendingItems.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      // Delay between batches to avoid rate limits (skip first batch)
      if (i > 0) {
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topicsList = (existingTopics ?? []).map((t: any) =>
        `- [${t.id}] "${t.title}" (${t.area})${t.description ? `: ${t.description}` : ''}`
      ).join('\n');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsList = batch.map((item: any) => {
        const meta = item.metadata as Record<string, unknown>;
        return [
          `id="${item.id}" source=${item.source}`,
          `  Title: ${item.title}`,
          item.snippet ? `  Snippet: ${(item.snippet as string).slice(0, 200)}` : null,
          item.body ? `  Body: ${(item.body as string).slice(0, 300)}` : null,
          meta?.from ? `  From: ${meta.from}` : null,
          meta?.to ? `  To: ${meta.to}` : null,
          meta?.attendees ? `  Attendees: ${JSON.stringify(meta.attendees)}` : null,
          `  Date: ${item.occurred_at}`,
        ].filter(Boolean).join('\n');
      }).join('\n\n');

      const systemPrompt = `You are the Curator Agent for TopicOS. Analyze items and return JSON.

RULES:
- Classify each item: "relevant" (needs attention), "low_relevance" (informational), or "noise" (spam/promotions)
- Match items to existing topics by their UUID, or propose new topics with temp_id like "new_1"
- Extract contacts from email from/to fields
- Score each item 0-1 for relevance

You MUST return EXACTLY this JSON structure:
{
  "items": [
    {
      "item_id": "the-exact-item-id-from-input",
      "topic_id": "existing-topic-uuid-or-new_1-or-null",
      "confidence": 0.8,
      "reason": "why this classification",
      "triage_status": "relevant",
      "triage_score": 0.8,
      "contacts_found": [{"email": "person@example.com", "name": "Person Name", "organization": null, "role": null}]
    }
  ],
  "new_topics": [
    {
      "temp_id": "new_1",
      "title": "Topic Title",
      "area": "work",
      "description": "Brief description"
    }
  ],
  "summary": "Brief summary of what was organized"
}

CRITICAL: Every item in the input MUST appear in the output "items" array. Use the EXACT item id from the input. The "contacts_found" array can be empty []. The "new_topics" array can be empty [].`;

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
          const { error: updateError } = await this.supabase
            .from('items')
            .update({
              triage_status: itemResult.triage_status,
              triage_score: itemResult.triage_score,
              triage_reason: itemResult.reason,
            })
            .eq('id', itemResult.item_id)
            .eq('user_id', userId);

          if (updateError) {
            console.error(`Curator: failed to update item ${itemResult.item_id}:`, updateError.message);
            continue;
          }

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

        actions.push({
          action: 'batch_complete',
          target_type: 'batch',
          description: `Batch ${batchNum}: processed ${output.items.length} items, ${output.new_topics.length} new topics`,
        });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Curator batch error (batch ${batchNum}):`, errMsg);
        actions.push({
          action: 'batch_error',
          target_type: 'batch',
          description: `Batch ${batchNum} failed: ${errMsg.slice(0, 300)}`,
        });

        // If rate limited, wait longer before next batch
        if (errMsg.includes('rate_limit') || errMsg.includes('429')) {
          await sleep(15000); // 15s cooldown on rate limit
        }
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
        batches_total: Math.ceil(pendingItems.length / BATCH_SIZE),
        items_found: pendingItems.length,
      },
      actions,
      tokensUsed: totalTokens,
    };
  }
}
