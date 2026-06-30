-- ==========================================================
-- 00016: Fix infinite recursion in get_current_user_domain()
--
-- The old function queried `profiles` which triggered the RLS
-- policy that calls get_current_user_domain() — infinite loop.
-- New version reads email directly from the JWT (auth.jwt()),
-- avoiding any table query.
-- ==========================================================

create or replace function get_current_user_domain()
returns text
language sql
stable
as $$
  select coalesce(
    split_part(
      (auth.jwt() ->> 'email'),
      '@',
      2
    ),
    ''
  );
$$;
