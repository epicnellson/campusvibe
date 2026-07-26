-- Seed data: 2 users with profiles + 5 posts each + Emmanuel's marketplace listings
-- Run this in Supabase SQL Editor (service_role)
-- NOTE: Replace the UUIDs below with actual auth.users IDs after signing up through the app
-- To find your user ID: run SELECT id, email FROM auth.users; in SQL Editor

-- ============================================================
-- STEP 1: Create auth users (run this FIRST)
-- ============================================================
-- Option A: If users already signed up via the app, skip to STEP 2 and replace UUIDs
-- Option B: Create users directly (password is "password123" for all):

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, confirmation_token,
  email_change_token_new, recovery_token
) VALUES
  ('00000000-0000-0000-0000-000000000000',
   'a1111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'emmanuel@campus.edu',
   crypt('password123', gen_salt('bf')),
   now(), now(), now(), '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'b2222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'sarah@campus.edu',
   crypt('password123', gen_salt('bf')),
   now(), now(), now(), '', '', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 2: Create profiles
-- ============================================================
INSERT INTO profiles (id, email, email_domain, name, department, year, verification_status, notification_preferences, is_admin, banned)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'emmanuel@campus.edu', 'campus.edu', 'Emmanuel', 'Computer Science', '3rd Year', 'approved', '{"likes":true,"messages":true,"new_events":true,"popular_confessions":true}', false, false),
  ('b2222222-2222-2222-2222-222222222222', 'sarah@campus.edu', 'campus.edu', 'Sarah', 'Business Administration', '2nd Year', 'approved', '{"likes":true,"messages":true,"new_events":true,"popular_confessions":true}', false, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: Emmanuel's posts (5 posts)
-- ============================================================
INSERT INTO posts (user_id, content, created_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Just finished my final project on machine learning. The coffee shops near campus kept me alive through those late nights! Who else is pulling all-nighters this week?', now() - interval '2 hours'),
  ('a1111111-1111-1111-1111-111111111111', 'Pro tip: the library 3rd floor has the best WiFi signal and the least amount of people. You are welcome.', now() - interval '5 hours'),
  ('a1111111-1111-1111-1111-111111111111', 'Who wants to form a study group for the Data Structures exam? I have notes from the last 3 semesters.', now() - interval '1 day'),
  ('a1111111-1111-1111-1111-111111111111', 'The new cafe next to the engineering building makes an incredible iced mocha. Highly recommend!', now() - interval '2 days'),
  ('a1111111-1111-1111-1111-111111111111', 'Looking for a hiking buddy this weekend. Anyone down for the trails near the lake? Should be great weather.', now() - interval '3 days');

-- ============================================================
-- STEP 4: Sarah's posts (5 posts)
-- ============================================================
INSERT INTO posts (user_id, content, created_at)
VALUES
  ('b2222222-2222-2222-2222-222222222222', 'My entrepreneurship professor just assigned a group project and I need teammates. Anyone interested in building a campus food delivery app?', now() - interval '1 hour'),
  ('b2222222-2222-2222-2222-222222222222', 'The career fair is next Thursday! I heard Google and Amazon will be there. Make sure to bring your resumes!', now() - interval '3 hours'),
  ('b2222222-2222-2222-2222-222222222222', 'Just joined the debate club and my first tournament is this Friday. Any tips from experienced debaters?', now() - interval '8 hours'),
  ('b2222222-2222-2222-2222-222222222222', 'Does anyone have the notes from Marketing 301 last Tuesday? I had to miss class for a dentist appointment.', now() - interval '1 day'),
  ('b2222222-2222-2222-2222-222222222222', 'Shoutout to whoever left free cookies in the student lounge today. You made my whole week!', now() - interval '2 days');

-- ============================================================
-- STEP 5: Emmanuel's marketplace listings (5 products)
-- ============================================================
INSERT INTO listings (user_id, title, description, price, category, photos, created_at)
VALUES
  ('a1111111-1111-1111-1111-111111111111',
   'Calculus Textbook - Stewart 8th Edition',
   'Used for MATH 201. Some highlighting in chapters 1-5, otherwise in great condition. Includes solutions manual.',
   '$35', 'Textbooks', '[]'::jsonb, now() - interval '1 day'),
  ('a1111111-1111-1111-1111-111111111111',
   'Mechanical Keyboard - Cherry MX Blue',
   'Logitech G Pro TKL. Barely used, switched to a quieter one for the library. Comes with original box.',
   '$65', 'Electronics', '[]'::jsonb, now() - interval '2 days'),
  ('a1111111-1111-1111-1111-111111111111',
   'Campus Hoodie - Size L',
   'Official university hoodie in navy blue. Worn twice, too small for me. No stains or damage.',
   '$20', 'Clothing', '[]'::jsonb, now() - interval '3 days'),
  ('a1111111-1111-1111-1111-111111111111',
   'Desk Lamp - LED Adjustable',
   'Perfect for late-night study sessions. 3 brightness levels, USB charging port. Works great.',
   '$15', 'Electronics', '[]'::jsonb, now() - interval '4 days'),
  ('a1111111-1111-1111-1111-111111111111',
   'Intro to Psychology - Myers 12th',
   'Required for PSYCH 101. No writing inside, looks brand new. Retails for $120+.',
   '$40', 'Textbooks', '[]'::jsonb, now() - interval '5 days');
