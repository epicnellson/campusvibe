-- ==========================================================
-- 00017: Grant base table permissions to anon and authenticated
--
-- Supabase normally sets default privileges so that anon and
-- authenticated can access all tables.  If those defaults were
-- not applied during project setup, authenticated users would
-- get "permission denied" (mapped to 403 by the API gateway).
-- This migration explicitly grants the required permissions.
-- ==========================================================

-- Public schema
grant usage on schema public to anon, authenticated;

grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;
