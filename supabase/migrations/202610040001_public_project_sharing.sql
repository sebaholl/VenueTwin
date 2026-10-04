alter table public.projects
  add column if not exists share_enabled boolean not null default false,
  add column if not exists share_token uuid unique;

create or replace function public.get_shared_project(p_share_token uuid)
returns table (
  id uuid,
  name text,
  venue_data jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select projects.id, projects.name, projects.venue_data, projects.updated_at
  from public.projects
  where projects.share_enabled = true
    and projects.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_shared_project(uuid) from public;
grant execute on function public.get_shared_project(uuid) to anon, authenticated;

comment on function public.get_shared_project(uuid) is
  'Returns the limited read-only payload for one explicitly shared VenueTwin project.';
