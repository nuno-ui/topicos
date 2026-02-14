-- TopicOS Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Google Accounts
create table if not exists public.google_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  provider_account_id text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz,
  scopes text[] default '{}',
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, provider_account_id)
);

-- Items
create table if not exists public.items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid references public.google_accounts(id) on delete set null,
  source text not null check (source in ('gmail', 'calendar', 'drive', 'manual')),
  external_id text,
  title text not null,
  snippet text,
  body text,
  url text,
  occurred_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(account_id, source, external_id)
);

-- Topics
create table if not exists public.topics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area text not null check (area in ('personal', 'career', 'work')),
  title text not null,
  description text default '',
  summary text,
  status text not null default 'active' check (status in ('active', 'archived', 'completed')),
  priority integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Topic Links (item <-> topic)
create table if not exists public.topic_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  confidence float,
  reason text,
  created_by text not null default 'user' check (created_by in ('user', 'curator', 'executor')),
  created_at timestamptz default now(),
  unique(topic_id, item_id)
);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  due_at timestamptz,
  source_item_id uuid references public.items(id) on delete set null,
  created_by text not null default 'user' check (created_by in ('user', 'curator', 'executor')),
  rationale text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- AI Outputs
create table if not exists public.ai_outputs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('classify_area', 'suggest_topics', 'extract_signals', 'summarize_topic', 'urgency_score', 'generate_deliverable', 'paste_analysis')),
  model text not null,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  tokens_used integer,
  created_at timestamptz default now()
);

-- Sync Runs
create table if not exists public.sync_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.google_accounts(id) on delete cascade,
  source text not null check (source in ('gmail', 'calendar', 'drive')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  cursor text,
  started_at timestamptz default now(),
  finished_at timestamptz,
  stats jsonb default '{}'::jsonb,
  error jsonb
);

-- Indexes
create index if not exists idx_items_user_id on public.items(user_id);
create index if not exists idx_items_source on public.items(source);
create index if not exists idx_items_occurred_at on public.items(occurred_at desc);
create index if not exists idx_items_account_source_external on public.items(account_id, source, external_id);
create index if not exists idx_topics_user_id on public.topics(user_id);
create index if not exists idx_topics_area on public.topics(area);
create index if not exists idx_topics_status on public.topics(status);
create index if not exists idx_topic_links_topic_id on public.topic_links(topic_id);
create index if not exists idx_topic_links_item_id on public.topic_links(item_id);
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_topic_id on public.tasks(topic_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_sync_runs_account_id on public.sync_runs(account_id);
create index if not exists idx_google_accounts_user_id on public.google_accounts(user_id);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.google_accounts enable row level security;
alter table public.items enable row level security;
alter table public.topics enable row level security;
alter table public.topic_links enable row level security;
alter table public.tasks enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.sync_runs enable row level security;

-- RLS Policies: users can only access their own data
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can view own google accounts" on public.google_accounts for select using (auth.uid() = user_id);
create policy "Users can insert own google accounts" on public.google_accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own google accounts" on public.google_accounts for update using (auth.uid() = user_id);
create policy "Users can delete own google accounts" on public.google_accounts for delete using (auth.uid() = user_id);

create policy "Users can view own items" on public.items for select using (auth.uid() = user_id);
create policy "Users can insert own items" on public.items for insert with check (auth.uid() = user_id);
create policy "Users can update own items" on public.items for update using (auth.uid() = user_id);

create policy "Users can view own topics" on public.topics for select using (auth.uid() = user_id);
create policy "Users can insert own topics" on public.topics for insert with check (auth.uid() = user_id);
create policy "Users can update own topics" on public.topics for update using (auth.uid() = user_id);
create policy "Users can delete own topics" on public.topics for delete using (auth.uid() = user_id);

create policy "Users can view own topic links" on public.topic_links for select using (auth.uid() = user_id);
create policy "Users can insert own topic links" on public.topic_links for insert with check (auth.uid() = user_id);
create policy "Users can delete own topic links" on public.topic_links for delete using (auth.uid() = user_id);

create policy "Users can view own tasks" on public.tasks for select using (auth.uid() = user_id);
create policy "Users can insert own tasks" on public.tasks for insert with check (auth.uid() = user_id);
create policy "Users can update own tasks" on public.tasks for update using (auth.uid() = user_id);
create policy "Users can delete own tasks" on public.tasks for delete using (auth.uid() = user_id);

create policy "Users can view own ai outputs" on public.ai_outputs for select using (auth.uid() = user_id);
create policy "Users can insert own ai outputs" on public.ai_outputs for insert with check (auth.uid() = user_id);

create policy "Users can view own sync runs" on public.sync_runs for select using (auth.uid() = user_id);
create policy "Users can insert own sync runs" on public.sync_runs for insert with check (auth.uid() = user_id);
create policy "Users can update own sync runs" on public.sync_runs for update using (auth.uid() = user_id);

-- Updated_at trigger function
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles for each row execute procedure public.update_updated_at();
create trigger update_items_updated_at before update on public.items for each row execute procedure public.update_updated_at();
create trigger update_topics_updated_at before update on public.topics for each row execute procedure public.update_updated_at();
create trigger update_tasks_updated_at before update on public.tasks for each row execute procedure public.update_updated_at();
