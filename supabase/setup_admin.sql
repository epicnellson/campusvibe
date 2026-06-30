-- ══════════════════════════════════════════════════════════
-- Admin Setup Script
-- Run this in the Supabase Dashboard SQL Editor
-- ══════════════════════════════════════════════════════════
--
-- 1. Replace 'admin@your-university.edu' with the email of
--    the account you signed up with in the CampusVibe app.
-- 2. Run this script.
-- 3. Log into the admin dashboard at /admin/index.html with
--    the same email + password.
-- ══════════════════════════════════════════════════════════

-- Promote user to admin
update profiles
set is_admin = true
where email = 'nelsonemmanuel006@gmail.com';
