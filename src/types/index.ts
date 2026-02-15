export interface Topic {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  area: 'work' | 'personal' | 'project';
  due_date: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TopicItem {
  id: string;
  topic_id: string;
  source: 'gmail' | 'calendar' | 'drive' | 'slack' | 'manual';
  external_id: string;
  source_account_id: string | null;
  title: string;
  snippet: string;
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

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  notes: string | null;
  created_at: string;
}
