import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxTokens?: number }
): Promise<{ text: string; tokensUsed: number }> {
  const model = options?.model ?? 'claude-sonnet-4-5-20250929';
  const maxTokens = options?.maxTokens ?? 4096;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text)
    .join('');

  const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
  return { text, tokensUsed };
}

export async function callClaudeJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxTokens?: number }
): Promise<{ data: T; tokensUsed: number }> {
  const fullSystem = systemPrompt + '\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, no explanation -- just the JSON object.';
  const { text, tokensUsed } = await callClaude(fullSystem, userPrompt, options);

  // Strip markdown code blocks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const data = JSON.parse(cleaned) as T;
  return { data, tokensUsed };
}
