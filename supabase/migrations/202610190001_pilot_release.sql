-- Production Pilot: access and quotas are provisioned by operators, never browsers.
create table public.pilot_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  daily_ai_units integer not null default 10 check (daily_ai_units between 0 and 1000),
  daily_builds integer not null default 5 check (daily_builds between 0 and 100),
  expires_at timestamptz
);
create table public.pilot_limits (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  daily_ai_units integer not null default 100 check (daily_ai_units between 0 and 10000),
  daily_builds integer not null default 30 check (daily_builds between 0 and 1000)
);
insert into public.pilot_limits(id) values (true);
create table public.pilot_usage (
  day date not null,
  scope text not null,
  ai_units integer not null default 0,
  builds integer not null default 0,
  primary key(day, scope)
);
alter table public.pilot_access enable row level security;
alter table public.pilot_limits enable row level security;
alter table public.pilot_usage enable row level security;
revoke all on public.pilot_access, public.pilot_limits, public.pilot_usage from anon, authenticated;
grant select, insert, update, delete on public.pilot_access, public.pilot_limits, public.pilot_usage to service_role;

create function public.reserve_pilot_usage(p_user uuid, p_kind text, p_units integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  access_row public.pilot_access%rowtype;
  limits_row public.pilot_limits%rowtype;
  account_usage public.pilot_usage%rowtype;
  total_usage public.pilot_usage%rowtype;
  today date := (now() at time zone 'UTC')::date;
begin
  if p_kind not in ('ai', 'build') or p_units is null or p_units < 1 or p_units > 2
    or (p_kind = 'build' and p_units <> 1) then return false; end if;
  -- Global lock serialises reservations across users and survives API restarts.
  select * into limits_row from public.pilot_limits where id = true for update;
  select * into access_row from public.pilot_access where user_id = p_user for update;
  if access_row.user_id is null or not access_row.enabled or limits_row.enabled is distinct from true
    or (access_row.expires_at is not null and access_row.expires_at <= now()) then return false; end if;
  insert into public.pilot_usage(day, scope) values(today, 'global'), (today, p_user::text) on conflict do nothing;
  select * into total_usage from public.pilot_usage where day = today and scope = 'global' for update;
  select * into account_usage from public.pilot_usage where day = today and scope = p_user::text for update;
  if p_kind = 'ai' then
    if account_usage.ai_units + p_units > access_row.daily_ai_units or total_usage.ai_units + p_units > limits_row.daily_ai_units then return false; end if;
    update public.pilot_usage set ai_units = ai_units + p_units where day = today and scope in ('global', p_user::text);
  else
    if account_usage.builds + 1 > access_row.daily_builds or total_usage.builds + 1 > limits_row.daily_builds then return false; end if;
    update public.pilot_usage set builds = builds + 1 where day = today and scope in ('global', p_user::text);
  end if;
  return true;
end; $$;
revoke all on function public.reserve_pilot_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_pilot_usage(uuid, text, integer) to service_role;

-- Existing owner policies already protect project CRUD. Bound untrusted JSON storage.
revoke all on public.projects from anon;
alter table public.projects add constraint projects_data_size check (octet_length(venue_data::text) <= 256000) not valid;
alter table public.projects add constraint projects_data_object check (jsonb_typeof(venue_data) = 'object') not valid;

-- Public previews deliberately omit private source text and any unknown JSON fields.
create or replace function public.get_shared_project(p_share_token uuid)
returns table (id uuid, name text, venue_data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name,
    (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
     from jsonb_each(p.venue_data) e where e.key = any(array[
       'name','venueType','rows','seatsPerRow','sectors','rake','curve','stageWidth','stageDepth',
       'screenWidth','screenHeight','screenBottom','geometry','rowOverrides','stagePosition',
       'seatSpacing','rowSpacing','aisleWidth','edgeClearance','seatingLevels','obstacles',
       'categories','currency','room','planBoundary','calibration']))
    || jsonb_build_object('studyNotice', 'Approximate venue preview. Views and accessibility have not been independently verified.')
    || case when jsonb_typeof(p.venue_data->'architecturalDetails') = 'array' then jsonb_build_object(
      'architecturalDetails', (select coalesce(jsonb_agg(d || jsonb_build_object('source', 'Source withheld from public preview')), '[]'::jsonb)
      from jsonb_array_elements(p.venue_data->'architecturalDetails') d)) else '{}'::jsonb end,
    p.updated_at
  from public.projects p where p.share_enabled and p.share_token = p_share_token limit 1;
$$;
revoke all on function public.get_shared_project(uuid) from public;
grant execute on function public.get_shared_project(uuid) to anon, authenticated;

-- Prevent unlimited cloud project storage by a single account.
create function public.limit_project_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() <> new.owner_id then raise exception 'Owner mismatch' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
  -- Existing-ID upserts are updates, not new storage slots.
  if not exists (select 1 from public.projects where id = new.id)
    and (select count(*) from public.projects where owner_id = new.owner_id) >= 100 then
    raise exception 'Project limit reached. Remove an unused project before creating another.';
  end if;
  return new;
end; $$;
revoke all on function public.limit_project_count() from public, anon, authenticated;
create trigger project_count_limit before insert on public.projects for each row execute function public.limit_project_count();
