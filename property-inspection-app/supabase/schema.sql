-- ============================================================
-- Property Inspection App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- -------------------------------------------------------
-- PROFILES (extends Supabase Auth users)
-- -------------------------------------------------------
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text not null,
  role        text not null check (role in ('manager', 'inspector', 'maintenance_tech')),
  avatar_url  text,
  push_token  text,
  created_at  timestamptz default now()
);

-- Automatically create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'inspector')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -------------------------------------------------------
-- PROPERTIES
-- -------------------------------------------------------
create table public.properties (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  address     text not null,
  city        text not null default 'Fort Myers',
  state       text not null default 'FL',
  zip         text,
  photo_url   text,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);

-- -------------------------------------------------------
-- INSPECTOR ASSIGNMENTS
-- Ties an inspector to a property (recurring or active)
-- -------------------------------------------------------
create table public.property_assignments (
  id              uuid default gen_random_uuid() primary key,
  property_id     uuid references public.properties(id) on delete cascade,
  inspector_id    uuid references public.profiles(id) on delete cascade,
  frequency       text check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'ondemand')) default 'monthly',
  next_due_date   date,
  is_active       boolean default true,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz default now(),
  unique (property_id, inspector_id)
);

-- -------------------------------------------------------
-- INSPECTIONS
-- -------------------------------------------------------
create table public.inspections (
  id               uuid default gen_random_uuid() primary key,
  property_id      uuid references public.properties(id) on delete cascade,
  inspector_id     uuid references public.profiles(id),
  status           text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  condition_score  integer check (condition_score between 1 and 5),
  notes            text,
  submitted_at     timestamptz,
  created_at       timestamptz default now()
);

-- -------------------------------------------------------
-- CHECKLIST ITEMS
-- -------------------------------------------------------
create table public.checklist_items (
  id             uuid default gen_random_uuid() primary key,
  inspection_id  uuid references public.inspections(id) on delete cascade,
  category       text not null,
  item_name      text not null,
  status         text check (status in ('pass', 'fail', 'na', 'pending')) default 'pending',
  notes          text,
  sort_order     integer default 0,
  created_at     timestamptz default now()
);

-- -------------------------------------------------------
-- CHECKLIST ITEM PHOTOS
-- -------------------------------------------------------
create table public.item_photos (
  id                  uuid default gen_random_uuid() primary key,
  checklist_item_id   uuid references public.checklist_items(id) on delete cascade,
  storage_path        text not null,
  uploaded_at         timestamptz default now()
);

-- -------------------------------------------------------
-- MAINTENANCE ISSUES
-- -------------------------------------------------------
create table public.maintenance_issues (
  id                  uuid default gen_random_uuid() primary key,
  property_id         uuid references public.properties(id) on delete cascade,
  inspection_id       uuid references public.inspections(id) on delete set null,
  checklist_item_id   uuid references public.checklist_items(id) on delete set null,
  assigned_to         uuid references public.profiles(id) on delete set null,
  title               text not null,
  description         text,
  status              text not null default 'open' check (status in ('open', 'done')),
  resolution_notes    text,
  created_by          uuid references public.profiles(id),
  resolved_at         timestamptz,
  created_at          timestamptz default now()
);

-- -------------------------------------------------------
-- ISSUE PHOTOS
-- -------------------------------------------------------
create table public.issue_photos (
  id            uuid default gen_random_uuid() primary key,
  issue_id      uuid references public.maintenance_issues(id) on delete cascade,
  storage_path  text not null,
  uploaded_at   timestamptz default now()
);

-- -------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------
create table public.notifications (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  type        text not null,  -- 'inspection_assigned', 'inspection_submitted', 'issue_assigned'
  title       text not null,
  body        text not null,
  data        jsonb,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- -------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_assignments enable row level security;
alter table public.inspections enable row level security;
alter table public.checklist_items enable row level security;
alter table public.item_photos enable row level security;
alter table public.maintenance_issues enable row level security;
alter table public.issue_photos enable row level security;
alter table public.notifications enable row level security;

-- Helper: get current user's role
create or replace function public.current_user_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- PROFILES: users can read all, update own
create policy "profiles_select_all" on public.profiles for select using (auth.uid() is not null);
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());

-- PROPERTIES: all authenticated users can read; only managers can insert/update/delete
create policy "properties_select" on public.properties for select using (auth.uid() is not null);
create policy "properties_insert" on public.properties for insert with check (current_user_role() = 'manager');
create policy "properties_update" on public.properties for update using (current_user_role() = 'manager');
create policy "properties_delete" on public.properties for delete using (current_user_role() = 'manager');

-- PROPERTY_ASSIGNMENTS: all read; managers write
create policy "assignments_select" on public.property_assignments for select using (auth.uid() is not null);
create policy "assignments_insert" on public.property_assignments for insert with check (current_user_role() = 'manager');
create policy "assignments_update" on public.property_assignments for update using (current_user_role() = 'manager');
create policy "assignments_delete" on public.property_assignments for delete using (current_user_role() = 'manager');

-- INSPECTIONS: all read; inspectors/managers can insert; inspector owns their own update
create policy "inspections_select" on public.inspections for select using (auth.uid() is not null);
create policy "inspections_insert" on public.inspections for insert with check (
  current_user_role() in ('inspector', 'manager')
);
create policy "inspections_update" on public.inspections for update using (
  inspector_id = auth.uid() or current_user_role() = 'manager'
);

-- CHECKLIST_ITEMS: all read; inspectors/managers write
create policy "checklist_select" on public.checklist_items for select using (auth.uid() is not null);
create policy "checklist_insert" on public.checklist_items for insert with check (auth.uid() is not null);
create policy "checklist_update" on public.checklist_items for update using (auth.uid() is not null);
create policy "checklist_delete" on public.checklist_items for delete using (auth.uid() is not null);

-- ITEM_PHOTOS: all authenticated users
create policy "item_photos_select" on public.item_photos for select using (auth.uid() is not null);
create policy "item_photos_insert" on public.item_photos for insert with check (auth.uid() is not null);
create policy "item_photos_delete" on public.item_photos for delete using (auth.uid() is not null);

-- MAINTENANCE_ISSUES: all read; managers/inspectors create; assigned tech or manager update
create policy "issues_select" on public.maintenance_issues for select using (auth.uid() is not null);
create policy "issues_insert" on public.maintenance_issues for insert with check (
  current_user_role() in ('manager', 'inspector')
);
create policy "issues_update" on public.maintenance_issues for update using (
  assigned_to = auth.uid() or current_user_role() = 'manager'
);

-- ISSUE_PHOTOS: all authenticated
create policy "issue_photos_select" on public.issue_photos for select using (auth.uid() is not null);
create policy "issue_photos_insert" on public.issue_photos for insert with check (auth.uid() is not null);

-- NOTIFICATIONS: users see their own
create policy "notifications_select" on public.notifications for select using (user_id = auth.uid());
create policy "notifications_update" on public.notifications for update using (user_id = auth.uid());

-- -------------------------------------------------------
-- STORAGE BUCKETS
-- Run these separately in Supabase Dashboard → Storage
-- -------------------------------------------------------
-- Create bucket: inspection-photos (public: false, file size limit: 10MB)
-- Create bucket: property-photos  (public: true,  file size limit: 5MB)

-- -------------------------------------------------------
-- SEED: Demo data (optional — run after creating auth users)
-- -------------------------------------------------------
-- Insert sample properties
-- insert into public.properties (name, address, city, state, zip) values
--   ('Sunset Villas', '1420 Palm Beach Blvd', 'Fort Myers', 'FL', '33916'),
--   ('Riverfront Apartments', '3600 Fowler St', 'Fort Myers', 'FL', '33901'),
--   ('Gulf Breeze Condos', '14150 Metropolis Ave', 'Fort Myers', 'FL', '33912');
