import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { AutoLinkOutputSchema } from '@/types/ai-schemas';

// Process items in small batches to stay within token limits
const BATCH_SIZE = 10;
const MAX_ITEMS = 200;
const DELAY_BETWEEN_BATCHES_MS = 2000;
const MIN_RELEVANCE = 0.6; // Only link items with relevance >= 0.6

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AutoLinkAgent extends BaseAgent {
  constructor() {
    super('auto_link');
  }

  protected async run(userId: string, input: Record<string, unknown>): Promise<AgentResult> {
    const topicId = input.topic_id as string;
    const actions: AgentResult['actions'] = [];
    let totalTokens = 0;

    if (!topicId) {
      return {
        success: false,
        output: { error: 'topic_id is required' },
        actions: [],
        tokensUsed: 0,
      };
    }

    // 1. Fetch the topic
    const { data: topic, error: topicError } = await this.supabase
      .from('topics')
      .select('id, title, area, description, summary')
      .eq('id', topicId)
      .eq('user_id', userId)
      .single();

    if (topicError || !topic) {
      return {
        success: false,
        output: { error: `Topic not found: ${topicError?.message ?? 'not found'}` },
        actions: [],
        tokensUsed: 0,
      };
    }

    // 2. Fetch items already linked to this topic
    const { data: existingLinks } = await this.supabase
      .from('topic_links')
      .select('item_id')
      .eq('topic_id', topicId)
      .eq('user_id', userId);

    const alreadyLinkedIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existingLinks ?? []).map((l: any) => l.item_id)
    );

    // 3. Fetch unlinked items (excluding deleted and noise)
    const { data: candidateItems, error: fetchError } = await this.supabase
      .from('items')
      .select('id, title, snippet, body, source, occurred_at, metadata')
      .eq('user_id', userId)
      .neq('triage_status', 'deleted')
      .neq('triage_status', 'noise')
      .order('occurred_at', { ascending: false })
      .limit(MAX_ITEMS);

    if (fetchError) {
      return {
        success: false,
        output: { error: `Failed to fetch items: ${fetchError.message}` },
        actions: [],
        tokensUsed: 0,
      };
    }

    // Filter out already-linked items
    const unlinkedItems = (candidateItems ?? []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => !alreadyLinkedIds.has(item.id)
    );

    if (unlinkedItems.length === 0) {
      return {
        success: true,
        output: { message: 'No unlinked items to scan', items_scanned: 0, items_linked: 0 },
        actions: [],
        tokensUsed: 0,
      };
    }

    // 4. Process in batches using Haiku for speed/cost
    const provider = getAIProvider('claude-haiku-4-5-20251001');
    let totalLinked = 0;
    let totalScanned = 0;

    for (let i = 0; i < unlinkedItems.length; i += BATCH_SIZE) {
      const batch = unlinkedItems.slice(i, i + BATCH_SIZE);

      // Delay between batches (skip first)
      if (i > 0) {
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemsList = batch.map((item: any) => {
        const meta = item.metadata as Record<string, unknown>;
        return [
          `id="${item.id}" source=${item.source}`,
          `  Title: ${item.title}`,
          item.snippet ? `  Snippet: ${(item.snippet as string).slice(0, 150)}` : null,
          item.body ? `  Body: ${(item.body as string).slice(0, 200)}` : null,
          meta?.from ? `  From: ${meta.from}` : null,
          meta?.to ? `  To: ${meta.to}` : null,
          `  Date: ${item.occurred_at}`,
        ].filter(Boolean).join('\n');
      }).join('\n\n');

      const systemPrompt = `You are an AI assistant that finds items related to a specific topic/project. Analyze each item and score how relevant it is to the topic.

TOPIC: "${topic.title}"
AREA: ${topic.area}
${topic.description ? `DESCRIPTION: ${topic.description}` : ''}
${topic.summary ? `SUMMARY: ${topic.summary.slice(0, 300)}` : ''}

RULES:
- Score each item from 0.0 to 1.0 for relevance to this topic
- Only include items with relevance >= ${MIN_RELEVANCE} in the matches array
- Consider: subject keywords, people mentioned, dates, content overlap
- Be selective — only match items genuinely related to this topic

You MUST return EXACTLY this JSON structure:
{
  "matches": [
    {
      "item_id": "the-exact-item-id-from-input",
      "relevance": 0.85,
      "reason": "why this item relates to the topic"
    }
  ],
  "summary": "Brief summary of what was found"
}

If no items match, return {"matches": [], "summary": "No related items found in this batch."}`;

      const userPrompt = `ITEMS TO ANALYZE (${batch.length} items):\n\n${itemsList}`;

      try {
        const result = await provider.complete(
          systemPrompt,
          userPrompt,
          AutoLinkOutputSchema,
        );

        totalTokens += result.tokensUsed;
        totalScanned += batch.length;

        const output = result.data;

        // Link matched items
        for (const match of output.matches) {
          if (match.relevance < MIN_RELEVANCE) continue;
          // Verify the item_id is actually in this batch
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!batch.some((item: any) => item.id === match.item_id)) continue;

          const { error: linkError } = await this.supabase
            .from('topic_links')
            .insert({
              user_id: userId,
              topic_id: topicId,
              item_id: match.item_id,
              confidence: match.relevance,
              reason: match.reason,
              created_by: 'curator',
            });

          if (!linkError) {
            totalLinked++;
            actions.push({
              action: 'link_item',
              target_type: 'topic_link',
              target_id: match.item_id,
              description: `Linked item (relevance: ${match.relevance.toFixed(2)}): ${match.reason.slice(0, 100)}`,
            });
          }
        }

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`AutoLink batch error:`, errMsg);
        actions.push({
          action: 'batch_error',
          target_type: 'batch',
          description: `Batch failed: ${errMsg.slice(0, 200)}`,
        });

        // On rate limit, wait longer
        if (errMsg.includes('rate_limit') || errMsg.includes('429')) {
          await sleep(15000);
        }
      }
    }

    return {
      success: true,
      output: {
        items_scanned: totalScanned,
        items_linked: totalLinked,
        topic_id: topicId,
        topic_title: topic.title,
      },
      actions,
      tokensUsed: totalTokens,
    };
  }
}
