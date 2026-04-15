-- =========================================================
-- MIGRATION: Issue review workflow
-- Adds `pending_review` status and `photo_type` column so
-- maintenance techs can submit completion photos and managers
-- can review them before closing the issue.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- =========================================================

-- 1. Add pending_review to issue_status enum
ALTER TYPE public.issue_status ADD VALUE IF NOT EXISTS 'pending_review';

-- 2. Add photo_type column to issue_photos (before / after)
ALTER TABLE public.issue_photos
  ADD COLUMN IF NOT EXISTS photo_type text NOT NULL DEFAULT 'before';

-- 3. Constrain photo_type to valid values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'issue_photos_photo_type_check'
  ) THEN
    ALTER TABLE public.issue_photos
      ADD CONSTRAINT issue_photos_photo_type_check
      CHECK (photo_type IN ('before', 'after'));
  END IF;
END $$;
