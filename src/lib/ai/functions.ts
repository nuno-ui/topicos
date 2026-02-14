import { getAIProvider } from '@/lib/ai/provider';
import {
  ClassifyAreaOutputSchema,
  type ClassifyAreaOutput,
  SuggestTopicsOutputSchema,
  type SuggestTopicsOutput,
  ExtractSignalsOutputSchema,
  type ExtractSignalsOutput,
  SummarizeTopicOutputSchema,
  type SummarizeTopicOutput,
  UrgencyScoreOutputSchema,
  type UrgencyScoreOutput,
  GenerateDeliverableOutputSchema,
  type GenerateDeliverableOutput,
  PasteAnalysisOutputSchema,
  type PasteAnalysisOutput,
} from '@/types/ai-schemas';

// ---------------------------------------------------------------------------
// classifyArea
// ---------------------------------------------------------------------------

export async function classifyArea(text: string) {
  const provider = getAIProvider();

  const systemPrompt = [
    'You are a life-area classifier for a personal productivity system called TopicOS.',
    'Given a piece of text (an email, note, calendar event, etc.), classify it into one of three areas:',
    '- "personal": family, health, hobbies, finance, personal errands',
    '- "career": job search, professional development, networking, skills',
    '- "work": current job tasks, projects, meetings, coworkers',
    '',
    'Respond with a JSON object containing:',
    '- area: one of "personal", "career", "work"',
    '- confidence: a number between 0 and 1',
    '- rationale: a brief explanation of your classification',
  ].join('\n');

  const userPrompt = `Classify the following text:\n\n${text}`;

  return provider.complete<ClassifyAreaOutput>(
    systemPrompt,
    userPrompt,
    ClassifyAreaOutputSchema,
  );
}

// ---------------------------------------------------------------------------
// suggestTopics
// ---------------------------------------------------------------------------

export async function suggestTopics(
  text: string,
  existingTopics: { id: string; title: string; area: string }[],
) {
  const provider = getAIProvider();

  const systemPrompt = [
    'You are a topic-matching engine for TopicOS, a personal productivity system.',
    'Given a piece of text and a list of existing topics, suggest which topics the text relates to.',
    'You may suggest existing topics (by topic_id) or propose new topics (with proposed_title, topic_id as null).',
    '',
    'For each suggestion provide:',
    '- topic_id: UUID of the existing topic, or null if proposing a new topic',
    '- proposed_title: null if matching an existing topic, or a title string for a new topic',
    '- confidence: 0-1 how confident you are in the match',
    '- reason: why this topic matches',
    '- evidence: the specific text fragment that supports the match',
    '',
    'Return a JSON object with a "suggestions" array. Include all relevant matches.',
    'If nothing matches at all, return an empty suggestions array.',
  ].join('\n');

  const topicsList = existingTopics.length > 0
    ? existingTopics
        .map((t) => `- [${t.id}] "${t.title}" (${t.area})`)
        .join('\n')
    : '(no existing topics)';

  const userPrompt = [
    'Existing topics:',
    topicsList,
    '',
    'Text to analyze:',
    text,
  ].join('\n');

  return provider.complete<SuggestTopicsOutput>(
    systemPrompt,
    userPrompt,
    SuggestTopicsOutputSchema,
  );
}

// ---------------------------------------------------------------------------
// extractSignals
// ---------------------------------------------------------------------------

export async function extractSignals(text: string) {
  const provider = getAIProvider();

  const systemPrompt = [
    'You are a signal extraction engine for TopicOS, a personal productivity system.',
    'Given a piece of text, extract structured signals:',
    '',
    '- people: array of {name, role? (their role/relationship), email? (if found)}',
    '- orgs: array of organization/company name strings',
    '- dates: array of {date (ISO 8601), context (what the date refers to)}',
    '- deadlines: array of {date (ISO 8601), description, urgency ("low"|"medium"|"high"|"critical")}',
    '- action_items: array of {title, assignee? (who should do it), due_date? (ISO 8601), priority ("low"|"medium"|"high")}',
    '',
    'Only include signals you are confident about. Do not hallucinate information.',
    'For dates, use ISO 8601 format (YYYY-MM-DD). If only a relative date is mentioned, leave it as a descriptive string.',
  ].join('\n');

  const userPrompt = `Extract signals from the following text:\n\n${text}`;

  return provider.complete<ExtractSignalsOutput>(
    systemPrompt,
    userPrompt,
    ExtractSignalsOutputSchema,
  );
}

// ---------------------------------------------------------------------------
// summarizeTopic
// ---------------------------------------------------------------------------

export async function summarizeTopic(
  items: {
    title: string;
    snippet: string;
    source: string;
    occurred_at: string;
  }[],
) {
  const provider = getAIProvider();

  const systemPrompt = [
    'You are a topic summarizer for TopicOS, a personal productivity system.',
    'Given a set of items (emails, calendar events, documents, notes) linked to a topic,',
    'produce a concise but thorough summary.',
    '',
    'Return a JSON object with:',
    '- summary: a 2-4 sentence overview of the topic based on these items',
    '- key_points: array of the most important facts or developments',
    '- risks: array of any risks, blockers, or concerns identified',
    '- next_steps: array of {action, priority ("low"|"medium"|"high"), rationale}',
    '',
    'Focus on actionable insights. Be specific, not generic.',
  ].join('\n');

  const itemsList = items
    .map(
      (item, i) =>
        `[${i + 1}] (${item.source}, ${item.occurred_at})\nTitle: ${item.title}\nSnippet: ${item.snippet}`,
    )
    .join('\n\n');

  const userPrompt = `Summarize the following ${items.length} items:\n\n${itemsList}`;

  return provider.complete<SummarizeTopicOutput>(
    systemPrompt,
    userPrompt,
    SummarizeTopicOutputSchema,
  );
}

// ---------------------------------------------------------------------------
// urgencyScore
// ---------------------------------------------------------------------------

export async function urgencyScore(topicState: {
  title: string;
  description: string;
  taskCount: number;
  pendingTasks: number;
  lastUpdate: string;
  upcomingDeadlines: string[];
  recentItems: number;
}) {
  const provider = getAIProvider();

  const systemPrompt = [
    'You are an urgency scoring engine for TopicOS, a personal productivity system.',
    'Given the current state of a topic, assign an urgency score from 0 to 100.',
    '',
    'Consider these factors:',
    '- Number of pending tasks vs total tasks',
    '- How recent the last update was',
    '- Upcoming deadlines and their proximity',
    '- Volume of recent activity (more items = more active = potentially more urgent)',
    '',
    'Return a JSON object with:',
    '- score: integer 0-100',
    '- drivers: array of {signal (what factor), weight (0-1 how much it contributed), detail (explanation)}',
    '- explanation: a sentence explaining the overall urgency level',
    '- suggested_today_actions: array of {action, reason} things the user should do today',
  ].join('\n');

  const userPrompt = [
    `Topic: ${topicState.title}`,
    `Description: ${topicState.description}`,
    `Tasks: ${topicState.pendingTasks} pending out of ${topicState.taskCount} total`,
    `Last updated: ${topicState.lastUpdate}`,
    `Upcoming deadlines: ${topicState.upcomingDeadlines.length > 0 ? topicState.upcomingDeadlines.join(', ') : 'none'}`,
    `Recent items (last 7 days): ${topicState.recentItems}`,
  ].join('\n');

  return provider.complete<UrgencyScoreOutput>(
    systemPrompt,
    userPrompt,
    UrgencyScoreOutputSchema,
  );
}

// ---------------------------------------------------------------------------
// generateDeliverable
// ---------------------------------------------------------------------------

export async function generateDeliverable(
  kind: string,
  topicContext: {
    title: string;
    summary: string;
    items: string[];
    tasks: string[];
  },
) {
  const provider = getAIProvider();

  const systemPrompt = [
    'You are a deliverable generator for TopicOS, a personal productivity system.',
    `Generate a "${kind}" deliverable based on the topic context provided.`,
    '',
    'Supported kinds: email, follow_up, report, project_plan, meeting_agenda, status_update.',
    '',
    'Return a JSON object with:',
    `- kind: "${kind}"`,
    '- title: a descriptive title for the deliverable',
    '- content: the full deliverable text in markdown format',
    '- missing_info: array of {what (info needed), why (why it matters)} for anything you could not determine',
    '- metadata: optional object with any extra structured data',
    '',
    'Make the content professional, clear, and ready to use with minimal editing.',
  ].join('\n');

  const userPrompt = [
    `Topic: ${topicContext.title}`,
    `Summary: ${topicContext.summary}`,
    '',
    'Related items:',
    ...topicContext.items.map((item, i) => `${i + 1}. ${item}`),
    '',
    'Current tasks:',
    ...topicContext.tasks.map((task, i) => `${i + 1}. ${task}`),
  ].join('\n');

  return provider.complete<GenerateDeliverableOutput>(
    systemPrompt,
    userPrompt,
    GenerateDeliverableOutputSchema,
  );
}

// ---------------------------------------------------------------------------
// analyzePaste
// ---------------------------------------------------------------------------

export async function analyzePaste(
  text: string,
  existingTopics: { id: string; title: string; area: string }[],
) {
  const provider = getAIProvider();

  const systemPrompt = [
    'You are a paste analysis engine for TopicOS, a personal productivity system.',
    'When a user pastes text into the system, analyze it comprehensively.',
    '',
    'Given the pasted text and a list of existing topics, return a JSON object with:',
    '- detected_area: "personal" | "career" | "work"',
    '- area_confidence: 0-1',
    '- matched_topics: array of {topic_id (UUID or null), proposed_title (string or null), confidence (0-1), reason}',
    '  - Use topic_id for existing topics, proposed_title for new topic suggestions',
    '- extracted_tasks: array of {title, due_date (ISO 8601 or null), priority ("low"|"medium"|"high")}',
    '- extracted_people: array of {name, role?}',
    '- extracted_deadlines: array of {date (ISO 8601), description}',
    '- suggested_summary_updates: array of {topic_id (UUID), update (text to append to summary)}',
    '  - Only for existing topics that should have their summaries updated based on this new info',
    '- suggested_deliverables: array of {kind ("email"|"follow_up"|"report"|"project_plan"|"meeting_agenda"|"status_update"), description}',
    '',
    'Be thorough but precise. Only suggest matches and extractions you are confident about.',
  ].join('\n');

  const topicsList = existingTopics.length > 0
    ? existingTopics
        .map((t) => `- [${t.id}] "${t.title}" (${t.area})`)
        .join('\n')
    : '(no existing topics)';

  const userPrompt = [
    'Existing topics:',
    topicsList,
    '',
    'Pasted text:',
    text,
  ].join('\n');

  return provider.complete<PasteAnalysisOutput>(
    systemPrompt,
    userPrompt,
    PasteAnalysisOutputSchema,
  );
}
