# Ilma's Route to Revenue

AI-assisted opportunity prioritization for a shared Vanta sales workspace.

## What is included

- Vanta-inspired, desktop-first opportunity dashboard.
- Salesforce Opportunity Report CSV upload and client-side mapping-friendly parser.
- Ranked opportunity scoring, tiers, filters, drill-in rationale, hard-stop alerts, manual override reason capture, and Salesforce-ready CSV export.
- Supabase schema migration with RLS policies for a shared workspace.
- Secure server-side OpenAI scoring route; never expose `OPENAI_API_KEY` in browser code.

## Local setup

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env.local` and populate Supabase and OpenAI values.
3. Create a Supabase project and apply `supabase/migrations/202607190001_initial_schema.sql`.
4. In Supabase Auth, enable Google OAuth and email magic links. Configure `@vanta.com` domain admission in the application membership flow and add the Vercel redirect URL.
5. Run `npm run dev` or `npm run build && npm run start`.

## Production deployment

1. Create a new GitHub repository named `ilmas-route-to-revenue` and push this project.
2. Import that repository into a new Vercel project.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, and optional `OPENAI_MODEL` to Vercel Environment Variables.
4. Apply the SQL migration to the new Supabase project and configure production redirect URLs in Supabase Auth.
5. Deploy, then verify sign-in, import, score run, override audit record, and Salesforce CSV export.

## Important implementation note

The current UI demonstrates the complete dashboard workflow with local demo data and deterministic import scoring so it can run before production credentials are provisioned. The `/api/score` route is ready for the managed OpenAI key; connect the import job to it and persist its structured result to Supabase when the production project is provisioned. It uses the Responses API with Structured Outputs and `store: false` so scoring results conform to the data contract and request state is not retained by the API.
