# TopicOS v3 — Complete Build Prompt for Claude Code

## Overview

Build **TopicOS v3** — a topic-centric productivity platform where users create Topics (projects, initiatives, goals) and connect them to relevant communications, events, files, and messages across multiple sources (Gmail, Google Calendar, Google Drive, Slack) via **live search** rather than full data sync.

### Core Philosophy Change

**The old TopicOS (v1/v2)** synced ALL emails, events, files, and messages into a local database, then used AI to organize them into topics. This created massive complexity: API rate limits, storage issues, stale data, sync failures, and showing users an overwhelming amount of raw data they didn't ask for.

**TopicOS v3** flips this: Users create Topics first, then **search** their connected sources (Gmail, Slack, Calendar, Drive) to find and link relevant items. No bulk sync. No storing thousands of emails. The app is a **topic workspace with search-powered source connections**.

### Key Principles

1. **Topics are the center** — everything revolves around topics/projects
2. **Search, don't sync** — query source APIs on demand, don't mirror data
3. **Link, don't store** — save references (IDs, URLs) not full content
4. **User drives + AI assists** — manual search with an "AI Find" button that searches all sources for topic-relevant items
5. **Lightweight storage** — only store topic metadata, linked references, and user notes

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router, Server Components, Route Handlers)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS + Radix UI primitives
- **Icons**: Lucide React
- **State**: Zustand (minimal, for modals/UI state)
- **AI**: Anthropic Claude API (claude-sonnet-4-5-20250929 or claude-haiku-4-5-20251001)
- **Toasts**: Sonner
- **Auth**: Supabase Auth (magic link or Google OAuth for login) + separate OAuth for source connections
- **APIs**: Google APIs (googleapis), Slack Web API (direct fetch)

---

## Database Schema (Supabase PostgreSQL)

### Table: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `google_accounts`
Connected Google accounts for API access.
```sql
CREATE TABLE google_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  provider_account_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);
```

### Table: `slack_accounts`
Connected Slack workspaces with USER tokens (not bot tokens).
```sql
CREATE TABLE slack_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  access_token TEXT NOT NULL,  -- User token (xoxp-...), NOT bot token
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, team_id)
);
```

### Table: `topics`
The core entity. A topic = a project, initiative, goal, thread of work.
```sql
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  area TEXT CHECK (area IN ('personal', 'career', 'work')) DEFAULT 'work',
  status TEXT CHECK (status IN ('active', 'archived', 'completed')) DEFAULT 'active',
  priority INTEGER DEFAULT 0,
  color TEXT,  -- hex color for UI
  icon TEXT,   -- emoji or icon name
  tags TEXT[] DEFAULT '{}',
  -- AI-generated fields (populated by AI agent on demand)
  summary TEXT,
  next_steps JSONB DEFAULT '[]',  -- [{action, priority, rationale}]
  urgency_score REAL,
  -- Project tracking
  due_date DATE,
  owner TEXT,
  stakeholders TEXT[] DEFAULT '{}',
  notes TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Table: `topic_items`
References to items from external sources linked to a topic. **We store references, not full content.**
```sql
CREATE TABLE topic_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  -- Source identification
  source TEXT NOT NULL CHECK (source IN ('gmail', 'calendar', 'drive', 'slack', 'manual')),
  source_account_id UUID,  -- google_accounts.id or slack_accounts.id
  external_id TEXT NOT NULL,  -- Source-specific ID (Gmail msg ID, event ID, file ID, slack ts)
  -- Cached display data (lightweight, for showing in UI without re-fetching)
  title TEXT NOT NULL,
  snippet TEXT,  -- first 200 chars for display
  url TEXT,      -- deep link to open in source app
  occurred_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',  -- source-specific (from, to, channel, attendees, etc.)
  -- Linking metadata
  linked_by TEXT CHECK (linked_by IN ('user', 'ai')) DEFAULT 'user',
  confidence REAL,  -- AI confidence score (null for manual links)
  link_reason TEXT,  -- why this was linked (AI explanation or user note)
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(topic_id, source, external_id)
);
```

### Table: `contacts`
People the user interacts with, extracted from linked items or added manually.
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  organization TEXT,
  role TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);
```

### Table: `contact_topic_links`
```sql
CREATE TABLE contact_topic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  role TEXT,  -- their role on this topic
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, topic_id)
);
```

### Table: `ai_runs`
Log of AI operations for transparency.
```sql
CREATE TABLE ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,  -- 'ai_find', 'summarize', 'suggest_next_steps', etc.
  model TEXT,
  input_summary TEXT,  -- brief description of what was sent to AI
  output_json JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies
Enable RLS on ALL tables. Every table should have policies that only allow users to see/modify their own data:
```sql
-- Example for topics:
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own topics" ON topics
  FOR ALL USING (auth.uid() = user_id);
-- Repeat for all tables
```

---

## Authentication

### Supabase Auth (Login)
- Users sign up/login via Supabase Auth (magic link or Google OAuth)
- Session managed by Supabase SSR cookies
- Protected routes check `supabase.auth.getUser()`

### Google OAuth (Source Connection)
Separate OAuth flow to connect Google accounts for API access:
- **Scopes needed (READ-ONLY for search):**
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/calendar.readonly`
  - `https://www.googleapis.com/auth/drive.readonly`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`
- Flow: `/api/auth/google/connect` → Google consent → `/api/auth/google/callback` → save tokens
- Token refresh: Before each API call, check if token is expiring within 5 mins, refresh if needed

### Slack OAuth (Source Connection)
OAuth v2 flow with **USER scopes** (not bot scopes):
- **User scopes needed:**
  - `channels:history`, `channels:read` (public channels)
  - `groups:history`, `groups:read` (private channels)
  - `im:history`, `im:read` (DMs)
  - `mpim:history`, `mpim:read` (group DMs)
  - `users:read`, `users:read.email` (user profiles)
  - `team:read` (workspace info)
  - `search:read` (search messages) — **CRITICAL: this enables Slack search API**
- Flow: `/api/auth/slack/connect` → Slack consent → `/api/auth/slack/callback` → save user token
- **IMPORTANT**: Use `user_scope` parameter (not `scope`) in the OAuth URL. The user token comes back in `tokenData.authed_user.access_token`, not the top-level `access_token`.

---

## Core Feature: Source Search API

This is the **heart of v3**. Instead of syncing, we search source APIs on demand.

### API Route: `POST /api/search`

**Request body:**
```typescript
{
  query: string;          // search query
  sources: string[];      // ['gmail', 'calendar', 'drive', 'slack'] — which sources to search
  topic_id?: string;      // optional: if searching within context of a topic
  date_from?: string;     // ISO date filter
  date_to?: string;       // ISO date filter
  max_results?: number;   // default 20 per source
}
```

**Response:**
```typescript
{
  results: {
    source: string;
    items: SearchResult[];
    error?: string;  // if a source failed
  }[];
}

interface SearchResult {
  external_id: string;
  source: string;
  source_account_id: string;
  title: string;
  snippet: string;
  url: string;
  occurred_at: string;
  metadata: Record<string, any>;  // source-specific
  already_linked?: boolean;  // true if already in topic_items for this topic
}
```

### Search Implementation per Source

#### Gmail Search (`src/lib/search/gmail.ts`)
```typescript
async function searchGmail(accessToken: string, query: string, maxResults: number): Promise<SearchResult[]>
```
- Use Gmail API: `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q={query}&maxResults={maxResults}`
- The `q` parameter supports Gmail search operators: `from:john subject:quarterly after:2025/01/01`
- For each message ID returned, fetch metadata with `format: metadata` (NOT full — we don't need bodies for search results)
- Extract: subject, from, to, date, labels, snippet
- Build URL: `https://mail.google.com/mail/#inbox/{messageId}`
- Return as SearchResult[]

#### Calendar Search (`src/lib/search/calendar.ts`)
```typescript
async function searchCalendar(accessToken: string, query: string, dateFrom?: string, dateTo?: string, maxResults: number): Promise<SearchResult[]>
```
- Use Calendar API: `GET https://www.googleapis.com/calendar/v3/calendars/primary/events?q={query}&timeMin={dateFrom}&timeMax={dateTo}&maxResults={maxResults}&singleEvents=true&orderBy=startTime`
- Extract: summary, description, start/end times, attendees, location
- Build URL: `https://calendar.google.com/calendar/event?eid={base64(eventId)}`
- Return as SearchResult[]

#### Drive Search (`src/lib/search/drive.ts`)
```typescript
async function searchDrive(accessToken: string, query: string, maxResults: number): Promise<SearchResult[]>
```
- Use Drive API: `GET https://www.googleapis.com/drive/v3/files?q=fullText contains '{query}'&pageSize={maxResults}&fields=files(id,name,mimeType,description,webViewLink,modifiedTime,owners,size)`
- Extract: file name, mimeType, description, size, modified time
- URL: `webViewLink` from API response
- Return as SearchResult[]

#### Slack Search (`src/lib/search/slack.ts`)
```typescript
async function searchSlack(accessToken: string, query: string, maxResults: number): Promise<SearchResult[]>
```
- **USE the Slack `search.messages` API** (requires `search:read` user scope):
  `POST https://slack.com/api/search.messages` with `query={query}&count={maxResults}&sort=timestamp`
- This searches across ALL channels, DMs, and group DMs the user has access to
- Extract: text, channel name, user name, timestamp, permalink
- URL: use `permalink` from API response
- Return as SearchResult[]

**IMPORTANT**: Slack's `search.messages` API is the proper way to search — it works like the search bar in the Slack app. This is FAR better than fetching all conversations and filtering locally. It requires the `search:read` user scope.

### Token Refresh Middleware
Before any API call, check token freshness:
```typescript
async function getValidGoogleToken(accountId: string): Promise<string> {
  const account = await getGoogleAccount(accountId);
  if (account.token_expires_at < new Date(Date.now() + 5 * 60 * 1000)) {
    const newToken = await refreshGoogleToken(account.refresh_token);
    await updateGoogleAccountToken(accountId, newToken);
    return newToken.access_token;
  }
  return account.access_token;
}
```

---

## Core Feature: AI Find (Auto-Search for Topic)

When the user clicks "AI Find" on a topic, the system uses AI to generate search queries and then searches all connected sources.

### API Route: `POST /api/ai/find`

**Request body:**
```typescript
{
  topic_id: string;
}
```

**Process:**
1. Fetch topic (title, description, tags, existing linked items, contacts)
2. Send to Claude:
   ```
   System: You are a search query generator. Given a topic/project description, generate optimal search queries for each data source to find relevant communications, events, and files.

   Generate search queries that would find emails, calendar events, Drive files, and Slack messages related to this topic. Use source-specific syntax:
   - Gmail: Use Gmail search operators (from:, subject:, after:, has:attachment, etc.)
   - Calendar: Simple keyword queries
   - Drive: Simple keyword queries
   - Slack: Use Slack search modifiers (from:, in:, during:, etc.)

   Return 2-4 queries per source, from most specific to broader.
   ```
3. Claude returns:
   ```json
   {
     "gmail_queries": ["subject:Q1 marketing from:team@company.com", "Q1 marketing launch"],
     "calendar_queries": ["marketing review", "Q1 planning"],
     "drive_queries": ["Q1 marketing plan", "marketing launch 2025"],
     "slack_queries": ["Q1 marketing launch", "marketing campaign in:#marketing"]
   }
   ```
4. Execute searches in parallel across all sources using the generated queries
5. Deduplicate results (same external_id)
6. Filter out items already linked to this topic
7. Use Claude to rank results by relevance to the topic:
   ```
   Given this topic and these search results, rank them by relevance.
   Return the top results with a confidence score (0-1) and brief reason.
   ```
8. Return ranked results to UI
9. User can select which items to link to the topic

**Response:**
```typescript
{
  results: {
    external_id: string;
    source: string;
    source_account_id: string;
    title: string;
    snippet: string;
    url: string;
    occurred_at: string;
    metadata: object;
    ai_confidence: number;
    ai_reason: string;
  }[];
  queries_used: { source: string; queries: string[] }[];
}
```

---

## UI/UX Design

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  TopicOS                              [User] [Settings] │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │              Main Content                    │
│          │                                              │
│ Dashboard│  (Topic list, Topic detail, Search, etc.)    │
│ Topics   │                                              │
│ Contacts │                                              │
│ Settings │                                              │
│          │                                              │
│          │                                              │
│ ──────── │                                              │
│ Sources: │                                              │
│ ✅ Gmail │                                              │
│ ✅ Slack │                                              │
│ ✅ Drive │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Pages

#### 1. Dashboard (`/dashboard`)
- Welcome message with user name and date
- **Active Topics** — grid/list of active topics with:
  - Title, area badge (work/personal/career), color indicator
  - Number of linked items per source (📧 12, 💬 5, 📅 3, 📁 2)
  - Due date if set
  - Quick action: "Open" button
- **Quick Actions** row:
  - "New Topic" button
  - "Search All Sources" button (opens global search)
- **Recent Activity** — last 10 items linked to any topic (chronological)

#### 2. Topics List (`/topics`)
- Grid of topic cards (similar to Notion/Linear project cards)
- Each card shows: title, description preview, area color, linked item counts, status badge, due date
- Filter by: area (work/personal/career), status (active/archived/completed), tags
- Sort by: updated_at, priority, due_date, urgency_score
- "New Topic" button → opens create topic modal
- Click topic → navigates to topic detail

#### 3. Topic Detail (`/topics/[id]`) — **THE MOST IMPORTANT PAGE**
This is where 80% of the user's time is spent.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Topics     [Edit] [Archive] [Delete]        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔵 Q1 Marketing Launch                     [Active]   │
│  Area: Work  |  Due: Mar 31  |  Priority: High         │
│  Tags: #marketing #q1 #launch                          │
│                                                         │
│  Description: Launch the Q1 marketing campaign...       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🔍 Search sources for this topic               │    │
│  │ [Search query input................................]│
│  │                                                 │    │
│  │ [🔎 Search]  [🤖 AI Find]  [+ Manual Link]    │    │
│  │                                                 │    │
│  │ Source filters: [✅Gmail] [✅Slack] [✅Calendar] │    │
│  │                  [✅Drive]                       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌── Search Results (when searching) ──────────────┐    │
│  │  ☐ Email: "Re: Q1 Marketing Budget" from CEO    │    │
│  │    Jan 15, 2025  📧  [Open in Gmail]            │    │
│  │                                                  │    │
│  │  ☐ Slack: "Can we discuss the campaign..." #mkt  │    │
│  │    Jan 16, 2025  💬  [Open in Slack]            │    │
│  │                                                  │    │
│  │  [Link Selected to Topic]                       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ── Linked Items ──────────────────────────────────     │
│  Tab: [All (24)] [Emails (12)] [Messages (5)]          │
│       [Events (4)] [Files (3)]                          │
│                                                         │
│  📧 "Q1 Marketing Budget Approved" — CEO, Jan 20       │
│     "Great news, the budget is..." [Open] [Unlink]     │
│                                                         │
│  💬 "Launch timeline confirmed" — #marketing, Jan 18    │
│     "We're good to go for..." [Open] [Unlink]          │
│                                                         │
│  📅 "Marketing Review Meeting" — Jan 25, 2-3pm         │
│     "Weekly review with..." [Open] [Unlink]            │
│                                                         │
│  📁 "Q1 Marketing Plan.docx" — Modified Jan 22         │
│     "Google Docs" [Open] [Unlink]                      │
│                                                         │
│  ── Topic Intelligence (AI-generated) ─────────────     │
│  Summary: [Auto-generated summary of linked items]     │
│  Next Steps: [AI-suggested action items]                │
│  Key People: [Extracted contacts with roles]            │
│  [🤖 Refresh AI Analysis]                              │
│                                                         │
│  ── Notes ─────────────────────────────────────────     │
│  [Freeform notes textarea...]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Interactions on Topic Detail:**

1. **Manual Search**: User types a query in the search box, selects which sources to search, clicks "Search". Results appear with checkboxes. User selects relevant results and clicks "Link Selected to Topic" to add them.

2. **AI Find**: User clicks "🤖 AI Find". AI generates queries based on topic context, searches all sources, ranks results by relevance. User reviews and selects which to link.

3. **Manual Link**: User can paste a URL or ID to manually add an item reference.

4. **View Linked Items**: All linked items shown in a timeline, grouped by source tabs. Each item shows: title, snippet, date, source icon, "Open" link (opens in source app), "Unlink" button.

5. **AI Analysis**: A section showing AI-generated summary, next steps, and key people — computed from the linked items. "Refresh" button re-runs the analysis.

6. **Notes**: Freeform text area for user notes about the topic.

#### 4. Global Search (`/search` or modal)
- Search input that queries all connected sources simultaneously
- Results grouped by source with tabs
- Each result has "Link to Topic" dropdown to associate with a topic
- Quick link: results that aren't linked to any topic show a "+" button to create a new topic from them

#### 5. Contacts (`/contacts`)
- List of all contacts (extracted from linked items or manually added)
- Each contact shows: name, email, organization, topics they're involved in
- Click contact → shows all topics they appear in, all linked items involving them

#### 6. Settings (`/settings`)
- **Connected Accounts** section:
  - Google accounts with email, connected scopes, disconnect button
  - Slack workspaces with name, disconnect button
  - "Connect Google Account" / "Connect Slack Workspace" buttons
- **Profile** section: display name, avatar
- **Preferences**: theme, default area, etc.

---

## API Routes

### Auth
- `GET /api/auth/google/connect` — Start Google OAuth
- `GET /api/auth/google/callback` — Handle Google OAuth callback
- `DELETE /api/auth/google/[id]` — Disconnect Google account
- `GET /api/auth/slack/connect` — Start Slack OAuth (with user_scope!)
- `GET /api/auth/slack/callback` — Handle Slack OAuth callback
- `DELETE /api/auth/slack/[id]` — Disconnect Slack workspace

### Topics
- `GET /api/topics` — List user's topics (with filters)
- `POST /api/topics` — Create topic
- `GET /api/topics/[id]` — Get topic with linked items
- `PATCH /api/topics/[id]` — Update topic
- `DELETE /api/topics/[id]` — Delete topic

### Topic Items (linked references)
- `GET /api/topics/[id]/items` — List linked items for a topic
- `POST /api/topics/[id]/items` — Link item(s) to topic (batch)
- `DELETE /api/topics/[id]/items/[itemId]` — Unlink item from topic

### Search
- `POST /api/search` — Search across sources (core feature!)
- `POST /api/ai/find` — AI-powered search for a topic

### AI
- `POST /api/ai/analyze-topic` — Generate summary, next steps, contacts for a topic
- `POST /api/ai/suggest-queries` — Generate search queries for a topic (used by AI Find)

### Contacts
- `GET /api/contacts` — List contacts
- `POST /api/contacts` — Create/upsert contact
- `GET /api/contacts/[id]` — Get contact with topics

---

## Implementation Order

### Phase 1: Foundation (must be rock-solid)
1. Next.js project setup with Tailwind + Radix UI
2. Supabase project setup with schema (run SQL above)
3. RLS policies on all tables
4. Supabase Auth (login page with magic link)
5. Protected layout with sidebar navigation
6. Profile setup

### Phase 2: Source Connections
1. Google OAuth connect/disconnect flow
2. Slack OAuth connect/disconnect flow (USER tokens with `user_scope`!)
3. Settings page showing connected accounts
4. Token refresh utility for Google

### Phase 3: Topics CRUD
1. Topics list page with cards
2. Create topic modal
3. Topic detail page (basic — title, description, area, status, notes)
4. Edit/archive/delete topic

### Phase 4: Search (the core)
1. Gmail search implementation
2. Calendar search implementation
3. Drive search implementation
4. Slack search implementation (`search.messages` API)
5. Unified search API route
6. Search UI on topic detail page (manual search)
7. Search results display with checkboxes
8. Link selected results to topic
9. Global search page/modal

### Phase 5: Linked Items Display
1. Linked items list on topic detail (grouped by source tabs)
2. Item cards with title, snippet, date, source icon, deep link
3. Unlink functionality
4. Sorting and filtering within linked items

### Phase 6: AI Features
1. AI provider setup (Anthropic Claude)
2. AI Find — auto-search for topic
3. AI Analyze Topic — generate summary + next steps from linked items
4. AI runs logging

### Phase 7: Contacts
1. Contact extraction from linked items (from email addresses, Slack users)
2. Contacts list page
3. Contact-topic associations
4. Contact detail view

### Phase 8: Polish
1. Dashboard page
2. Toast notifications (Sonner)
3. Loading states and skeletons
4. Error boundaries
5. Keyboard shortcuts
6. Responsive design

---

## Critical Implementation Details

### 1. Slack OAuth — MUST use User Scopes

This is the #1 thing that went wrong in v1/v2. When connecting Slack:

```typescript
// In /api/auth/slack/connect:
const userScopes = [
  'channels:history', 'channels:read',
  'groups:history', 'groups:read',
  'im:history', 'im:read',
  'mpim:history', 'mpim:read',
  'users:read', 'users:read.email',
  'team:read', 'search:read',  // search:read is CRITICAL for search.messages API
].join(',');

const authUrl = new URL('https://slack.com/oauth/v2/authorize');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('user_scope', userScopes);  // NOT 'scope'!
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('state', userId);
```

```typescript
// In /api/auth/slack/callback:
// The user token is in authed_user.access_token, NOT the top-level access_token
const userToken = tokenData.authed_user?.access_token;
const accessToken = userToken ?? tokenData.access_token;
```

Also, in the Slack App settings at api.slack.com, the scopes must be added under **"User Token Scopes"**, NOT "Bot Token Scopes". Bot tokens cannot read user DMs.

### 2. Search vs. Sync Architecture

**DO NOT build a sync engine.** There is no cron job, no background sync, no bulk data import. Every data access goes through the search APIs.

When a user links an item to a topic, we store:
- `external_id` (the Gmail message ID, Slack message ts, etc.)
- `title`, `snippet` — cached for display without re-fetching
- `url` — deep link to open in the original app
- `metadata` — small JSON with key fields (from, to, channel, attendees)

We do NOT store: full email bodies, full message text, file contents, etc.

### 3. Google Token Refresh

Google access tokens expire after 1 hour. Before any API call:
```typescript
async function getValidGoogleToken(supabase, accountId): Promise<{accessToken, email}> {
  const account = await supabase.from('google_accounts').select('*').eq('id', accountId).single();

  if (new Date(account.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    // Token expiring within 5 min, refresh it
    const { access_token, expiry_date } = await refreshToken(account.refresh_token);
    await supabase.from('google_accounts').update({
      access_token,
      token_expires_at: new Date(expiry_date).toISOString()
    }).eq('id', accountId);
    return { accessToken: access_token, email: account.email };
  }

  return { accessToken: account.access_token, email: account.email };
}
```

### 4. Slack `search.messages` API

This is the correct way to search Slack (not fetching all conversations):
```typescript
async function searchSlack(token: string, query: string, count: number = 20): Promise<SearchResult[]> {
  const res = await fetch('https://slack.com/api/search.messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      query,
      count: count.toString(),
      sort: 'timestamp',
      sort_dir: 'desc',
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack search error: ${data.error}`);

  return (data.messages?.matches ?? []).map(match => ({
    external_id: `${match.channel?.id}-${match.ts}`,
    source: 'slack',
    title: `${match.username} in #${match.channel?.name}`,
    snippet: match.text?.slice(0, 200),
    url: match.permalink,
    occurred_at: new Date(parseFloat(match.ts) * 1000).toISOString(),
    metadata: {
      channel_id: match.channel?.id,
      channel_name: match.channel?.name,
      user_id: match.user,
      username: match.username,
      is_dm: match.channel?.is_im ?? false,
    },
  }));
}
```

### 5. Parallel Search Execution

When searching multiple sources, execute in parallel:
```typescript
const results = await Promise.allSettled([
  sources.includes('gmail') ? searchGmail(googleToken, query, maxResults) : null,
  sources.includes('calendar') ? searchCalendar(googleToken, query, dateFrom, dateTo, maxResults) : null,
  sources.includes('drive') ? searchDrive(googleToken, query, maxResults) : null,
  sources.includes('slack') ? searchSlack(slackToken, query, maxResults) : null,
].filter(Boolean));
```

### 6. AI Provider

Use Anthropic Claude. Support both Sonnet (for complex tasks) and Haiku (for fast/cheap tasks):
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callClaude(systemPrompt: string, userPrompt: string, model?: string) {
  const response = await anthropic.messages.create({
    model: model ?? 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return response;
}
```

### 7. Error Handling for Source APIs

Each source search should fail gracefully:
```typescript
// In the search API route:
for (const source of sources) {
  try {
    const items = await searchSource(source, token, query);
    results.push({ source, items });
  } catch (error) {
    results.push({ source, items: [], error: error.message });
    // Don't fail the whole request if one source errors
  }
}
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth (for source connection)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Slack OAuth (for source connection)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# AI
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## File Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              # Protected layout with sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── topics/
│   │   │   ├── page.tsx            # Topics list
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Topic detail (THE main page)
│   │   ├── search/
│   │   │   └── page.tsx            # Global search
│   │   ├── contacts/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── google/
│   │   │   │   ├── connect/route.ts
│   │   │   │   ├── callback/route.ts
│   │   │   │   └── [id]/route.ts   # DELETE to disconnect
│   │   │   └── slack/
│   │   │       ├── connect/route.ts
│   │   │       ├── callback/route.ts
│   │   │       └── [id]/route.ts
│   │   ├── topics/
│   │   │   ├── route.ts            # GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts        # GET, PATCH, DELETE
│   │   │       └── items/
│   │   │           ├── route.ts    # GET list, POST link
│   │   │           └── [itemId]/
│   │   │               └── route.ts # DELETE unlink
│   │   ├── search/
│   │   │   └── route.ts            # POST unified search
│   │   ├── ai/
│   │   │   ├── find/route.ts       # POST AI Find for topic
│   │   │   └── analyze/route.ts    # POST analyze topic
│   │   └── contacts/
│   │       └── route.ts
│   └── layout.tsx                   # Root layout
├── components/
│   ├── layout/
│   │   └── sidebar.tsx
│   ├── topics/
│   │   ├── topic-card.tsx
│   │   ├── topic-list.tsx
│   │   ├── topic-detail.tsx         # Main topic detail component
│   │   ├── topic-search.tsx         # Search panel within topic
│   │   ├── topic-linked-items.tsx   # Linked items display
│   │   ├── topic-ai-panel.tsx       # AI analysis panel
│   │   └── create-topic-modal.tsx
│   ├── search/
│   │   ├── search-input.tsx
│   │   ├── search-results.tsx
│   │   └── search-result-card.tsx
│   ├── contacts/
│   │   └── contacts-list.tsx
│   ├── settings/
│   │   └── settings-client.tsx
│   └── ui/
│       ├── button.tsx
│       ├── input.tsx
│       ├── badge.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── tabs.tsx
│       ├── dropdown-menu.tsx
│       ├── skeleton.tsx
│       └── ... (Radix UI primitives)
├── lib/
│   ├── search/
│   │   ├── gmail.ts                # Gmail search implementation
│   │   ├── calendar.ts             # Calendar search implementation
│   │   ├── drive.ts                # Drive search implementation
│   │   ├── slack.ts                # Slack search implementation
│   │   └── index.ts                # Unified search orchestrator
│   ├── ai/
│   │   └── provider.ts             # Claude API wrapper
│   ├── auth/
│   │   └── google-tokens.ts        # Token refresh utility
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   └── server.ts               # Server client + service client
│   └── utils.ts                     # cn(), formatDate(), etc.
├── stores/
│   └── ui-store.ts                  # Zustand for UI state (modals, search)
├── types/
│   ├── database.ts                  # Supabase-generated types
│   └── search.ts                    # Search result types
└── hooks/
    └── use-keyboard-shortcuts.ts
```

---

## What NOT to Build

1. **No sync engine** — no background data import, no cron jobs, no bulk fetch
2. **No inbox** — users don't see "all emails" or "all messages"
3. **No full content storage** — don't store email bodies or full message text
4. **No triage/scoring system** — no AI scoring of individual items
5. **No email compose** — users compose in Gmail directly
6. **No event creation** — users create events in Google Calendar directly
7. **No file upload** — users manage files in Google Drive directly
8. **No bot tokens** — only user OAuth tokens for all sources

---

## Summary of What Makes v3 Different

| Aspect | v1/v2 (Old) | v3 (New) |
|--------|------------|----------|
| Data approach | Sync everything, store locally | Search on demand, store references |
| Core entity | Items (emails, messages) | Topics (projects, goals) |
| User flow | See all items → organize into topics | Create topics → find related items |
| Storage | Full email bodies, all messages | Lightweight references (title, URL, ID) |
| API usage | Bulk fetch (rate limits, timeouts) | Search queries (fast, targeted) |
| AI role | Auto-organize thousands of items | Help find & analyze per topic |
| Complexity | High (sync engine, cron, queues) | Low (search API calls on demand) |
| Data freshness | Stale (depends on last sync) | Always fresh (queries source directly) |
| Slack approach | Bot token, invite to channels | User token, search all messages |
