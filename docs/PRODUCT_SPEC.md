# TopicOS — Product Specification (MVP)

## North Star
TopicOS is an AI-powered self-organization platform that connects to Google accounts and becomes a "life + work command center." It organizes everything by **Topic** across three Areas: Personal, Career, and Work.

## Core Concept
**TOPIC** is the central object — a living narrative + action hub. Everything else (emails, events, docs, notes) becomes an **Item** attached to one or more topics.

## MVP Scope

### Must Have
- [x] Sign in via Google (Supabase Auth)
- [x] Connect multiple Google accounts (Gmail, Calendar, Drive)
- [x] Incremental sync of Gmail, Calendar, Drive into unified items table
- [x] Inbox for untriaged items
- [x] Topic CRUD under Areas (Personal / Career / Work)
- [x] Attach items to topics (manual + AI suggestions)
- [x] Topic dossier page (summary, timeline, people, tasks, next steps)
- [x] Dashboard with urgency-ranked topics + Today List
- [x] Paste-In: paste text → detect topics, extract signals, suggest actions
- [x] Three AI agents: Curator, Triage, Executor

### Non-Goals (V1+)
- Sending emails from within the app
- Real-time collaborative editing
- Mobile native app
- Semantic search / RAG "Topic Brain" (MVP uses keyword search)
- Third-party integrations beyond Google (Slack, Notion, etc.)

## Pages
| Route | Purpose |
|-------|---------|
| `/dashboard` | Top topics, Today List, sync status |
| `/topics` | List/filter/create topics |
| `/topics/[id]` | Topic dossier |
| `/inbox` | Untriaged items, fast linking |
| `/settings` | Connected accounts, sync controls, preferences |

## AI Agents
1. **Curator** — classifies items into topics, extracts signals, generates summaries
2. **Triage** — ranks topics by urgency, produces Today List with explanations
3. **Executor** — generates deliverables (emails, reports, plans) from topic context

## Data Model
See ARCHITECTURE.md for full schema.
