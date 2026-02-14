import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIProvider {
  complete<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<{ data: T; raw: unknown; model: string; tokensUsed: number }>;
}

export class AIValidationError extends Error {
  constructor(
    message: string,
    public readonly zodErrors: z.ZodError,
    public readonly rawResponse: unknown,
  ) {
    super(message);
    this.name = 'AIValidationError';
  }
}

// ---------------------------------------------------------------------------
// Anthropic provider
// ---------------------------------------------------------------------------

const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? ANTHROPIC_DEFAULT_MODEL;
  }

  async complete<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<{ data: T; raw: unknown; model: string; tokensUsed: number }> {
    const jsonInstruction =
      'You MUST respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON object.';

    const response = await this.callApi(
      `${systemPrompt}\n\n${jsonInstruction}`,
      userPrompt,
    );

    const firstAttempt = this.parseAndValidate(response.text, schema);
    if (firstAttempt.success) {
      return {
        data: firstAttempt.data,
        raw: response.raw,
        model: this.model,
        tokensUsed: response.tokensUsed,
      };
    }

    // Retry once with a repair prompt
    const repairPrompt = [
      'Your previous response did not match the required JSON schema.',
      '',
      `Validation errors:\n${firstAttempt.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`,
      '',
      `Your previous response was:\n${response.text}`,
      '',
      'Please fix the JSON and respond again. Output ONLY valid JSON, nothing else.',
    ].join('\n');

    const retryResponse = await this.callApi(
      `${systemPrompt}\n\n${jsonInstruction}`,
      repairPrompt,
    );

    const secondAttempt = this.parseAndValidate(retryResponse.text, schema);
    if (secondAttempt.success) {
      return {
        data: secondAttempt.data,
        raw: retryResponse.raw,
        model: this.model,
        tokensUsed: response.tokensUsed + retryResponse.tokensUsed,
      };
    }

    throw new AIValidationError(
      `AI output failed schema validation after retry: ${secondAttempt.error.issues.map((i) => i.message).join('; ')}`,
      secondAttempt.error,
      retryResponse.raw,
    );
  }

  private async callApi(
    system: string,
    user: string,
  ): Promise<{ text: string; raw: unknown; tokensUsed: number }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(
        `Anthropic API error ${res.status}: ${errorBody}`,
      );
    }

    const json = await res.json();
    const text =
      json.content?.[0]?.type === 'text' ? json.content[0].text : '';
    const tokensUsed =
      (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0);

    return { text, raw: json, tokensUsed };
  }

  private parseAndValidate<T>(
    text: string,
    schema: z.ZodSchema<T>,
  ): { success: true; data: T } | { success: false; error: z.ZodError } {
    let parsed: unknown;
    try {
      // Strip potential markdown fences the model might still emit
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: `Response is not valid JSON: ${text.slice(0, 200)}`,
          },
        ]),
      };
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  }
}

// ---------------------------------------------------------------------------
// OpenAI provider (fallback)
// ---------------------------------------------------------------------------

const OPENAI_DEFAULT_MODEL = 'gpt-4o';

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? OPENAI_DEFAULT_MODEL;
  }

  async complete<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<{ data: T; raw: unknown; model: string; tokensUsed: number }> {
    const jsonInstruction =
      'You MUST respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON object.';

    const response = await this.callApi(
      `${systemPrompt}\n\n${jsonInstruction}`,
      userPrompt,
    );

    const firstAttempt = this.parseAndValidate(response.text, schema);
    if (firstAttempt.success) {
      return {
        data: firstAttempt.data,
        raw: response.raw,
        model: this.model,
        tokensUsed: response.tokensUsed,
      };
    }

    // Retry once with a repair prompt
    const repairPrompt = [
      'Your previous response did not match the required JSON schema.',
      '',
      `Validation errors:\n${firstAttempt.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`,
      '',
      `Your previous response was:\n${response.text}`,
      '',
      'Please fix the JSON and respond again. Output ONLY valid JSON, nothing else.',
    ].join('\n');

    const retryResponse = await this.callApi(
      `${systemPrompt}\n\n${jsonInstruction}`,
      repairPrompt,
    );

    const secondAttempt = this.parseAndValidate(retryResponse.text, schema);
    if (secondAttempt.success) {
      return {
        data: secondAttempt.data,
        raw: retryResponse.raw,
        model: this.model,
        tokensUsed: response.tokensUsed + retryResponse.tokensUsed,
      };
    }

    throw new AIValidationError(
      `AI output failed schema validation after retry: ${secondAttempt.error.issues.map((i) => i.message).join('; ')}`,
      secondAttempt.error,
      retryResponse.raw,
    );
  }

  private async callApi(
    system: string,
    user: string,
  ): Promise<{ text: string; raw: unknown; tokensUsed: number }> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errorBody}`);
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? '';
    const tokensUsed = json.usage?.total_tokens ?? 0;

    return { text, raw: json, tokensUsed };
  }

  private parseAndValidate<T>(
    text: string,
    schema: z.ZodSchema<T>,
  ): { success: true; data: T } | { success: false; error: z.ZodError } {
    let parsed: unknown;
    try {
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: `Response is not valid JSON: ${text.slice(0, 200)}`,
          },
        ]),
      };
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function getAIProvider(): AIProvider {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return new AnthropicProvider(
      anthropicKey,
      process.env.ANTHROPIC_MODEL ?? undefined,
    );
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return new OpenAIProvider(
      openaiKey,
      process.env.OPENAI_MODEL ?? undefined,
    );
  }

  throw new Error(
    'No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
  );
}
