# Property Inspection App — Setup Guide

## Overview
React Native (Expo) mobile app backed by Supabase.  
Roles: **Manager** · **Inspector** · **Maintenance Tech**

---

## 1. Supabase Project Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name (e.g. `property-inspect`) and strong password
3. Region: **US East (N. Virginia)** — closest to Fort Myers, FL
4. Wait for the project to provision (~2 min)

### Run the schema
1. In your Supabase dashboard → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**

### Create storage buckets
In Supabase dashboard → **Storage** → **New bucket**:

| Bucket name         | Public | File size limit |
|---------------------|--------|-----------------|
| `inspection-photos` | No     | 10 MB           |
| `property-photos`   | Yes    | 5 MB            |

### Add storage policies
In each bucket → **Policies** → **New policy** → **For full customization**:

**inspection-photos** (authenticated users can read/write):
```sql
-- SELECT
(auth.uid() is not null)
-- INSERT
(auth.uid() is not null)
```

**property-photos** (public read, authenticated write):
```sql
-- SELECT
true
-- INSERT
(auth.uid() is not null)
```

---

## 2. Create User Accounts

In Supabase → **Authentication** → **Users** → **Invite user**

After creating each user, update their profile role in the **Table Editor → profiles** table:

| Email | Role |
|---|---|
| manager@yourcompany.com | `manager` |
| inspector1@yourcompany.com | `inspector` |
| tech1@yourcompany.com | `maintenance_tech` |

Or use SQL:
```sql
UPDATE profiles SET role = 'manager' WHERE id = 'paste-user-uuid-here';
```

---

## 3. Configure the App

```bash
cd property-inspection-app
cp .env.example .env
```

Edit `.env` and fill in your Supabase project URL and anon key.  
Find these in: **Supabase Dashboard → Project Settings → API**

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 4. Install & Run

```bash
npm install
npx expo start
```

- Press `i` for iOS Simulator (Mac only)
- Press `a` for Android Emulator
- Scan QR code with **Expo Go** app on your phone

---

## 5. Assign Inspectors to Properties

After logging in as manager and adding properties:

1. Run the SQL below in Supabase's SQL Editor to assign inspectors:

```sql
INSERT INTO property_assignments (property_id, inspector_id, frequency, is_active, created_by)
VALUES (
  'property-uuid-here',
  'inspector-uuid-here',
  'monthly',
  true,
  'manager-uuid-here'
);
```

2. Or build the assignment screen (future enhancement).

---

## App Flow Summary

### Manager
- Dashboard → see all properties, open issues, inspection stats
- Tap property → see inspection history + open issues
- Tap inspection → full report with checklist, photos, scores

### Inspector
- Log in → see assigned properties
- Tap property → start or resume an inspection
- Walk through Exterior + Common Areas checklists
- Mark each item Pass / Fail / N-A, add photos
- Rate overall condition 1–5 stars
- Submit → manager notified, failed items auto-create maintenance issues

### Maintenance Tech
- Log in → see issues assigned to them
- Tap issue → mark as Done with a resolution note
- Tap completed issue → reopen if needed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo ~51) |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Navigation | React Navigation v6 |
| Photos | expo-image-picker |
| Push | expo-notifications |
| Date formatting | date-fns |
