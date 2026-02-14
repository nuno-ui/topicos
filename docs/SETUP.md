# TopicOS — Setup Guide

## Prerequisites
- Node.js 20+
- npm
- Supabase account + project
- Google Cloud project with OAuth 2.0 credentials
- Vercel account (for deployment)

## Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tgxkcapqesnqsdivsfgi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Google OAuth (for multi-account connect)
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# AI Provider
ANTHROPIC_API_KEY=<api-key>
# or OPENAI_API_KEY=<api-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Database Setup

Run the migration SQL in Supabase SQL Editor or via CLI:

```bash
npx supabase db push
```

## Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Set environment variables
4. Deploy

## Google Cloud Setup

1. Create project in Google Cloud Console
2. Enable Gmail API, Calendar API, Drive API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://your-domain.vercel.app/api/auth/google/callback`
5. Set scopes: gmail.readonly, calendar.readonly, drive.readonly
