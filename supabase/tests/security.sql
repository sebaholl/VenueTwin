\set ON_ERROR_STOP on
-- ONLY run against a disposable empty PostgreSQL database, never production.
begin;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
\ir ../migrations/202609230001_initial_schema.sql
\ir ../migrations/202610040001_public_project_sharing.sql
\ir ../migrations/202610190001_pilot_release.sql
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.projects(id,owner_id,name,venue_data,share_enabled,share_token) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','A','{"name":"Public name","privateNotes":"SECRET","architecturalDetails":[{"id":"a","source":"SECRET"}]}',true,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','B','{}',false,null);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111', true);
do $$ begin
  if (select count(*) from public.projects) <> 1 then raise exception 'RLS isolation failed'; end if;
  update public.projects set name='Attack' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if found then raise exception 'Cross-owner write allowed'; end if;
  begin
    update public.projects set owner_id='22222222-2222-4222-8222-222222222222' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'Ownership takeover allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.reserve_pilot_usage('11111111-1111-4111-8111-111111111111','ai',1);
    raise exception 'Browser may reserve usage';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.pilot_access(user_id,enabled) values('11111111-1111-4111-8111-111111111111',true);
    raise exception 'Browser may grant itself access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  if (select venue_data::text like '%SECRET%' from public.get_shared_project('cccccccc-cccc-4ccc-8ccc-cccccccccccc')) then raise exception 'Public source leak'; end if;
  if exists(select 1 from public.get_shared_project('dddddddd-dddd-4ddd-8ddd-dddddddddddd')) then raise exception 'Unknown token exposed project'; end if;
end $$;
reset role;
update public.pilot_limits set enabled=true,daily_ai_units=3;
insert into public.pilot_access(user_id,enabled,daily_ai_units) values('11111111-1111-4111-8111-111111111111',true,2),('22222222-2222-4222-8222-222222222222',true,2);
do $$ begin
  if not public.reserve_pilot_usage('11111111-1111-4111-8111-111111111111','ai',2) then raise exception 'Valid reservation denied'; end if;
  if public.reserve_pilot_usage('11111111-1111-4111-8111-111111111111','ai',1) then raise exception 'Account quota bypass'; end if;
  if public.reserve_pilot_usage('22222222-2222-4222-8222-222222222222','ai',2) then raise exception 'Global quota bypass'; end if;
  if not public.reserve_pilot_usage('22222222-2222-4222-8222-222222222222','ai',1) then raise exception 'Remaining allowance denied'; end if;
  if public.reserve_pilot_usage('22222222-2222-4222-8222-222222222222',null,1) then raise exception 'Null kind accepted'; end if;
  if public.reserve_pilot_usage('22222222-2222-4222-8222-222222222222','ai',-1) then raise exception 'Negative quota bypass'; end if;
end $$;
update public.pilot_limits set enabled=false;
do $$ begin if public.reserve_pilot_usage('11111111-1111-4111-8111-111111111111','build',1) then raise exception 'Kill switch bypass'; end if; end $$;
rollback;
