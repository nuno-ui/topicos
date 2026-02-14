-- TopicOS v2 Migration: Contacts, Agents, Email Drafts, Triage
-- Run this in Supabase SQL Editor

-- ============================================================
-- NEW TABLES
-- ============================================================

-- Contacts (extracted from email/calendar data by AI)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  name text,
  organization text,
  role text,
  area text check (area in ('personal', 'career', 'work')),
  notes text,
  last_interaction_at timestamptz,
  interaction_count integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, email)
);

-- Contact-Topic Links
create table if not exists public.contact_topic_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  role text,
  created_at timestamptz default now(),
  unique(contact_id, topic_id)
);

-- Agent Runs (execution log for AI agents)
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_type text not null check (agent_type in (
    'curator', 'triage', 'follow_up', 'meeting_prep',
    'weekly_review', 'smart_compose', 'contact_intelligence'
  )),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  trigger text not null default 'manual' check (trigger in ('manual', 'post_sync', 'scheduled', 'on_demand')),
  input_json jsonb default '{}'::jsonb,
  output_json jsonb default '{}'::jsonb,
  actions_taken jsonb default '[]'::jsonb,
  tokens_used integer default 0,
  started_at timestamptz default now(),
  finished_at timestamptz,
  error jsonb
);

-- Email Drafts
create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid references public.google_accounts(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  to_addresses text[] default '{}',
  cc_addresses text[] default '{}',
  subject text not null,
  body_html text,
  body_text text,
  in_reply_to text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  gmail_draft_id text,
  agent_generated boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ALTER EXISTING TABLES
-- ============================================================

-- Items: add triage fields
alter table public.items add column if not exists triage_status text default 'pending';
alter table public.items add column if not exists triage_score float;
alter table public.items add column if not exists triage_reason text;

-- Topics: add AI-enriched fields
alter table public.topics add column if not exists people jsonb default '[]'::jsonb;
alter table public.topics add column if not exists next_steps jsonb default '[]'::jsonb;
alter table public.topics add column if not exists urgency_score integer;
alter table public.topics add column if not exists last_agent_update_at timestamptz;

-- ai_outputs: expand kind enum (drop and recreate constraint)
alter table public.ai_outputs drop constraint if exists ai_outputs_kind_check;
alter table public.ai_outputs add constraint ai_outputs_kind_check
  check (kind in (
    'classify_area', 'suggest_topics', 'extract_signals', 'summarize_topic',
    'urgency_score', 'generate_deliverable', 'paste_analysis',
    'auto_organize', 'triage_batch', 'follow_up_detect', 'meeting_brief',
    'weekly_review', 'smart_compose', 'contact_extract'
  ));

-- ============================================================
-- RLS POLICIES
-- ============================================================

alter table public.contacts enable row level security;
alter table public.contact_topic_links enable row level security;
alter table public.agent_runs enable row level security;
alter table public.email_drafts enable row level security;

-- Contacts
create policy "Users can view own contacts" on public.contacts for select using (auth.uid() = user_id);
create policy "Users can insert own contacts" on public.contacts for insert with check (auth.uid() = user_id);
create policy "Users can update own contacts" on public.contacts for update using (auth.uid() = user_id);
create policy "Users can delete own contacts" on public.contacts for delete using (auth.uid() = user_id);

-- Contact Topic Links
create policy "Users can view own contact_topic_links" on public.contact_topic_links for select using (auth.uid() = user_id);
create policy "Users can insert own contact_topic_links" on public.contact_topic_links for insert with check (auth.uid() = user_id);
create policy "Users can delete own contact_topic_links" on public.contact_topic_links for delete using (auth.uid() = user_id);

-- Agent Runs
create policy "Users can view own agent_runs" on public.agent_runs for select using (auth.uid() = user_id);
create policy "Users can insert own agent_runs" on public.agent_runs for insert with check (auth.uid() = user_id);
create policy "Users can update own agent_runs" on public.agent_runs for update using (auth.uid() = user_id);

-- Email Drafts
create policy "Users can view own email_drafts" on public.email_drafts for select using (auth.uid() = user_id);
create policy "Users can insert own email_drafts" on public.email_drafts for insert with check (auth.uid() = user_id);
create policy "Users can update own email_drafts" on public.email_drafts for update using (auth.uid() = user_id);
create policy "Users can delete own email_drafts" on public.email_drafts for delete using (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_contacts_user_id on public.contacts(user_id);
create index if not exists idx_contacts_email on public.contacts(email);
create index if not exists idx_contacts_area on public.contacts(area);
create index if not exists idx_contact_topic_links_contact_id on public.contact_topic_links(contact_id);
create index if not exists idx_contact_topic_links_topic_id on public.contact_topic_links(topic_id);
create index if not exists idx_agent_runs_user_id on public.agent_runs(user_id);
create index if not exists idx_agent_runs_agent_type on public.agent_runs(agent_type);
create index if not exists idx_agent_runs_status on public.agent_runs(status);
create index if not exists idx_email_drafts_user_id on public.email_drafts(user_id);
create index if not exists idx_email_drafts_topic_id on public.email_drafts(topic_id);
create index if not exists idx_email_drafts_status on public.email_drafts(status);
create index if not exists idx_items_triage_status on public.items(triage_status);
create index if not exists idx_items_triage_score on public.items(triage_score);
create index if not exists idx_topics_urgency_score on public.topics(urgency_score);

-- ============================================================
-- TRIGGERS (updated_at auto-update)
-- ============================================================

create or replace trigger update_contacts_updated_at
  before update on public.contacts
  for each row execute function public.update_updated_at();

create or replace trigger update_email_drafts_updated_at
  before update on public.email_drafts
  for each row execute function public.update_updated_at();
