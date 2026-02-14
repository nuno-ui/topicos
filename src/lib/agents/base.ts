import { createServiceClient } from '@/lib/supabase/server';
import type { AgentType, AgentTrigger } from '@/types/database';

export interface AgentResult {
  success: boolean;
  output: Record<string, unknown>;
  actions: { action: string; target_type: string; target_id?: string; description: string }[];
  tokensUsed: number;
  error?: string;
}

export abstract class BaseAgent {
  protected agentType: AgentType;
  protected supabase: ReturnType<typeof createServiceClient>;

  constructor(agentType: AgentType) {
    this.agentType = agentType;
    this.supabase = createServiceClient();
  }

  async execute(
    userId: string,
    trigger: AgentTrigger,
    input: Record<string, unknown> = {}
  ): Promise<AgentResult> {
    // Create agent_run record
    const { data: agentRun, error: createError } = await this.supabase
      .from('agent_runs')
      .insert({
        user_id: userId,
        agent_type: this.agentType,
        status: 'running',
        trigger,
        input_json: input,
        output_json: {},
        actions_taken: [],
        tokens_used: 0,
      })
      .select()
      .single();

    if (createError || !agentRun) {
      return {
        success: false,
        output: {},
        actions: [],
        tokensUsed: 0,
        error: `Failed to create agent_run: ${createError?.message}`,
      };
    }

    try {
      const result = await this.run(userId, input);

      // Update agent_run as completed
      await this.supabase
        .from('agent_runs')
        .update({
          status: 'completed',
          output_json: result.output,
          actions_taken: result.actions,
          tokens_used: result.tokensUsed,
          finished_at: new Date().toISOString(),
        })
        .eq('id', agentRun.id);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Update agent_run as failed
      await this.supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: { message: errorMessage },
        })
        .eq('id', agentRun.id);

      return {
        success: false,
        output: {},
        actions: [],
        tokensUsed: 0,
        error: errorMessage,
      };
    }
  }

  protected abstract run(
    userId: string,
    input: Record<string, unknown>
  ): Promise<AgentResult>;
}
