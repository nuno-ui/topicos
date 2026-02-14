# TopicOS — Architecture

## Stack
- **Frontend**: Next.js 15 (App Router, TypeScript, Tailwind CSS)
- **Backend**: Next.js API routes + Supabase Edge Functions
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google OAuth provider)
- **Storage**: Supabase Storage (for cached attachments)
- **AI**: Server-side provider abstraction (Anthropic / OpenAI)
- **Hosting**: Vercel

## Module Map

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/login/       # Login page
│   ├── (app)/              # Authenticated layout
│   │   ├── dashboard/      # Main dashboard
│   │   ├── topics/         # Topic list + [id] dossier
│   │   ├── inbox/          # Untriaged items
│   │   └── settings/       # Account settings
│   └── api/
│       ├── auth/           # OAuth callbacks
│       ├── sync/           # Sync endpoints
│       └── ai/             # AI agent endpoints
├── lib/
│   ├── supabase/           # Client + server helpers
│   ├── ai/                 # Provider abstraction + schemas
│   ├── connectors/google/  # Gmail, Calendar, Drive connectors
│   └── sync/               # Sync engine
├── components/
│   ├── ui/                 # Reusable UI primitives
│   ├── layout/             # App shell, sidebar, nav
│   ├── topics/             # Topic-specific components
│   ├── inbox/              # Inbox components
│   └── dashboard/          # Dashboard components
└── types/                  # Shared TypeScript types + Zod schemas
```

## Data Flow

### Sync Flow
1. User clicks "Sync Now" or cron triggers sync
2. API route creates `sync_run` record
3. For each connected `google_account`:
   - Fetch incremental changes since last cursor
   - Normalize into `items` rows
   - Update sync cursor
4. Mark `sync_run` complete with stats
5. Trigger Curator agent on new items

### AI Pipeline
1. New items arrive → Curator classifies area, suggests topics, extracts signals
2. On dashboard load → Triage scores all active topics, generates Today List
3. User requests deliverable → Executor generates draft from topic context

### Schema-First AI
All AI outputs validated with Zod schemas. On failure:
1. Retry once with repair prompt including error details
2. If still failing, return typed error object
3. All outputs stored in `ai_outputs` table

## Database Schema

### profiles
- id (uuid, PK, FK → auth.users)
- display_name (text)
- preferences (jsonb)
- created_at, updated_at (timestamptz)

### google_accounts
- id (uuid, PK)
- user_id (uuid, FK → profiles)
- email (text)
- provider_account_id (text)
- access_token (text, encrypted)
- refresh_token (text, encrypted)
- token_expires_at (timestamptz)
- scopes (text[])
- last_sync_at (timestamptz)
- created_at (timestamptz)

### items
- id (uuid, PK)
- user_id (uuid, FK → profiles)
- account_id (uuid, FK → google_accounts)
- source (text: gmail, calendar, drive, manual)
- external_id (text)
- title (text)
- snippet (text)
- body (text, nullable)
- url (text, nullable)
- occurred_at (timestamptz)
- metadata (jsonb)
- created_at, updated_at (timestamptz)
- UNIQUE(account_id, source, external_id)

### topics
- id (uuid, PK)
- user_id (uuid, FK → profiles)
- area (text: personal, career, work)
- title (text)
- description (text)
- summary (text, nullable — AI-generated)
- status (text: active, archived, completed)
- priority (int)
- created_at, updated_at (timestamptz)

### topic_links
- id (uuid, PK)
- user_id (uuid)
- topic_id (uuid, FK → topics)
- item_id (uuid, FK → items)
- confidence (float, nullable)
- reason (text, nullable)
- created_by (text: user, curator)
- created_at (timestamptz)

### tasks
- id (uuid, PK)
- user_id (uuid)
- topic_id (uuid, FK → topics, nullable)
- title (text)
- status (text: pending, in_progress, done)
- due_at (timestamptz, nullable)
- source_item_id (uuid, FK → items, nullable)
- created_by (text: user, curator, executor)
- rationale (text, nullable)
- created_at, updated_at (timestamptz)

### ai_outputs
- id (uuid, PK)
- user_id (uuid)
- kind (text: classify_area, suggest_topics, extract_signals, summarize_topic, urgency_score, generate_deliverable)
- model (text)
- input_json (jsonb)
- output_json (jsonb)
- tokens_used (int, nullable)
- created_at (timestamptz)

### sync_runs
- id (uuid, PK)
- user_id (uuid)
- account_id (uuid, FK → google_accounts)
- source (text)
- status (text: running, completed, failed)
- cursor (text, nullable)
- started_at (timestamptz)
- finished_at (timestamptz, nullable)
- stats (jsonb)
- error (jsonb, nullable)
