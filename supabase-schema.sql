-- ============================================================
-- Reportes App - Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  phone text,
  photo_url text,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'agent')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Properties
create table public.properties (
  id uuid default gen_random_uuid() primary key,
  address text not null,
  neighborhood text not null,
  city text not null default 'Buenos Aires',
  property_type text not null default 'departamento'
    check (property_type in ('departamento', 'casa', 'ph', 'local', 'terreno', 'oficina')),
  rooms integer,
  size_m2 numeric,
  asking_price numeric,
  currency text not null default 'USD' check (currency in ('USD', 'ARS')),
  owner_name text not null,
  owner_phone text,
  owner_email text,
  public_slug text unique not null,
  cover_photo text,
  agent_id uuid references public.profiles(id) not null,
  status text not null default 'active'
    check (status in ('active', 'sold', 'suspended', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reports
create table public.reports (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references public.properties(id) on delete cascade not null,
  period_label text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles(id) not null,
  created_at timestamptz default now(),
  published_at timestamptz
);

-- Report Metrics (one per portal per report)
create table public.report_metrics (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.reports(id) on delete cascade not null,
  source text not null default 'zonaprop'
    check (source in ('zonaprop', 'argenprop', 'mercadolibre', 'manual')),
  impressions integer,
  portal_visits integer,
  inquiries integer,
  phone_calls integer,
  whatsapp integer,
  in_person_visits integer,
  offers integer,
  ranking_position integer,
  avg_market_price numeric,
  screenshot_url text,
  extracted_at timestamptz
);

-- Report Content sections
create table public.report_content (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.reports(id) on delete cascade not null,
  section text not null
    check (section in ('strategy', 'marketing', 'conclusion', 'benchmarks', 'price_reference')),
  title text not null default '',
  body text not null default '',
  sort_order integer not null default 0
);

-- Report Photos
create table public.report_photos (
  id uuid default gen_random_uuid() primary key,
  report_id uuid references public.reports(id) on delete cascade not null,
  photo_url text not null,
  caption text,
  photo_type text not null default 'visit_form'
    check (photo_type in ('visit_form', 'property', 'screenshot')),
  sort_order integer not null default 0
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.reports enable row level security;
alter table public.report_metrics enable row level security;
alter table public.report_content enable row level security;
alter table public.report_photos enable row level security;

-- Helper: check if user is admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select using (id = auth.uid() or public.is_admin());

create policy "Admins can manage all profiles"
  on public.profiles for all using (public.is_admin());

-- Properties policies
create policy "Agents see own properties"
  on public.properties for select using (agent_id = auth.uid() or public.is_admin());

create policy "Agents manage own properties"
  on public.properties for insert with check (agent_id = auth.uid() or public.is_admin());

create policy "Agents update own properties"
  on public.properties for update using (agent_id = auth.uid() or public.is_admin());

create policy "Agents delete own properties"
  on public.properties for delete using (agent_id = auth.uid() or public.is_admin());

-- Public access to properties via slug (for report pages)
create policy "Public can read active properties by slug"
  on public.properties for select using (true);

-- Reports policies
create policy "Agents see own reports"
  on public.reports for select using (
    created_by = auth.uid()
    or public.is_admin()
    or (status = 'published') -- public can see published reports
  );

create policy "Agents manage own reports"
  on public.reports for insert with check (created_by = auth.uid() or public.is_admin());

create policy "Agents update own reports"
  on public.reports for update using (created_by = auth.uid() or public.is_admin());

create policy "Agents delete own reports"
  on public.reports for delete using (created_by = auth.uid() or public.is_admin());

-- Metrics, content, photos — same pattern via report ownership
create policy "View metrics" on public.report_metrics for select using (true);
create policy "Manage metrics" on public.report_metrics for insert with check (true);
create policy "Update metrics" on public.report_metrics for update using (true);
create policy "Delete metrics" on public.report_metrics for delete using (true);

create policy "View content" on public.report_content for select using (true);
create policy "Manage content" on public.report_content for insert with check (true);
create policy "Update content" on public.report_content for update using (true);
create policy "Delete content" on public.report_content for delete using (true);

create policy "View photos" on public.report_photos for select using (true);
create policy "Manage photos" on public.report_photos for insert with check (true);
create policy "Update photos" on public.report_photos for update using (true);
create policy "Delete photos" on public.report_photos for delete using (true);

-- ============================================================
-- Storage Buckets
-- ============================================================
-- Run these in the Supabase dashboard under Storage:
-- 1. Create bucket: "property-photos" (public)
-- 2. Create bucket: "report-assets" (public)
-- 3. Create bucket: "screenshots" (private)

-- ============================================================
-- Updated_at trigger
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.update_updated_at();
