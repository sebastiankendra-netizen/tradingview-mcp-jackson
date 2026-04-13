-- =========================================================
-- PROPERTY INSPECTION APP — SUPABASE SCHEMA
-- Merged: structural best-practices from Perplexity +
--         column names / enum values from app code.
--
-- Storage paths:
--   property-photos/   {property_id}/{uuid}.{ext}
--   inspection-photos/ {inspection_id}/{checklist_item_id}/{uuid}.{ext}
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- =========================================================

begin;

create extension if not exists "pgcrypto";

-- =========================================================
-- ENUMS  (values match app code exactly)
-- =========================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('manager', 'inspector', 'maintenance_tech');
  end if;

  if not exists (select 1 from pg_type where typname = 'inspection_status') then
    create type public.inspection_status as enum ('in_progress', 'submitted');
  end if;

  if not exists (select 1 from pg_type where typname = 'checklist_status') then
    create type public.checklist_status as enum ('pass', 'fail', 'na', 'pending');
  end if;

  if not exists (select 1 from pg_type where typname = 'issue_status') then
    create type public.issue_status as enum ('open', 'done');
  end if;

  if not exists (select 1 from pg_type where typname = 'issue_priority') then
    create type public.issue_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;

  if not exists (select 1 from pg_type where typname = 'assignment_frequency') then
    create type public.assignment_frequency as enum ('weekly', 'biweekly', 'monthly', 'quarterly', 'ondemand');
  end if;
end $$;

-- =========================================================
-- FUNCTIONS
-- =========================================================

-- Auto-set updated_at on every UPDATE
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Role helpers — used inside RLS policies
create or replace function public.is_manager()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'manager'
  );
$$;

create or replace function public.is_inspector()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'inspector'
  );
$$;

create or replace function public.is_maintenance_tech()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'maintenance_tech'
  );
$$;

-- Auto-create profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(
      (new.raw_user_meta_data ->> 'role')::public.app_role,
      'inspector'
    ),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- =========================================================
-- TABLES
-- =========================================================

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  role        public.app_role not null default 'inspector',
  full_name   text        not null default '',
  email       text,
  phone       text,
  avatar_url  text,
  push_token  text,                          -- expo push token for notifications
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_email_unique unique (email)
);

-- ---------------------------------------------------------
-- PROPERTIES
-- ---------------------------------------------------------
create table if not exists public.properties (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  address         text        not null,
  city            text        not null default 'Fort Myers',
  state           text        not null default 'FL',
  zip             text,
  unit_count      integer     check (unit_count is null or unit_count >= 0),
  photo_url       text,                      -- cover photo (public URL)
  notes           text,
  created_by      uuid        references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- PROPERTY PHOTOS  (gallery shots of the property itself)
-- ---------------------------------------------------------
create table if not exists public.property_photos (
  id                  uuid        primary key default gen_random_uuid(),
  property_id         uuid        not null references public.properties(id) on delete cascade,
  uploaded_by         uuid        references public.profiles(id) on delete set null,
  storage_path        text        not null,
  file_name           text,
  caption             text,
  uploaded_at         timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint property_photos_unique_path unique (storage_path)
);

-- ---------------------------------------------------------
-- PROPERTY ASSIGNMENTS  (which inspector covers which property)
-- ---------------------------------------------------------
create table if not exists public.property_assignments (
  id              uuid                        primary key default gen_random_uuid(),
  property_id     uuid                        not null references public.properties(id) on delete cascade,
  inspector_id    uuid                        not null references public.profiles(id) on delete cascade,
  frequency       public.assignment_frequency not null default 'monthly',
  next_due_date   date,
  is_active       boolean                     not null default true,
  created_by      uuid                        references public.profiles(id) on delete set null,
  created_at      timestamptz                 not null default now(),
  updated_at      timestamptz                 not null default now(),
  constraint property_assignments_unique unique (property_id, inspector_id)
);

-- ---------------------------------------------------------
-- INSPECTIONS
-- ---------------------------------------------------------
create table if not exists public.inspections (
  id               uuid                    primary key default gen_random_uuid(),
  property_id      uuid                    not null references public.properties(id) on delete cascade,
  inspector_id     uuid                    not null references public.profiles(id) on delete restrict,
  status           public.inspection_status not null default 'in_progress',
  condition_score  integer                 check (condition_score between 1 and 5),
  notes            text,
  submitted_at     timestamptz,
  created_at       timestamptz             not null default now(),
  updated_at       timestamptz             not null default now()
);

-- ---------------------------------------------------------
-- CHECKLIST ITEMS
-- ---------------------------------------------------------
create table if not exists public.checklist_items (
  id             uuid                   primary key default gen_random_uuid(),
  inspection_id  uuid                   not null references public.inspections(id) on delete cascade,
  category       text                   not null,
  item_name      text                   not null,
  status         public.checklist_status not null default 'pending',
  notes          text,
  sort_order     integer                not null default 0,
  created_at     timestamptz            not null default now(),
  updated_at     timestamptz            not null default now()
);

-- ---------------------------------------------------------
-- ITEM PHOTOS  (photos taken during checklist — per checklist item)
-- ---------------------------------------------------------
create table if not exists public.item_photos (
  id                  uuid        primary key default gen_random_uuid(),
  checklist_item_id   uuid        not null references public.checklist_items(id) on delete cascade,
  inspection_id       uuid        not null references public.inspections(id) on delete cascade,
  uploaded_by         uuid        references public.profiles(id) on delete set null,
  storage_path        text        not null,
  file_name           text,
  caption             text,
  uploaded_at         timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint item_photos_unique_path unique (storage_path)
);

-- ---------------------------------------------------------
-- MAINTENANCE ISSUES
-- ---------------------------------------------------------
create table if not exists public.maintenance_issues (
  id                  uuid                 primary key default gen_random_uuid(),
  property_id         uuid                 not null references public.properties(id) on delete cascade,
  inspection_id       uuid                 references public.inspections(id) on delete set null,
  checklist_item_id   uuid                 references public.checklist_items(id) on delete set null,
  assigned_to         uuid                 references public.profiles(id) on delete set null,
  created_by          uuid                 not null references public.profiles(id) on delete restrict,
  title               text                 not null,
  description         text,
  priority            public.issue_priority not null default 'medium',
  status              public.issue_status   not null default 'open',
  resolution_notes    text,
  resolved_at         timestamptz,
  created_at          timestamptz          not null default now(),
  updated_at          timestamptz          not null default now()
);

-- ---------------------------------------------------------
-- ISSUE PHOTOS
-- ---------------------------------------------------------
create table if not exists public.issue_photos (
  id            uuid        primary key default gen_random_uuid(),
  issue_id      uuid        not null references public.maintenance_issues(id) on delete cascade,
  uploaded_by   uuid        references public.profiles(id) on delete set null,
  storage_path  text        not null,
  file_name     text,
  uploaded_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint issue_photos_unique_path unique (storage_path)
);

-- ---------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------
create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  type        text        not null,   -- 'inspection_assigned' | 'inspection_submitted' | 'issue_assigned'
  title       text        not null,
  body        text        not null,
  data        jsonb,
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- =========================================================
-- TRIGGERS — auto-set updated_at
-- =========================================================

create or replace trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace trigger set_properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create or replace trigger set_property_photos_updated_at
  before update on public.property_photos
  for each row execute function public.set_updated_at();

create or replace trigger set_property_assignments_updated_at
  before update on public.property_assignments
  for each row execute function public.set_updated_at();

create or replace trigger set_inspections_updated_at
  before update on public.inspections
  for each row execute function public.set_updated_at();

create or replace trigger set_checklist_items_updated_at
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

create or replace trigger set_item_photos_updated_at
  before update on public.item_photos
  for each row execute function public.set_updated_at();

create or replace trigger set_maintenance_issues_updated_at
  before update on public.maintenance_issues
  for each row execute function public.set_updated_at();

create or replace trigger set_issue_photos_updated_at
  before update on public.issue_photos
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_profiles_role
  on public.profiles(role);

create index if not exists idx_properties_city_state
  on public.properties(city, state);

create index if not exists idx_properties_created_by
  on public.properties(created_by);

create index if not exists idx_property_photos_property_id
  on public.property_photos(property_id);

create index if not exists idx_property_assignments_property_id
  on public.property_assignments(property_id);

create index if not exists idx_property_assignments_inspector_id
  on public.property_assignments(inspector_id);

create index if not exists idx_property_assignments_active
  on public.property_assignments(is_active) where is_active = true;

create index if not exists idx_inspections_property_id
  on public.inspections(property_id);

create index if not exists idx_inspections_inspector_id
  on public.inspections(inspector_id);

create index if not exists idx_inspections_status
  on public.inspections(status);

create index if not exists idx_inspections_submitted_at
  on public.inspections(submitted_at desc);

create index if not exists idx_checklist_items_inspection_id
  on public.checklist_items(inspection_id);

create index if not exists idx_checklist_items_status
  on public.checklist_items(status);

create index if not exists idx_checklist_items_category
  on public.checklist_items(category);

create index if not exists idx_item_photos_checklist_item_id
  on public.item_photos(checklist_item_id);

create index if not exists idx_item_photos_inspection_id
  on public.item_photos(inspection_id);

create index if not exists idx_maintenance_issues_property_id
  on public.maintenance_issues(property_id);

create index if not exists idx_maintenance_issues_assigned_to
  on public.maintenance_issues(assigned_to);

create index if not exists idx_maintenance_issues_status_priority
  on public.maintenance_issues(status, priority);

create index if not exists idx_maintenance_issues_inspection_id
  on public.maintenance_issues(inspection_id);

create index if not exists idx_issue_photos_issue_id
  on public.issue_photos(issue_id);

create index if not exists idx_notifications_user_id_read
  on public.notifications(user_id, read);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles             enable row level security;
alter table public.properties           enable row level security;
alter table public.property_photos      enable row level security;
alter table public.property_assignments enable row level security;
alter table public.inspections          enable row level security;
alter table public.checklist_items      enable row level security;
alter table public.item_photos          enable row level security;
alter table public.maintenance_issues   enable row level security;
alter table public.issue_photos         enable row level security;
alter table public.notifications        enable row level security;

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_manager());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_manager())
  with check (id = auth.uid() or public.is_manager());

-- ---------------------------------------------------------
-- PROPERTIES
-- ---------------------------------------------------------

drop policy if exists "properties_select" on public.properties;
create policy "properties_select"
  on public.properties for select to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.property_assignments pa
      where pa.property_id = properties.id and pa.inspector_id = auth.uid() and pa.is_active
    )
  );

drop policy if exists "properties_insert" on public.properties;
create policy "properties_insert"
  on public.properties for insert to authenticated
  with check (public.is_manager());

drop policy if exists "properties_update" on public.properties;
create policy "properties_update"
  on public.properties for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists "properties_delete" on public.properties;
create policy "properties_delete"
  on public.properties for delete to authenticated
  using (public.is_manager());

-- ---------------------------------------------------------
-- PROPERTY PHOTOS
-- ---------------------------------------------------------

drop policy if exists "property_photos_select" on public.property_photos;
create policy "property_photos_select"
  on public.property_photos for select to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.property_assignments pa
      where pa.property_id = property_photos.property_id and pa.inspector_id = auth.uid()
    )
  );

drop policy if exists "property_photos_insert" on public.property_photos;
create policy "property_photos_insert"
  on public.property_photos for insert to authenticated
  with check (public.is_manager());

drop policy if exists "property_photos_delete" on public.property_photos;
create policy "property_photos_delete"
  on public.property_photos for delete to authenticated
  using (public.is_manager());

-- ---------------------------------------------------------
-- PROPERTY ASSIGNMENTS
-- ---------------------------------------------------------

drop policy if exists "assignments_select" on public.property_assignments;
create policy "assignments_select"
  on public.property_assignments for select to authenticated
  using (public.is_manager() or inspector_id = auth.uid());

drop policy if exists "assignments_insert" on public.property_assignments;
create policy "assignments_insert"
  on public.property_assignments for insert to authenticated
  with check (public.is_manager());

drop policy if exists "assignments_update" on public.property_assignments;
create policy "assignments_update"
  on public.property_assignments for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists "assignments_delete" on public.property_assignments;
create policy "assignments_delete"
  on public.property_assignments for delete to authenticated
  using (public.is_manager());

-- ---------------------------------------------------------
-- INSPECTIONS
-- ---------------------------------------------------------

drop policy if exists "inspections_select" on public.inspections;
create policy "inspections_select"
  on public.inspections for select to authenticated
  using (
    public.is_manager()
    or inspector_id = auth.uid()
    or exists (
      select 1 from public.property_assignments pa
      where pa.property_id = inspections.property_id and pa.inspector_id = auth.uid()
    )
    or exists (
      select 1 from public.maintenance_issues mi
      where mi.inspection_id = inspections.id and mi.assigned_to = auth.uid()
    )
  );

drop policy if exists "inspections_insert" on public.inspections;
create policy "inspections_insert"
  on public.inspections for insert to authenticated
  with check (
    public.is_manager()
    or (
      inspector_id = auth.uid()
      and exists (
        select 1 from public.property_assignments pa
        where pa.property_id = inspections.property_id
          and pa.inspector_id = auth.uid()
          and pa.is_active
      )
    )
  );

drop policy if exists "inspections_update" on public.inspections;
create policy "inspections_update"
  on public.inspections for update to authenticated
  using (public.is_manager() or inspector_id = auth.uid())
  with check (public.is_manager() or inspector_id = auth.uid());

drop policy if exists "inspections_delete" on public.inspections;
create policy "inspections_delete"
  on public.inspections for delete to authenticated
  using (public.is_manager());

-- ---------------------------------------------------------
-- CHECKLIST ITEMS
-- ---------------------------------------------------------

drop policy if exists "checklist_items_select" on public.checklist_items;
create policy "checklist_items_select"
  on public.checklist_items for select to authenticated
  using (
    exists (
      select 1 from public.inspections i
      where i.id = checklist_items.inspection_id
        and (
          public.is_manager()
          or i.inspector_id = auth.uid()
          or exists (
            select 1 from public.property_assignments pa
            where pa.property_id = i.property_id and pa.inspector_id = auth.uid()
          )
          or exists (
            select 1 from public.maintenance_issues mi
            where mi.inspection_id = i.id and mi.assigned_to = auth.uid()
          )
        )
    )
  );

drop policy if exists "checklist_items_insert" on public.checklist_items;
create policy "checklist_items_insert"
  on public.checklist_items for insert to authenticated
  with check (
    exists (
      select 1 from public.inspections i
      where i.id = checklist_items.inspection_id
        and (public.is_manager() or i.inspector_id = auth.uid())
    )
  );

drop policy if exists "checklist_items_update" on public.checklist_items;
create policy "checklist_items_update"
  on public.checklist_items for update to authenticated
  using (
    exists (
      select 1 from public.inspections i
      where i.id = checklist_items.inspection_id
        and (public.is_manager() or i.inspector_id = auth.uid())
    )
  );

drop policy if exists "checklist_items_delete" on public.checklist_items;
create policy "checklist_items_delete"
  on public.checklist_items for delete to authenticated
  using (
    exists (
      select 1 from public.inspections i
      where i.id = checklist_items.inspection_id
        and (public.is_manager() or i.inspector_id = auth.uid())
    )
  );

-- ---------------------------------------------------------
-- ITEM PHOTOS
-- ---------------------------------------------------------

drop policy if exists "item_photos_select" on public.item_photos;
create policy "item_photos_select"
  on public.item_photos for select to authenticated
  using (
    exists (
      select 1 from public.inspections i
      where i.id = item_photos.inspection_id
        and (
          public.is_manager()
          or i.inspector_id = auth.uid()
          or exists (
            select 1 from public.property_assignments pa
            where pa.property_id = i.property_id and pa.inspector_id = auth.uid()
          )
          or exists (
            select 1 from public.maintenance_issues mi
            where mi.inspection_id = i.id and mi.assigned_to = auth.uid()
          )
        )
    )
  );

drop policy if exists "item_photos_insert" on public.item_photos;
create policy "item_photos_insert"
  on public.item_photos for insert to authenticated
  with check (
    exists (
      select 1 from public.inspections i
      where i.id = item_photos.inspection_id
        and (public.is_manager() or i.inspector_id = auth.uid())
    )
  );

drop policy if exists "item_photos_delete" on public.item_photos;
create policy "item_photos_delete"
  on public.item_photos for delete to authenticated
  using (
    exists (
      select 1 from public.inspections i
      where i.id = item_photos.inspection_id
        and (public.is_manager() or i.inspector_id = auth.uid())
    )
  );

-- ---------------------------------------------------------
-- MAINTENANCE ISSUES
-- ---------------------------------------------------------

drop policy if exists "issues_select" on public.maintenance_issues;
create policy "issues_select"
  on public.maintenance_issues for select to authenticated
  using (
    public.is_manager()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or exists (
      select 1 from public.property_assignments pa
      where pa.property_id = maintenance_issues.property_id and pa.inspector_id = auth.uid()
    )
  );

drop policy if exists "issues_insert" on public.maintenance_issues;
create policy "issues_insert"
  on public.maintenance_issues for insert to authenticated
  with check (
    public.is_manager()
    or (
      created_by = auth.uid()
      and (
        public.is_inspector()
        and exists (
          select 1 from public.property_assignments pa
          where pa.property_id = maintenance_issues.property_id and pa.inspector_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "issues_update" on public.maintenance_issues;
create policy "issues_update"
  on public.maintenance_issues for update to authenticated
  using (public.is_manager() or created_by = auth.uid() or assigned_to = auth.uid())
  with check (public.is_manager() or created_by = auth.uid() or assigned_to = auth.uid());

drop policy if exists "issues_delete" on public.maintenance_issues;
create policy "issues_delete"
  on public.maintenance_issues for delete to authenticated
  using (public.is_manager());

-- ---------------------------------------------------------
-- ISSUE PHOTOS
-- ---------------------------------------------------------

drop policy if exists "issue_photos_select" on public.issue_photos;
create policy "issue_photos_select"
  on public.issue_photos for select to authenticated
  using (
    exists (
      select 1 from public.maintenance_issues mi
      where mi.id = issue_photos.issue_id
        and (
          public.is_manager()
          or mi.created_by = auth.uid()
          or mi.assigned_to = auth.uid()
        )
    )
  );

drop policy if exists "issue_photos_insert" on public.issue_photos;
create policy "issue_photos_insert"
  on public.issue_photos for insert to authenticated
  with check (
    exists (
      select 1 from public.maintenance_issues mi
      where mi.id = issue_photos.issue_id
        and (public.is_manager() or mi.created_by = auth.uid() or mi.assigned_to = auth.uid())
    )
  );

-- ---------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update"
  on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- =========================================================
-- STORAGE BUCKETS
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('inspection-photos', 'inspection-photos', false, 10485760,  -- 10 MB
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('property-photos',  'property-photos',  false, 5242880,   -- 5 MB
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- =========================================================
-- STORAGE OBJECT RLS  (storage.objects)
-- =========================================================

-- ---------------------------------------------------------
-- INSPECTION PHOTOS bucket  — path: {inspection_id}/{item_id}/{uuid}.ext
-- ---------------------------------------------------------

drop policy if exists "insp_photos_select" on storage.objects;
create policy "insp_photos_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inspection-photos'
    and exists (
      select 1 from public.item_photos ip
      join public.inspections i on i.id = ip.inspection_id
      where ip.storage_path = name
        and (
          public.is_manager()
          or i.inspector_id = auth.uid()
          or exists (
            select 1 from public.property_assignments pa
            where pa.property_id = i.property_id and pa.inspector_id = auth.uid()
          )
          or exists (
            select 1 from public.maintenance_issues mi
            where mi.inspection_id = i.id and mi.assigned_to = auth.uid()
          )
        )
    )
  );

drop policy if exists "insp_photos_insert" on storage.objects;
create policy "insp_photos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspection-photos'
    and (public.is_manager() or public.is_inspector())
    and array_length(storage.foldername(name), 1) >= 2
  );

drop policy if exists "insp_photos_delete" on storage.objects;
create policy "insp_photos_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'inspection-photos'
    and (public.is_manager() or public.is_inspector())
  );

-- ---------------------------------------------------------
-- PROPERTY PHOTOS bucket  — path: {property_id}/{uuid}.ext
-- ---------------------------------------------------------

drop policy if exists "prop_photos_select" on storage.objects;
create policy "prop_photos_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'property-photos'
    and (
      public.is_manager()
      or exists (
        select 1 from public.property_photos pp
        join public.property_assignments pa on pa.property_id = pp.property_id
        where pp.storage_path = name and pa.inspector_id = auth.uid()
      )
    )
  );

drop policy if exists "prop_photos_insert" on storage.objects;
create policy "prop_photos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-photos'
    and public.is_manager()
    and array_length(storage.foldername(name), 1) >= 1
  );

drop policy if exists "prop_photos_delete" on storage.objects;
create policy "prop_photos_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-photos'
    and public.is_manager()
  );

commit;

-- =========================================================
-- SEED DATA  (optional — uncomment to run)
-- =========================================================
-- After creating users in Auth, get their UUIDs from the
-- profiles table and run the inserts below.

-- -- Set a user as manager:
-- update public.profiles set role = 'manager' where email = 'manager@yourcompany.com';
--
-- -- Add sample properties (as manager):
-- insert into public.properties (name, address, city, state, zip, created_by)
-- values
--   ('Sunset Villas',        '1420 Palm Beach Blvd', 'Fort Myers', 'FL', '33916', '<manager-uuid>'),
--   ('Riverfront Apts',      '3600 Fowler St',       'Fort Myers', 'FL', '33901', '<manager-uuid>'),
--   ('Gulf Breeze Condos',   '14150 Metropolis Ave', 'Fort Myers', 'FL', '33912', '<manager-uuid>');
--
-- -- Assign inspector to property:
-- insert into public.property_assignments (property_id, inspector_id, frequency, created_by)
-- values ('<property-uuid>', '<inspector-uuid>', 'monthly', '<manager-uuid>');
