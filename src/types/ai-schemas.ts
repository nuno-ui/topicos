import { z } from 'zod';

// classify_area
export const ClassifyAreaOutputSchema = z.object({
  area: z.enum(['personal', 'career', 'work']),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});
export type ClassifyAreaOutput = z.infer<typeof ClassifyAreaOutputSchema>;

// suggest_topics
export const TopicSuggestionSchema = z.object({
  topic_id: z.string().uuid().nullable(),
  proposed_title: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  evidence: z.string(),
});

export const SuggestTopicsOutputSchema = z.object({
  suggestions: z.array(TopicSuggestionSchema),
});
export type SuggestTopicsOutput = z.infer<typeof SuggestTopicsOutputSchema>;

// extract_signals
export const ExtractSignalsOutputSchema = z.object({
  people: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    email: z.string().optional(),
  })),
  orgs: z.array(z.string()),
  dates: z.array(z.object({
    date: z.string(),
    context: z.string(),
  })),
  deadlines: z.array(z.object({
    date: z.string(),
    description: z.string(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  action_items: z.array(z.object({
    title: z.string(),
    assignee: z.string().optional(),
    due_date: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']),
  })),
});
export type ExtractSignalsOutput = z.infer<typeof ExtractSignalsOutputSchema>;

// summarize_topic
export const SummarizeTopicOutputSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  risks: z.array(z.string()),
  next_steps: z.array(z.object({
    action: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    rationale: z.string(),
  })),
});
export type SummarizeTopicOutput = z.infer<typeof SummarizeTopicOutputSchema>;

// urgency_score
export const UrgencyScoreOutputSchema = z.object({
  score: z.number().min(0).max(100),
  drivers: z.array(z.object({
    signal: z.string(),
    weight: z.number(),
    detail: z.string(),
  })),
  explanation: z.string(),
  suggested_today_actions: z.array(z.object({
    action: z.string(),
    reason: z.string(),
  })),
});
export type UrgencyScoreOutput = z.infer<typeof UrgencyScoreOutputSchema>;

// generate_deliverable
export const GenerateDeliverableOutputSchema = z.object({
  kind: z.enum(['email', 'follow_up', 'report', 'project_plan', 'meeting_agenda', 'status_update']),
  title: z.string(),
  content: z.string(),
  missing_info: z.array(z.object({
    what: z.string(),
    why: z.string(),
  })),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type GenerateDeliverableOutput = z.infer<typeof GenerateDeliverableOutputSchema>;

// Paste-in analysis
export const PasteAnalysisOutputSchema = z.object({
  detected_area: z.enum(['personal', 'career', 'work']),
  area_confidence: z.number().min(0).max(1),
  matched_topics: z.array(z.object({
    topic_id: z.string().uuid().nullable(),
    proposed_title: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
  })),
  extracted_tasks: z.array(z.object({
    title: z.string(),
    due_date: z.string().nullable(),
    priority: z.enum(['low', 'medium', 'high']),
  })),
  extracted_people: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
  })),
  extracted_deadlines: z.array(z.object({
    date: z.string(),
    description: z.string(),
  })),
  suggested_summary_updates: z.array(z.object({
    topic_id: z.string().uuid(),
    update: z.string(),
  })),
  suggested_deliverables: z.array(z.object({
    kind: z.enum(['email', 'follow_up', 'report', 'project_plan', 'meeting_agenda', 'status_update']),
    description: z.string(),
  })),
});
export type PasteAnalysisOutput = z.infer<typeof PasteAnalysisOutputSchema>;
