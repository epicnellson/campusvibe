# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

App: CampusVibe — social media app for university students
Stack: React Native (Expo), Supabase backend, PostgreSQL

Rules:
- Always use TypeScript
- Always add error handling
- Never expose user IDs in the UI for anonymous features
- Run moderation checks before saving any user-generated content

## Session History

### Done
- Expo project scaffolded with SDK 56, path alias `@/` → `./src/*`
- Supabase client (`src/services/supabase.ts`)
- Auth: email + OTP, any email accepted
- Profile creation (name, department, year, `email_domain`) in `profiles` table
- Session context (`SessionProvider` / `useSession`), profile hook (`useProfile`)
- Home feed: `FlatList` of posts with pull-to-refresh, like/unlike
- Confessions tab: anonymous posting, OpenAI Moderation check, deterministic avatar color
- Profile screen: avatar, name, dept, year, user's posts, Edit Profile + Notification Settings
- Edit profile: photo upload to `profile-photos` bucket, multi-step form
- Events tab: upcoming events, create, RSVP toggle, optional image upload
- Chats tab: channel list (Channels / DMs), auto-join on signup, realtime messaging
- DM channels: `get_dm_channel` RPC (deterministic dedup), user search screen (`/new-dm`)
- Marketplace tab: 2-column grid (4 on wide), listings with photos, create/edit, "Message Seller"
- Push notifications: `push_tokens` table, `notification_preferences`, settings screen, batch send
- Reports system: `reports` table, report button on every content card, bottom-sheet modal
- `is_admin` and `banned` columns, banned user "Account Suspended" screen
- RLS policies for admins (delete on content, view/delete reports, update profiles)
- Follow system: `follows` table, suggested users, follow/unfollow
- App Store / Play Store config: `app.json`, `eas.json`, splash, permissions
- Privacy policy page, age verification (16+ checkbox on signup)
- Error boundaries wrapping tabs layout
- Tests: jest config, auth + posts tests
- **17 Supabase migrations** (00001–00017): profiles, posts, confessions, events, chats, listings, follows, reports, notifications, RLS fixes, email_domain, verification system, service_role grants, security hardening, recursion fix, base permission grants
- **Onboarding flow**: 4 steps, Skip each, progress bar, saves profile + avatar + joins channels, redirects to `/verify-student-id`
- **Student ID verification system**: `verification_status` column, private `student-id-verification` bucket, RLS (owner + admin), upload screen (gallery or camera), `VerificationBanner` on every tab screen, `requireVerified()` utility, permission gating on all content screens
- **`uploadStudentId()`**: file extension check (jpg/jpeg/png/pdf) + 5MB size limit on client side, status auto-set by DB trigger (no client update)
- **`on_student_id_upload` trigger**: auto-sets `verification_status = 'pending'` on storage insert (bucket `student-id-verification`)
- **Users cannot change own `verification_status`**: RLS `WITH CHECK` blocks any change — only admin policy or service_role can modify it
- **`admin_actions` audit table**: `admin_email`, `action`, `target_user_id`, `created_at` — logged on every approve/reject
- **Content table RLS gating**: all INSERT policies on posts, confessions, events, event_rsvps, listings, messages, likes, confession_likes, channel_members require `verification_status = 'approved'`
- **Admin DELETE policy** on `student-id-verification` bucket
- **`get_current_user_domain()` recursion fix**: reads email from `auth.jwt()` instead of querying `profiles` (caused stack overflow on every profile SELECT)
- **Four Edge Functions deployed** and working:
  - `profiles` — domain-scoped profiles (`auth: "user"`)
  - `moderate` — OpenAI Moderation (`auth: "secret"`)
  - `admin` — list/dismiss reports, ban (`auth: "user"`)
  - `notify-verification` — GET pending users with signed URLs, POST approve/reject + email + audit log (`verify_jwt: true` with admin role check)
- **Admin dashboard** (`admin/index.html`): Supabase Auth login (email + password, checks `is_admin`), calls edge function with JWT, Approve/Reject buttons, session expiry handling
- **Auth callback route** (`auth/callback.tsx`): handles PKCE (`?code=xxx`) and implicit (`#access_token=xxx`) OTP flows, redirects to `/` after success
- **OTP redirect configured**: `emailRedirectTo` set to `{origin}/auth/callback` on web / `campusvibe://auth/callback` on native; `site_url` set to `http://localhost:8081`; additional redirect URLs pushed to Supabase
- **Notifications fixed for web**: platform guard returns early on web
- **GO_BACK warnings fixed**: `router.back()` → `router.replace("/")` in login, signup, verify screens
- **Secrets set**: `SB_SECRET_KEY` (service_role), `SB_ANON_KEY` (anon fallback)
- `otp_length` changed from 8 to 6 via `supabase config push`
- TypeScript compiles with zero errors (excludes `admin/`, `__tests__`, `supabase`)
- **403 permission errors fixed** (migration 00017): Supabase defaults grant ALL on all tables to `anon` and `authenticated` roles — these grants were missing, causing authenticated user queries to return 403. Migration 00017 restores them.
- **Performance audit**: React.memo on all cards, useCallback on all event handlers, getItemLayout on 4 FlatLists, feed caching via AsyncStorage, image compression via expo-image-manipulator (1200px/80%), blur placeholders on event/listing cards
- **Security audit**: `sanitizeText()` HTML-escaping in sanitize.ts, XSS applied to all 7 user-text services, string interpolation injection fixed in chats.ts/follows.ts, RLS audit confirmed
- **Accessibility audit**: 17+ accessibility labels/roles on all components, 9 touch target fixes to ≥44pt, color contrast fixes (tab bar, message-bubble, report-modal)
- **CustomTabBar redesigned**: floating pill shape (borderRadius 24, marginHorizontal 16), dark `#111111` background, glow behind active icon, spring scale animation on press, active-label-only mode, fallback color constants prevent crash on every theme access
- **CustomTabBar crash fixed**: `TAB_ICONS[route.name]` returns undefined for hidden tabs → filtered via `options?.href !== null` guard. All theme accesses have fallback constants.
- **Supabase 400 errors fixed**: All query joins rewritten from wrong syntax (`profiles!inner`, `creator:user_id`) to correct PostgREST embed syntax (`profiles(name, department)`, `creator:profiles(name)`, `seller:profiles(name)`)
- **`MOCK_STORIES` removed**: Hardcoded stories array and all related rendering code cleaned from feed/index.tsx
- **`useNativeDriver: true` fixed**: All 10+ occurrences changed to `Platform.OS !== 'web'` — prevents Animated crash on web
- **Profile page redesigned**: cover height 200px, verified badge checkmark on avatar + inline next to name, Share button using `Share.share()`, listings in 2-column grid layout
- **Migration 00018 added**: Re-points all content table FK constraints from `auth.users(id)` to `profiles(id)` so PostgREST can auto-detect relationship for join queries
- **`KNOWN_ISSUES.md`** updated: 35 items, stories section marked as removed
- **SDK 56 → 54 downgrade completed**: All dependencies pinned to SDK 54 compatible versions (`expo@~54.0.0`, `react@19.1.0`, `react-native@0.81.5`, etc.)
- **Added `react-native` to `package.json`**: Was missing from SDK 54 setup, causing npm to resolve latest (0.86.0) which requires `react@^19.2.3`
- **Full clean install executed**: `npm install --legacy-peer-deps` succeeded (829 packages, 7 min due to large RN tarball download)
- **TypeScript errors fixed for SDK 54**: 
  - `_layout.tsx`: `DarkTheme`, `DefaultTheme`, `ThemeProvider` now imported from `@react-navigation/native` (not `expo-router` — not re-exported in SDK 54)
  - `SymbolView` name prop: Changed from platform-object format to string (SDK 54 only accepts `SFSymbol` string)
  - `StyleSheet.absoluteFill` spread: Added `as object` cast (type can be `undefined`)
  - `use-theme.ts`: Fixed color scheme comparison (`'unspecified'` → `?? nullish coalescing`)
  - TypeScript compiles with zero errors (`tsc --noEmit` passes)
- **Expo dev server verified**: Starts cleanly at `http://localhost:8081` with no errors
- **`window.addEventListener` crash fixed**: RN 0.81 sets `global.window = global` (Hermes), but `global` lacks `addEventListener`. Fixed `network-banner.tsx` guard (checks `typeof addEventListener === "function"`). Added global polyfill in `_layout.tsx` for `expo-router`'s `createMemoryHistory` which also calls `window.addEventListener('popstate', ...)`.
- `expo-router`, `expo-symbols`, `@react-navigation/native` types updated per SDK 54 API surface
- **System-wide UI polish**:
  - Profile scroll: `paddingBottom` 100 → 120 in `profile.tsx` `scrollContent`
  - Top headers shifted up: `paddingVertical` reduced from 8px to 2px on Feed, Events, Marketplace, Chats
  - Confessions header: `paddingVertical` reduced from 16px to 8px
  - Text cutoff prevention: all centered layouts (`verify.tsx`, `verify-student-id.tsx`, `onboarding.tsx`) switched to `justifyContent: "flex-start"` + explicit `paddingTop`
  - Student ID page: `centerContent` width=100%; `uploadArea` overflow=visible, padding expanded; `photoButton` minHeight=48
  - Verify screen: subtitle `lineHeight` 20 → 22
- **Admin dashboard** (`admin/index.html`) rewritten as enterprise panel: analytics stat cards, user table with search/filter tabs, content moderation queue, system health monitor, student ID review modal with zoom
- **Edge function** (`notify-verification/index.ts`): `?scope=dashboard` endpoint, `dismiss_report` / `remove_content` POST actions
- **Global "+" button removed**: `headerRow`, `createVisible` state, `createActions` array, and entire Modal stripped from `_layout.tsx` — previously the top-left "+" served as a universal creation hub
- **Screen-specific header buttons**: Events ("Create Event" → `/create-event`), Marketplace ("Create Listing" → `/create-listing`), and Chats ("New Conversation" → `/new-dm` now uses Ionicons `add` icon) each get a right-aligned 36×36 primary-colored pressable in the header
- **All three buttons unified**: Same `Ionicons add` icon, same `36×36` circular size, same `colors.primary` background, same `#FFFFFF` icon color — visual consistency across screens
- **`_layout.tsx` banned screen fixed**: Switched from `ThemedView as="Text"` (which typed styles as `ViewStyle`) to actual `ThemedText` component, fixing TS2353 errors
- **Home screen spacing**: Added `paddingBottom: spacing.md` to feed `titleBar` so the gap between "CampusVibe" and Post/Confess quick actions is no longer too tight
- **All screen header spacing**: Added `paddingBottom: spacing.md` (or `Spacing.two`) to Events, Marketplace, and Chats header bars for consistent vertical breathing room between title and content
- **Web performance fix**: `PagerViewWrapper.tsx` now renders all screens at once (with `display: "none"` on inactive) instead of only the active screen — eliminates remount+refetch on every tab switch, making navigation instant on web
- **Profile double checkmark fixed**: Removed inline `verifiedInline` checkmark next to name — avatar badge kept as single indicator. Later reverted: avatar badge removed, inline checkmark restored.
- **Events tab removed from navigation**: Both `_layout.tsx` and `CustomTabBar` reduced from 5 to 4 tabs (Feed, Chats, Marketplace, Profile). Events data still fetchable for unified feed.
- **Unified home feed**: `index.tsx` now fetches posts + confessions + upcoming events simultaneously, merges by `created_at` desc, renders each with type-appropriate card (`PostCard`, `ConfessionCard`, `EventCard`). Events shown as compact date-cards.
- **Quick action buttons removed from feed**: Static Post/Confess buttons gone from home screen body.
- **FAB creation menu**: "+" button in top-right of home header opens a bottom-sheet `Modal` with three options: Post (`/compose`), Confession (`/compose?mode=confession`), Event (`/create-event`).
- **Confession mode in compose**: `compose.tsx` reads `?mode=confession` param — displays "Anonymous" header, calls `createConfession()` (ensures anonymity in DB/UI), hides photo picker in confession mode.
- **Feed refresh system**: `RefreshProvider` context (`use-refresh.tsx`) with `feedKey` counter. `triggerFeedRefresh()` called after creation in `compose.tsx` and `create-event.tsx`. Feed re-fetches on `feedKey` change — eliminates stale data after creation.
- **Confessions screen back button**: Added `←` back button to confessions header for returning to feed.
- **Network audit**: Supabase URLs sourced from env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — no localhost/127.0.0.1 references in production config
- **Post image support**: Added `image_url` field to `Post` type (`database.types.ts`), `createPost()` now accepts optional `imageUrl` param, `compose.tsx` uploads first image via `uploadPostImage()` and passes URL to `createPost()`
- **Post image rendering**: `PostCard.tsx` now renders `<Image>` with `width: '100%'`, `height: 220`, `borderRadius: 12`, `resizeMode: 'cover'` when `post.image_url` is present
- **PostCard redesign (Threads/X style)**: Borderless card with `borderBottomWidth: 1`, `borderBottomColor: '#1E1E1E'` separator; 44×44 circular avatar left, username + `· 1h` metadata right; body text at `fontSize: 15`, `lineHeight: 22`, `color: '#E1E1E1'`; engagement row with Ionicons heart (line art), chat bubble, flag icons with subtle count text
- **`post-images` bucket**: `uploadPostImage()` added to `storage.ts` with standard FormData payload, falls back silently if bucket doesn't exist yet

### In Progress
- *(none)*

### Blocked
- Edge function email sending requires `RESEND_API_KEY` via `supabase secrets set RESEND_API_KEY=re_...`
- Admin user must be set up manually: sign up via app → run `supabase/setup_admin.sql` in SQL Editor with their email → log in to admin dashboard
- FK migration 00018 must be applied to Supabase before the rewritten queries work
- No more EAS free-tier build credits available for this billing period

## Next Steps
1. **Apply migration 00018** to Supabase: `supabase migration up`
2. Set `RESEND_API_KEY` via `supabase secrets set RESEND_API_KEY=re_...` for approval emails
3. Create admin user: sign up → run `supabase/setup_admin.sql` → log in to admin dashboard
4. Review and approve student ID images before production launch
5. Fill in `eas.json` placeholders (`appleId`, `ascAppId`, `appleTeamId`, `serviceAccountKeyPath`)
6. Replace `your-eas-project-id` in `app.json` with actual EAS project ID
7. Generate production app icon assets in all required sizes
8. Take real screenshots for App Store + Play Store listings

## Key Decisions
- Auth switched from university email domain validation to any-email + student ID photo verification for broader access
- Student ID images stored in a **private** bucket, only owner + admin can view via signed URLs
- Existing users auto-approved via migration (`verification_status = 'approved'`)
- Onboarding finishes → redirects to `/verify-student-id` so ID upload is mandatory before full access
- `requireVerified()` used at UI layer for immediate feedback; **RLS on content tables** added as defense-in-depth
- `@supabase/server` SDK **abandoned** — raw `supabase-js` via esm.sh CDN used instead (faster cold start, fewer dependencies)
- Edge function for admin API switched from `auth: "none"` to `verify_jwt: true` + manual admin role check — no more public endpoint
- Admin dashboard rewritten from hardcoded password to Supabase Auth login — JWT used for all API calls
- `SUPABASE_SECRET_KEY` reserved but **NOT auto-injected** — use differently-named env var (`SB_SECRET_KEY`)
- `service_role` needs **explicit `GRANT ALL ON TABLES`** — `sb_secret_` key doesn't auto-grant
- `get_current_user_domain()` must NOT query `profiles` (causes infinite recursion with RLS) — reads email from `auth.jwt()` instead
- OTP code length changed from 8 to 6 to match verify screen expectation
- Verification status set by DB trigger on storage insert, not by client — prevents bypass
- **`anon` and `authenticated` roles need explicit `GRANT ALL ON TABLES`** — Supabase defaults may not be applied. Missing grants cause 403 on every table query, even for authenticated users.
- **PostgREST join fix**: Content table FK constraints were pointing to `auth.users(id)` but PostgREST needs direct FK to `profiles(id)` for embed queries. Migration 00018 re-targets them all to `profiles(id)`.
- **Tab bar crash root cause**: `state.routes` includes hidden tabs (e.g., `explore` with `href: null`), which have no entry in `TAB_ICONS`. Fix: filter routes by `TAB_ICONS` presence AND `href !== null` before rendering.
- **`useNativeDriver: true` on web**: React Native for web does not support native driver. All occurrences changed to `Platform.OS !== 'web'` conditional.
- **Profile verification badge**: Uses `isVerified = profile.verification_status === "approved"` check, displays green checkmark circle on avatar and inline next to name.

- **SDK 54 theme imports**: `DarkTheme`, `DefaultTheme`, `ThemeProvider` are NOT re-exported from `expo-router` in SDK 54 — import from `@react-navigation/native` instead
- **SDK 54 `SymbolView`**: `name` prop only accepts `SFSymbol` string, NOT platform-object format — use string name with `fallback` prop for cross-platform
- **`react-native` must be in package.json**: Without it pinned, npm resolves latest (0.86.x) which requires `react@^19.2.3` and conflicts with SDK 54's `react@19.1.0`
- **`npm install --legacy-peer-deps` timeout**: react-native tarball is ~100MB; first install takes 5-7 minutes depending on network

## Critical Context
- `SUPABASE_*` env vars are reserved — **exception**: `SUPABASE_URL` IS auto-injected, `SUPABASE_SECRET_KEY` and `SUPABASE_ANON_KEY` are NOT auto-injected. Use custom names (`SB_SECRET_KEY`, `SB_ANON_KEY`) instead.
- `sb_secret_` key does NOT auto-grant `service_role` privileges — migration 00014 explicitly grants `ALL` on all tables
- `get_current_user_domain()` caused infinite recursion (querying `profiles` → triggered RLS → called itself) — fixed in migration 00016 by reading `auth.jwt() ->> 'email'` instead
- `notify-verification` edge function: `verify_jwt = true`, manually checks `is_admin`, logs to `admin_actions` table, supports GET (list pending) and POST (approve/reject)
- OTP flow: `sendOTP` now passes `emailRedirectTo` pointing to `/auth/callback`; the callback route (`src/app/auth/callback.tsx`) handles PKCE and implicit flows and redirects to `/` after success
- `uploadStudentId()` no longer calls `profiles.update()` — status is set by `on_student_id_upload` trigger. Client-side file extension + 5MB size checks added.
- Admin dashboard (`admin/index.html`) uses Supabase Auth (email + password) instead of hardcoded password. Checks `is_admin` on login. Sends JWT in `Authorization` header to edge function.
- All content INSERT policies now require `verification_status = 'approved'` — API-level enforcement, not just UI
- Profile UPDATE RLS blocks any change to `verification_status` by non-admin users
- `admin_actions` table created — every approve/reject is logged with `admin_email`, `action`, `target_user_id`, timestamp
- `SUPABASE_URL` = `https://kvpqkcfevmmlsbxjbgyd.supabase.co`
- Anon key = `sb_publishable_RjFVgowfCzJlECpdoQfWEQ_z01crUVQ`
- Secret key = `sb_secret_REMOVED`
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in `.env`
- `.env` contains real credentials — secret key must never be committed
- **`anon` and `authenticated` roles require explicit `GRANT ALL ON ALL TABLES IN SCHEMA public`** — without it, every table query returns "permission denied" (401 for unauthenticated, 403 for authenticated). Migration 00017 adds these grants.
- **Migration 00018** re-points all content table FK constraints from `auth.users(id)` to `profiles(id)` so PostgREST can resolve `profiles(name)` embed queries. Must be applied before the rewritten queries work.
- **PostgREST join syntax**: Use `profiles(name, department)` (not `profiles!inner`), `creator:profiles(name)` (not `creator:user_id`), `seller:profiles(name)` (not `seller:user_id`).
- **CustomTabBar filtering**: `state.routes` includes hidden tabs. Always filter by `TAB_ICONS[r.name]` and `options?.href !== null` before rendering tab buttons.
- **`useNativeDriver: true`** must use `Platform.OS !== 'web'` guard everywhere — crashes on web otherwise.

## Relevant Files
- `src/app/_layout.tsx`: root Stack + ThemeProvider + SessionProvider + NotificationsInitializer (now includes `auth/callback` and `verify-student-id` screens)
- `src/app/auth/callback.tsx`: handles OTP PKCE/implicit redirect, exchanges code for session, redirects to `/`
- `src/app/(tabs)/_layout.tsx`: session/profile/banned gate then VerificationBanner + ErrorBoundary wrapping AppTabs
- `src/app/{compose,create-event,create-listing,edit-profile,login,signup,verify,onboarding,privacy,notification-settings,verify-student-id,chat/[id],listing/[id]}.tsx`: root-level screens
- `src/services/{auth,chats,confessions,events,marketplace,notifications,posts,profile,reports,storage,moderation,follows,verification,supabase}.ts`: service layer
- `src/services/storage.ts`: `uploadStudentId()` with extension + size check, no direct status update
- `src/hooks/{use-session,use-profile,use-notifications}.ts(x)`: context + hooks (notifications now guarded for web)
- `src/components/{custom-tab-bar,error-boundary,verification-banner,app-tabs,app-tabs.web,post-card,confession-card,event-card,listing-card,channel-card,message-bubble,report-modal,themed-text,themed-view}.tsx`: components
- **`src/components/custom-tab-bar.tsx`**: redesigned floating pill with glow, spring animation, active-only labels, fallback color constants
- `src/services/database.types.ts`: Profile type with `verification_status`, `AdminAction` type
- `admin/index.html`: plain HTML admin dashboard with Supabase Auth login
- `supabase/migrations/00017_grant_base_permissions.sql`: grants ALL on all tables to `anon` and `authenticated`
- **`supabase/migrations/00018_fix_postgrest_relationships.sql`**: re-targets all content table FK constraints to `profiles(id)` for PostgREST join support
- `supabase/setup_admin.sql`: run this in SQL Editor to promote user to admin
- `supabase/functions/notify-verification/index.ts`: edge function with JWT auth, admin check, audit logging
- `supabase/config.toml`: function config with `verify_jwt` settings, auth section with redirect URLs
