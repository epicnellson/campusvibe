-- ==========================================================
-- 00014: Grant service_role access to all tables
-- The sb_secret_ key uses service_role; ensure it can read
-- profiles and storage tables for admin edge functions.
-- ==========================================================

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all routines in schema public to service_role;

-- Storage schema
grant usage on schema storage to service_role;
grant all privileges on all tables in schema storage to service_role;
