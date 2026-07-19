-- Ilma's Route to Revenue: initial multi-user scoring workspace
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  allowed_email_domain text not null default 'vanta.com',
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  salesforce_opportunity_id text not null,
  source_data jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, salesforce_opportunity_id)
);

create table if not exists public.scoring_models (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null,
  model jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, version)
);

create table if not exists public.score_runs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  scoring_model_id uuid references public.scoring_models(id),
  status text not null check (status in ('queued','processing','completed','failed')),
  overall_score numeric(5,2),
  tier text,
  confidence text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.score_overrides (
  id uuid primary key default gen_random_uuid(),
  score_run_id uuid not null references public.score_runs(id) on delete cascade,
  category_key text,
  prior_value numeric(5,2),
  new_value numeric(5,2) not null,
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.opportunities enable row level security;
alter table public.scoring_models enable row level security;
alter table public.score_runs enable row level security;
alter table public.score_overrides enable row level security;

create policy "members read workspace" on public.workspaces for select to authenticated using (exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = (select auth.uid())));
create policy "members read memberships" on public.workspace_members for select to authenticated using (exists (select 1 from public.workspace_members mine where mine.workspace_id = workspace_id and mine.user_id = (select auth.uid())));
create policy "members access opportunities" on public.opportunities for all to authenticated using (exists (select 1 from public.workspace_members m where m.workspace_id = opportunities.workspace_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.workspace_members m where m.workspace_id = opportunities.workspace_id and m.user_id = (select auth.uid())));
create policy "members access scoring models" on public.scoring_models for all to authenticated using (exists (select 1 from public.workspace_members m where m.workspace_id = scoring_models.workspace_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.workspace_members m where m.workspace_id = scoring_models.workspace_id and m.user_id = (select auth.uid())));
create policy "members access score runs" on public.score_runs for all to authenticated using (exists (select 1 from public.opportunities o join public.workspace_members m on m.workspace_id = o.workspace_id where o.id = score_runs.opportunity_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.opportunities o join public.workspace_members m on m.workspace_id = o.workspace_id where o.id = score_runs.opportunity_id and m.user_id = (select auth.uid())));
create policy "members access overrides" on public.score_overrides for all to authenticated using (exists (select 1 from public.score_runs sr join public.opportunities o on o.id = sr.opportunity_id join public.workspace_members m on m.workspace_id = o.workspace_id where sr.id = score_overrides.score_run_id and m.user_id = (select auth.uid()))) with check ((select auth.uid()) = created_by);
