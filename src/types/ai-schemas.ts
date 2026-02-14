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

// Auto-organize (Curator Agent output)
export const AutoOrganizeItemSchema = z.object({
  item_id: z.string(),
  // topic_id can be an existing UUID OR a temp_id like "new_1" for new topics
  topic_id: z.string().nullable(),
  proposed_topic_title: z.string().nullable().optional(),
  proposed_topic_area: z.enum(['personal', 'career', 'work']).nullable().optional(),
  proposed_topic_description: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  triage_status: z.enum(['relevant', 'low_relevance', 'noise']),
  triage_score: z.number().min(0).max(1),
  contacts_found: z.array(z.object({
    email: z.string(),
    name: z.string().nullable().optional(),
    organization: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
  })).default([]),
});

export const AutoOrganizeOutputSchema = z.object({
  items: z.array(AutoOrganizeItemSchema),
  new_topics: z.array(z.object({
    temp_id: z.string(),
    title: z.string(),
    area: z.enum(['personal', 'career', 'work']),
    description: z.string().default(''),
  })).default([]),
  summary: z.string().default(''),
});
export type AutoOrganizeOutput = z.infer<typeof AutoOrganizeOutputSchema>;

// Triage batch output
export const TriageBatchOutputSchema = z.object({
  items: z.array(z.object({
    item_id: z.string(),
    triage_status: z.enum(['relevant', 'low_relevance', 'noise']),
    triage_score: z.number().min(0).max(1),
    triage_reason: z.string(),
  })),
});
export type TriageBatchOutput = z.infer<typeof TriageBatchOutputSchema>;

// Follow-up detection output
export const FollowUpDetectionOutputSchema = z.object({
  follow_ups: z.array(z.object({
    item_id: z.string(),
    thread_id: z.string().nullable(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    reason: z.string(),
    suggested_action: z.string(),
    draft_reply: z.string().nullable(),
    days_waiting: z.number(),
  })),
});
export type FollowUpDetectionOutput = z.infer<typeof FollowUpDetectionOutputSchema>;

// Meeting prep output
export const MeetingPrepOutputSchema = z.object({
  event_id: z.string(),
  event_title: z.string(),
  briefing: z.string(),
  attendee_context: z.array(z.object({
    email: z.string(),
    name: z.string().nullable(),
    recent_interactions: z.string(),
    open_topics: z.array(z.string()),
  })),
  talking_points: z.array(z.string()),
  open_questions: z.array(z.string()),
  related_files: z.array(z.object({
    item_id: z.string(),
    title: z.string(),
    relevance: z.string(),
  })),
});
export type MeetingPrepOutput = z.infer<typeof MeetingPrepOutputSchema>;

// Weekly review output
export const WeeklyReviewOutputSchema = z.object({
  period: z.string(),
  summary: z.string(),
  topics_progressed: z.array(z.object({
    topic_id: z.string(),
    title: z.string(),
    progress_summary: z.string(),
    status: z.enum(['on_track', 'stalled', 'needs_attention', 'completed']),
  })),
  tasks_completed: z.number(),
  tasks_created: z.number(),
  items_processed: z.number(),
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  priorities_next_week: z.array(z.object({
    action: z.string(),
    topic_id: z.string().nullable(),
    priority: z.enum(['low', 'medium', 'high']),
    rationale: z.string(),
  })),
});
export type WeeklyReviewOutput = z.infer<typeof WeeklyReviewOutputSchema>;

// Smart compose output
export const SmartComposeOutputSchema = z.object({
  subject: z.string(),
  body_html: z.string(),
  body_text: z.string(),
  tone: z.string(),
  suggestions: z.array(z.string()),
});
export type SmartComposeOutput = z.infer<typeof SmartComposeOutputSchema>;

// Contact extract output
export const ContactExtractOutputSchema = z.object({
  contacts: z.array(z.object({
    email: z.string(),
    name: z.string().nullable(),
    organization: z.string().nullable(),
    role: z.string().nullable(),
    area: z.enum(['personal', 'career', 'work']).nullable(),
    notes: z.string().nullable(),
  })),
});
export type ContactExtractOutput = z.infer<typeof ContactExtractOutputSchema>;
