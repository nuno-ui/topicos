import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxTokens?: number; retries?: number }
): Promise<{ text: string; tokensUsed: number }> {
  const model = options?.model ?? 'claude-sonnet-4-5-20250929';
  const maxTokens = options?.maxTokens ?? 4096;
  const maxRetries = options?.retries ?? 2;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        // Wait with exponential backoff: 1s, 2s
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        console.warn(`[AI Provider] Retry ${attempt + 1}/${maxRetries} after error: ${lastError.message}`);
      }
    }
  }
  throw lastError || new Error('AI call failed after retries');
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

  try {
    const data = JSON.parse(cleaned) as T;
    return { data, tokensUsed };
  } catch (parseErr) {
    // Try to extract JSON from the response (sometimes Claude adds text around JSON)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]) as T;
        return { data, tokensUsed };
      } catch {
        // Fall through to throw
      }
    }
    console.error('[AI Provider] JSON parse failed. Raw text:', cleaned.substring(0, 500));
    throw new Error(`AI returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : 'Parse error'}`);
  }
}
