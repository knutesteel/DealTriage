-- Cover foreign keys used by RLS, audit, and history queries.
create index if not exists activity_logs_actor_id_idx on public.activity_logs (actor_id);
create index if not exists opportunities_updated_by_idx on public.opportunities (updated_by);
create index if not exists score_overrides_created_by_idx on public.score_overrides (created_by);
create index if not exists score_overrides_score_run_id_idx on public.score_overrides (score_run_id);
create index if not exists score_runs_created_by_idx on public.score_runs (created_by);
create index if not exists score_runs_scoring_model_id_idx on public.score_runs (scoring_model_id);
create index if not exists scoring_models_created_by_idx on public.scoring_models (created_by);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
