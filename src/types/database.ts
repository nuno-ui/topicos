export type Area = 'personal' | 'career' | 'work';
export type TopicStatus = 'active' | 'archived' | 'completed';
export type TaskStatus = 'pending' | 'in_progress' | 'done';
export type ItemSource = 'gmail' | 'calendar' | 'drive' | 'manual';
export type SyncStatus = 'running' | 'completed' | 'failed';
export type CreatedBy = 'user' | 'curator' | 'executor';
export type AiOutputKind =
  | 'classify_area'
  | 'suggest_topics'
  | 'extract_signals'
  | 'summarize_topic'
  | 'urgency_score'
  | 'generate_deliverable'
  | 'paste_analysis';

export interface Profile {
  id: string;
  display_name: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GoogleAccount {
  id: string;
  user_id: string;
  email: string;
  provider_account_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scopes: string[];
  last_sync_at: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  account_id: string | null;
  source: ItemSource;
  external_id: string | null;
  title: string;
  snippet: string | null;
  body: string | null;
  url: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  user_id: string;
  area: Area;
  title: string;
  description: string;
  summary: string | null;
  status: TopicStatus;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface TopicLink {
  id: string;
  user_id: string;
  topic_id: string;
  item_id: string;
  confidence: number | null;
  reason: string | null;
  created_by: CreatedBy;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  topic_id: string | null;
  title: string;
  status: TaskStatus;
  due_at: string | null;
  source_item_id: string | null;
  created_by: CreatedBy;
  rationale: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiOutput {
  id: string;
  user_id: string;
  kind: AiOutputKind;
  model: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  tokens_used: number | null;
  created_at: string;
}

export interface SyncRun {
  id: string;
  user_id: string;
  account_id: string;
  source: ItemSource;
  status: SyncStatus;
  cursor: string | null;
  started_at: string;
  finished_at: string | null;
  stats: Record<string, unknown>;
  error: Record<string, unknown> | null;
}

// Supabase Database type definition
// This follows the exact shape expected by @supabase/supabase-js
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      google_accounts: {
        Row: GoogleAccount;
        Insert: Omit<GoogleAccount, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<GoogleAccount>;
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: Omit<Item, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Item>;
        Relationships: [];
      };
      topics: {
        Row: Topic;
        Insert: Omit<Topic, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Topic>;
        Relationships: [];
      };
      topic_links: {
        Row: TopicLink;
        Insert: Omit<TopicLink, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<TopicLink>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Task>;
        Relationships: [];
      };
      ai_outputs: {
        Row: AiOutput;
        Insert: Omit<AiOutput, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<AiOutput>;
        Relationships: [];
      };
      sync_runs: {
        Row: SyncRun;
        Insert: Omit<SyncRun, 'id'> & { id?: string };
        Update: Partial<SyncRun>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
