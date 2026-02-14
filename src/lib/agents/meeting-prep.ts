import { BaseAgent, type AgentResult } from './base';
import { getAIProvider } from '@/lib/ai/provider';
import { MeetingPrepOutputSchema } from '@/types/ai-schemas';

export class MeetingPrepAgent extends BaseAgent {
  constructor() {
    super('meeting_prep');
  }

  protected async run(userId: string): Promise<AgentResult> {
    const actions: AgentResult['actions'] = [];
    let totalTokens = 0;

    // Get events in the next 48 hours
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: upcomingEvents } = await this.supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'calendar')
      .gte('occurred_at', now.toISOString())
      .lte('occurred_at', twoDaysFromNow.toISOString())
      .order('occurred_at', { ascending: true });

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return { success: true, output: { message: 'No upcoming meetings in next 48h' }, actions, tokensUsed: 0 };
    }

    // Get recent emails for context
    const { data: recentEmails } = await this.supabase
      .from('items')
      .select('id, title, snippet, metadata, occurred_at')
      .eq('user_id', userId)
      .eq('source', 'gmail')
      .order('occurred_at', { ascending: false })
      .limit(50);

    // Get contacts
    const { data: contacts } = await this.supabase
      .from('contacts')
      .select('email, name, organization, role')
      .eq('user_id', userId);

    const contactMap: Record<string, { name: string | null; organization: string | null; role: string | null }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (contacts ?? []) as any[]) {
      contactMap[c.email] = { name: c.name, organization: c.organization, role: c.role };
    }

    const provider = getAIProvider();
    const briefings = [];

    for (const event of upcomingEvents) {
      const meta = event.metadata as Record<string, unknown>;
      const attendees = (meta?.attendees as { email: string; responseStatus?: string }[]) ?? [];

      // Find related emails by attendee matching
      const attendeeEmails = new Set(attendees.map((a: { email: string }) => a.email));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relatedEmails = (recentEmails ?? []).filter((email: any) => {
        const emailMeta = email.metadata as Record<string, unknown>;
        const from = String(emailMeta?.from ?? '');
        const to = String(emailMeta?.to ?? '');
        return [...attendeeEmails].some(ae => from.includes(ae) || to.includes(ae));
      });

      const systemPrompt = `You are the Meeting Prep Agent for TopicOS. Generate a comprehensive briefing for an upcoming meeting.

Include:
1. Brief context about the meeting
2. What you know about each attendee
3. Suggested talking points based on recent communications
4. Open questions to ask
5. Related files/emails that might be useful`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attendeeInfo = attendees.map((a: any) => {
        const info = contactMap[a.email];
        return `  - ${a.email}${info?.name ? ` (${info.name})` : ''}${info?.organization ? ` @ ${info.organization}` : ''}${info?.role ? ` - ${info.role}` : ''}`;
      }).join('\n');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relatedContext = relatedEmails.slice(0, 10).map((e: any) =>
        `  - [${e.id}] "${e.title}" (${e.occurred_at})`
      ).join('\n');

      const userPrompt = `Meeting: "${event.title}"
Date: ${event.occurred_at}
Attendees:\n${attendeeInfo || '  (no attendees listed)'}

Related recent emails:\n${relatedContext || '  (none found)'}`;

      try {
        const result = await provider.complete(systemPrompt, userPrompt, MeetingPrepOutputSchema);
        totalTokens += result.tokensUsed;
        briefings.push(result.data);

        actions.push({
          action: 'generate_briefing',
          target_type: 'item',
          target_id: event.id,
          description: `Generated briefing for "${event.title}" with ${result.data.talking_points.length} talking points`,
        });
      } catch (err) {
        console.error(`Meeting prep error for ${event.id}:`, err);
      }
    }

    return {
      success: true,
      output: { meetings_prepped: briefings.length, briefings },
      actions,
      tokensUsed: totalTokens,
    };
  }
}
