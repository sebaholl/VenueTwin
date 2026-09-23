create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  venue_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

create policy "Users can read their own projects"
  on public.projects for select
  using (auth.uid() = owner_id);

create policy "Users can create their own projects"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = owner_id);
