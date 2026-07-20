-- Production-readiness additions for the shared opportunity workspace.
alter table public.workspace_members
  add column if not exists role text not null default 'member'
    check (role in ('admin', 'member'));

alter table public.opportunities
  add column if not exists lifecycle text not null default 'active'
    check (lifecycle in ('active', 'archived', 'closed_won', 'closed_lost')),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists last_scored_at timestamptz;

alter table public.score_runs
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists model_version integer,
  add column if not exists trigger text not null default 'manual'
    check (trigger in ('create', 'edit', 'manual', 'bulk', 'model_change'));

create index if not exists opportunities_workspace_lifecycle_idx
  on public.opportunities (workspace_id, lifecycle, updated_at desc);
create index if not exists score_runs_opportunity_created_idx
  on public.score_runs (opportunity_id, created_at desc);

-- New Supabase projects no longer expose tables to the Data API by default.
grant select on public.workspace_members to authenticated;
grant select, update on public.workspaces to authenticated;
grant select, insert, update on public.opportunities to authenticated;
grant select, insert on public.score_runs to authenticated;
grant select, insert on public.score_overrides to authenticated;
grant select, insert on public.scoring_models to authenticated;

-- Let any authenticated concept user join the single shared workspace. This is
-- intentionally explicit and can later be replaced with invitation-only access.
create or replace function public.bootstrap_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace uuid;
  member_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id into workspace from public.workspaces order by created_at limit 1;
  if workspace is null then
    insert into public.workspaces (name, allowed_email_domain)
    values ('Ilma''s Route to Revenue', '*') returning id into workspace;
  end if;

  select lower(email) into member_email from auth.users where id = auth.uid();
  insert into public.workspace_members (workspace_id, user_id, role)
  values (workspace, auth.uid(), case when member_email = 'knutesteel@gmail.com' then 'admin' else 'member' end)
  on conflict (workspace_id, user_id) do update
  set role = case when member_email = 'knutesteel@gmail.com' then 'admin' else 'member' end;

  -- Enforce the single-admin rule even if older membership data exists.
  update public.workspace_members m
  set role = case when u.email is not null and lower(u.email) = 'knutesteel@gmail.com' then 'admin' else 'member' end
  from auth.users u
  where m.workspace_id = workspace and u.id = m.user_id;
  return workspace;
end;
$$;

revoke all on function public.bootstrap_workspace() from public, anon;
grant execute on function public.bootstrap_workspace() to authenticated;

-- Admins may create new scoring-model versions; all members can read them.
drop policy if exists "members access scoring models" on public.scoring_models;
create policy "members read scoring models" on public.scoring_models for select to authenticated
using (exists (select 1 from public.workspace_members m where m.workspace_id = scoring_models.workspace_id and m.user_id = (select auth.uid())));
create policy "admins create scoring models" on public.scoring_models for insert to authenticated
with check (exists (select 1 from public.workspace_members m where m.workspace_id = scoring_models.workspace_id and m.user_id = (select auth.uid()) and m.role = 'admin'));

-- Keep updated_at reliable even when multiple clients edit a record.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at before update on public.opportunities
for each row execute function public.set_updated_at();

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_workspace_created_idx on public.activity_logs (workspace_id, created_at desc);
alter table public.activity_logs enable row level security;
grant select on public.activity_logs to authenticated;
create policy "sole admin reads activity" on public.activity_logs for select to authenticated
using (exists (
  select 1 from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = activity_logs.workspace_id
    and m.user_id = (select auth.uid())
    and m.role = 'admin'
    and lower(u.email) = 'knutesteel@gmail.com'
));

create or replace function public.audit_workspace_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  workspace uuid;
  entity text;
  new_data jsonb := '{}'::jsonb;
  old_data jsonb := '{}'::jsonb;
begin
  entity := tg_table_name;
  if tg_op <> 'DELETE' then new_data := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then old_data := to_jsonb(old); end if;
  workspace := case
    when tg_table_name in ('opportunities', 'scoring_models', 'workspace_members') then coalesce(new_data->>'workspace_id', old_data->>'workspace_id')::uuid
    when tg_table_name = 'score_runs' then (select o.workspace_id from public.opportunities o where o.id = coalesce(new_data->>'opportunity_id', old_data->>'opportunity_id')::uuid)
    when tg_table_name = 'score_overrides' then (select o.workspace_id from public.score_runs sr join public.opportunities o on o.id = sr.opportunity_id where sr.id = coalesce(new_data->>'score_run_id', old_data->>'score_run_id')::uuid)
  end;
  insert into public.activity_logs (workspace_id, actor_id, actor_email, action, entity_type, entity_id, detail)
  values (workspace, auth.uid(), (select email from auth.users where id = auth.uid()), lower(tg_op), entity, coalesce(new_data->>'id', old_data->>'id', new_data->>'user_id', old_data->>'user_id'), jsonb_build_object('new', new_data, 'old', old_data));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.audit_workspace_change() from public, anon, authenticated;

drop trigger if exists audit_opportunities on public.opportunities;
create trigger audit_opportunities after insert or update or delete on public.opportunities for each row execute function public.audit_workspace_change();
drop trigger if exists audit_scoring_models on public.scoring_models;
create trigger audit_scoring_models after insert or update or delete on public.scoring_models for each row execute function public.audit_workspace_change();
drop trigger if exists audit_score_runs on public.score_runs;
create trigger audit_score_runs after insert or update or delete on public.score_runs for each row execute function public.audit_workspace_change();
drop trigger if exists audit_score_overrides on public.score_overrides;
create trigger audit_score_overrides after insert or update or delete on public.score_overrides for each row execute function public.audit_workspace_change();
drop trigger if exists audit_workspace_members on public.workspace_members;
create trigger audit_workspace_members after insert or update or delete on public.workspace_members for each row execute function public.audit_workspace_change();

create or replace function public.log_session_activity(activity text default 'sign_in')
returns void language plpgsql security definer set search_path = '' as $$
declare workspace uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select workspace_id into workspace from public.workspace_members where user_id = auth.uid() order by created_at limit 1;
  if workspace is null then raise exception 'Workspace membership required'; end if;
  insert into public.activity_logs (workspace_id, actor_id, actor_email, action, entity_type, entity_id)
  values (workspace, auth.uid(), (select email from auth.users where id = auth.uid()), activity, 'session', auth.uid()::text);
end;
$$;
revoke all on function public.log_session_activity(text) from public, anon;
grant execute on function public.log_session_activity(text) to authenticated;
