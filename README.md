# Ilma's Route to Revenue

AI-assisted opportunity prioritization for a shared Vanta sales workspace.

## What is included

- Vanta-inspired, desktop-first opportunity dashboard.
- Salesforce Opportunity Report CSV upload and client-side mapping-friendly parser.
- Ranked opportunity scoring, tiers, filters, drill-in rationale, hard-stop alerts, manual override reason capture, and Salesforce-ready CSV export.
- Supabase schema migration with RLS policies for a shared workspace.
- Secure server-side OpenAI scoring route; never expose `OPENAI_API_KEY` in browser code.
- Cookie-based Supabase authentication with protected routes and a shared persistent workspace.
- Sole administrator access for `knutesteel@gmail.com`; all other authenticated users are members.
- Admin-only activity log for sign-ins, opportunity edits, scoring runs, overrides, model versions, and membership changes.
- Editable qualification evidence, score history, audit reasons, operational filters, sorting, lifecycle handling, and bulk actions.

## Local setup

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env.local` and populate Supabase and OpenAI values.
3. Create a Supabase project and apply `supabase/migrations/202607190001_initial_schema.sql`.
4. In Supabase Auth, enable Google OAuth and email magic links. Add `<site-url>/auth/callback` to the allowed redirect URLs.
5. Run `npm run dev` or `npm run build && npm run start`.

## Production deployment

1. Create a new GitHub repository named `ilmas-route-to-revenue` and push this project.
2. Import that repository into a new Vercel project.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, and optional `OPENAI_MODEL` to Vercel Environment Variables.
4. Apply the SQL migration to the new Supabase project and configure production redirect URLs in Supabase Auth.
5. Deploy, then verify sign-in, import, score run, override audit record, and Salesforce CSV export.

## Security and scoring notes

All application routes and AI scoring requests require a verified Supabase session. Row-level security limits workspace access, and only the configured sole administrator can read the activity log or create scoring-model versions. The Responses API uses Structured Outputs and `store: false`; missing category evidence scores 1, and resource requirements remain an inverse-scored 20% factor.
