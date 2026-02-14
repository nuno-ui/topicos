export type Area = 'personal' | 'career' | 'work';
export type TopicStatus = 'active' | 'archived' | 'completed';
export type TaskStatus = 'pending' | 'in_progress' | 'done';
export type ItemSource = 'gmail' | 'calendar' | 'drive' | 'manual';
export type SyncStatus = 'running' | 'completed' | 'failed';
export type CreatedBy = 'user' | 'curator' | 'executor';
export type TriageStatus = 'pending' | 'relevant' | 'low_relevance' | 'noise' | 'archived' | 'deleted';
export type AgentType = 'curator' | 'triage' | 'follow_up' | 'meeting_prep' | 'weekly_review' | 'smart_compose' | 'contact_intelligence';
export type AgentTrigger = 'manual' | 'post_sync' | 'scheduled' | 'on_demand';
export type DraftStatus = 'draft' | 'sent' | 'failed';
export type AiOutputKind =
  | 'classify_area'
  | 'suggest_topics'
  | 'extract_signals'
  | 'summarize_topic'
  | 'urgency_score'
  | 'generate_deliverable'
  | 'paste_analysis'
  | 'auto_organize'
  | 'triage_batch'
  | 'follow_up_detect'
  | 'meeting_brief'
  | 'weekly_review'
  | 'smart_compose'
  | 'contact_extract';

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
  triage_status: TriageStatus;
  triage_score: number | null;
  triage_reason: string | null;
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
  people: TopicPerson[];
  next_steps: TopicNextStep[];
  urgency_score: number | null;
  last_agent_update_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TopicPerson {
  name: string;
  email?: string;
  role?: string;
  organization?: string;
}

export interface TopicNextStep {
  action: string;
  priority: 'low' | 'medium' | 'high';
  rationale?: string;
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

export interface Contact {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  organization: string | null;
  role: string | null;
  area: Area | null;
  notes: string | null;
  last_interaction_at: string | null;
  interaction_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContactTopicLink {
  id: string;
  user_id: string;
  contact_id: string;
  topic_id: string;
  role: string | null;
  created_at: string;
}

export interface AgentRun {
  id: string;
  user_id: string;
  agent_type: AgentType;
  status: SyncStatus;
  trigger: AgentTrigger;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  actions_taken: AgentAction[];
  tokens_used: number;
  started_at: string;
  finished_at: string | null;
  error: Record<string, unknown> | null;
}

export interface AgentAction {
  action: string;
  target_type: string;
  target_id?: string;
  description: string;
}

export interface EmailDraft {
  id: string;
  user_id: string;
  account_id: string | null;
  topic_id: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body_html: string | null;
  body_text: string | null;
  in_reply_to: string | null;
  status: DraftStatus;
  gmail_draft_id: string | null;
  agent_generated: boolean;
  created_at: string;
  updated_at: string;
}

// Supabase Database type definition
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
        Insert: Omit<Item, 'id' | 'created_at' | 'updated_at' | 'triage_status' | 'triage_score' | 'triage_reason'> & { id?: string; created_at?: string; updated_at?: string; triage_status?: TriageStatus; triage_score?: number | null; triage_reason?: string | null };
        Update: Partial<Item>;
        Relationships: [];
      };
      topics: {
        Row: Topic;
        Insert: Omit<Topic, 'id' | 'created_at' | 'updated_at' | 'people' | 'next_steps' | 'urgency_score' | 'last_agent_update_at'> & { id?: string; created_at?: string; updated_at?: string; people?: TopicPerson[]; next_steps?: TopicNextStep[]; urgency_score?: number | null; last_agent_update_at?: string | null };
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
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'interaction_count'> & { id?: string; created_at?: string; updated_at?: string; interaction_count?: number };
        Update: Partial<Contact>;
        Relationships: [];
      };
      contact_topic_links: {
        Row: ContactTopicLink;
        Insert: Omit<ContactTopicLink, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<ContactTopicLink>;
        Relationships: [];
      };
      agent_runs: {
        Row: AgentRun;
        Insert: Omit<AgentRun, 'id' | 'started_at' | 'tokens_used'> & { id?: string; started_at?: string; tokens_used?: number };
        Update: Partial<AgentRun>;
        Relationships: [];
      };
      email_drafts: {
        Row: EmailDraft;
        Insert: Omit<EmailDraft, 'id' | 'created_at' | 'updated_at' | 'agent_generated'> & { id?: string; created_at?: string; updated_at?: string; agent_generated?: boolean };
        Update: Partial<EmailDraft>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
