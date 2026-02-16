export interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  area: 'work' | 'personal' | 'career';
  due_date: string | null;
  start_date: string | null;
  priority: number | null;
  tags: string[];
  folder_id: string | null;
  summary: string | null;
  notes: string | null;
  progress_percent: number | null;
  owner: string | null;
  stakeholders: string[];
  urgency_score: number | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TopicItem {
  id: string;
  topic_id: string;
  source: 'gmail' | 'calendar' | 'drive' | 'slack' | 'notion' | 'link' | 'manual';
  external_id: string;
  source_account_id: string | null;
  title: string;
  snippet: string;
  body: string | null;
  url: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GoogleAccount {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
}

export interface SlackAccount {
  id: string;
  user_id: string;
  team_id: string;
  team_name: string;
  access_token: string;
  scope: string;
}

export interface NotionAccount {
  id: string;
  user_id: string;
  workspace_id: string;
  workspace_name: string;
  access_token: string;
  bot_id: string | null;
  token_expires_at: string | null;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  organization: string | null;
  role: string | null;
  area: 'personal' | 'career' | 'work' | null;
  notes: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  metadata: ContactMetadata;
  created_at: string;
  updated_at: string;
  contact_topic_links?: ContactTopicLink[];
}

export interface ContactTopicLink {
  id?: string;
  topic_id: string;
  role: string | null;
  created_at?: string;
  topics: {
    title: string;
    status?: string;
    due_date?: string | null;
    priority?: number;
    area?: string;
    updated_at?: string;
    tags?: string[];
  } | null;
}

export interface ContactMetadata {
  phone?: string;
  linkedin?: string;
  twitter?: string;
  timezone?: string;
  preferred_contact_method?: 'email' | 'phone' | 'slack' | 'other';
  tags?: string[];
  intelligence?: {
    relationship_health: number;
    communication_pattern: string;
    sentiment: string;
    key_discussion_themes: string[];
    relationship_trajectory: string;
    action_recommendations: string[];
    summary: string;
    updated_at: string;
  };
  last_email_suggestion?: {
    should_email: boolean;
    urgency: string;
    reason: string;
    suggested_subject: string;
    key_points: string[];
    draft_body: string;
    generated_at: string;
  };
  interaction_history?: Array<{ month: string; count: number }>;
  [key: string]: unknown;
}
