-- Migration: Add competitor_links table
-- Run this in the Supabase SQL Editor

create table public.competitor_links (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  url text not null,
  address text,
  price numeric,
  currency text not null default 'USD',
  notes text,
  created_at timestamptz default now()
);

alter table public.competitor_links enable row level security;

create policy "View competitors" on public.competitor_links for select using (true);
create policy "Manage competitors" on public.competitor_links for insert with check (true);
create policy "Update competitors" on public.competitor_links for update using (true);
create policy "Delete competitors" on public.competitor_links for delete using (true);
