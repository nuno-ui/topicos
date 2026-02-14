import { createServiceClient } from '@/lib/supabase/server';
import type { AiOutputKind } from '@/types/database';

export async function storeAiOutput(params: {
  userId: string;
  kind: AiOutputKind;
  model: string;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  tokensUsed: number;
}) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('ai_outputs')
    .insert({
      user_id: params.userId,
      kind: params.kind,
      model: params.model,
      input_json: params.inputJson,
      output_json: params.outputJson,
      tokens_used: params.tokensUsed,
    })
    .select()
    .single();

  if (error) {
    console.error('[storeAiOutput] Failed to store AI output:', error.message);
    throw new Error(`Failed to store AI output: ${error.message}`);
  }

  return data;
}
