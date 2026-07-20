-- Remove recursive membership policies that caused PostgREST reads and writes
-- across the shared workspace to fail with HTTP 500.
drop policy if exists "members read memberships" on public.workspace_members;
create policy "members read own membership"
on public.workspace_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "sole admin reads activity" on public.activity_logs;
create policy "workspace admins read activity"
on public.activity_logs for select to authenticated
using (exists (
  select 1
  from public.workspace_members m
  where m.workspace_id = activity_logs.workspace_id
    and m.user_id = (select auth.uid())
    and m.role = 'admin'
));

-- Avoid emitting membership UPDATE audit records on every page load when no
-- role actually changed.
create or replace function public.bootstrap_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace uuid;
  member_email text;
  desired_role text;
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
  desired_role := case when member_email = 'knutesteel@gmail.com' then 'admin' else 'member' end;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (workspace, auth.uid(), desired_role)
  on conflict (workspace_id, user_id) do update
  set role = excluded.role
  where public.workspace_members.role is distinct from excluded.role;

  update public.workspace_members m
  set role = case when lower(u.email) = 'knutesteel@gmail.com' then 'admin' else 'member' end
  from auth.users u
  where m.workspace_id = workspace
    and u.id = m.user_id
    and m.role is distinct from case when lower(u.email) = 'knutesteel@gmail.com' then 'admin' else 'member' end;

  return workspace;
end;
$$;

revoke all on function public.bootstrap_workspace() from public, anon;
grant execute on function public.bootstrap_workspace() to authenticated;
