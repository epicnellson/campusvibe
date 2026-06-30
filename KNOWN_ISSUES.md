# Known Issues — CampusVibe

## Performance

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 1 | `getItemLayout` uses estimated heights (200px for posts, 240px for confessions, 140px for events, 70px for messages). Variable-height content causes scroll jitter. Consider using `onLayout` to measure actual heights or switch to a cell renderer cache. | Medium | Chat messages and post cards vary significantly in height depending on content length. |
| 2 | Feed caches to AsyncStorage but cache invalidation is basic (just overwrites on refresh). No background refresh. | Low | First load after cold start shows cached data, then replaces it with fresh data. Acceptable for MVP. |
| 3 | Image compression (1200px, 80% quality) runs synchronously on the JS thread before upload. For very large images, this may cause frame drops. | Low | Can be moved to a separate worker thread in a future optimization. |
| 4 | Realtime subscriptions (chats) are never cleaned up on screen blur — only on unmount. If user navigates away while subscription is active, it persists until component unmounts. | Low | Currently only one chat screen exists at a time, so this is acceptable. |
| 5 | No image prefetching or progressive loading on the feed. expo-image handles caching but the blurhash placeholder is a single hardcoded value rather than a per-image generated blurhash. | Low | Generating blurhashes client-side would require `expo-blurhash` and is deferred. |

## Security

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 6 | OpenAI Moderation runs client-side (`src/services/moderation.ts`). API key (`EXPO_PUBLIC_OPENAI_API_KEY`) is embeded in JS bundle. | **Critical** | Move moderation to the existing (unused) Edge Function `supabase/functions/moderate`. Remove client-side call entirely. Rename key to `OPENAI_API_KEY` (no EXPO_PUBLIC_ prefix) for server use. |
| 7 | `SUPABASE_SECRET_KEY` leaked in Expo dev logs (`.expo/dev/logs/start.log` — 9 occurrences). | **Critical** | The service_role key is logged in plain text on developer machines. Not in git (`.expo/` is gitignored), but any developer with disk access can read it. Rotate the key and clear dev logs. |
| 8 | No server-side validation of moderation result. RLS only checks `verification_status = 'approved'`. Confessions could bypass moderation by calling the API directly. | **High** | After fixing #6 (server-side moderation), also add a DB-level moderation flag or Edge Function webhook. |
| 9 | Banned user profiles remain visible to other users (no `banned != true` filter in profiles SELECT RLS policy). | Medium | Add policy: allow SELECT only if `banned = false OR auth.uid() = id`. |
| 10 | `channels` table has no DELETE RLS policy. Orphaned channels can accumulate. | Low | Add a cleanup job or periodic deletion of empty channels. |

## Accessibility

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 11 | Light mode contrast: `textTertiary (#9E9E9E)` on `background (#FFFFFF)` fails WCAG AA (2.9:1). | Medium | Darken `textTertiary` to at least `#757575`. Update in `src/theme/index.ts`. |
| 12 | Light mode contrast: `textSecondary (#666666)` on `backgroundElement (#E8E8E8)` fails WCAG AA (3.9:1). | Medium | Darken `textSecondary` to `#5C5C5C` in light mode. |
| 13 | Touch targets: Several buttons still use hardcoded padding that may be too small on very small screens (iPhone SE). The `minHeight: 44` added protects most, but `reactionButton` in confession-card uses `paddingVertical: 12` which may not reach 44pt on dense screens. | Low | Review on actual device. |
| 14 | `listing-card.tsx` report overlay (`...` button) uses `hitSlop={10}` instead of increasing actual size. This makes it tappable but not visually accessible. | Low | Consider replacing the `...` text with an explicit "Report" label. |

## Unfinished Features

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 15 | Stories | **Removed** | `MOCK_STORIES` was a hardcoded placeholder with no backend. Removed from feed. Stories feature should be built from scratch with a proper `stories` table and 24h expiry if needed later. |
| 16 | Typing indicator in chat | **Mock only** | `ChatDetailScreen` uses random `Math.random() > 0.7` toggle instead of real typing events via the Realtime API. |
| 17 | Image upload for compose screen | **Wired but unused** | `compose.tsx` allows selecting images but `createPost()` ignores them. The `images` state is never uploaded or attached. |
| 18 | `EXPO_PUBLIC_ALLOWED_EMAIL_DOMAINS=.edu` in `.env` is unused | **Dead config** | Auth switched to any-email + student ID verification. This env var is never read anywhere in the codebase. |
| 19 | Story views, event categories, listing condition fields | **Not implemented** | Not in schema, no UI. Deferred for v2. |
| 20 | Push notification delivery is unreliable on Android | **Known limitation** | Expo Push API requires Google Play Services. Some Chinese OEMs (Xiaomi, Huawei) may not deliver reliably. Consider FCM direct integration. |

## Known Bugs

| # | Bug | Steps to Reproduce | Notes |
|---|-----|-------------------|-------|
| 21 | Like animation (`Animated.spring`) uses `useNativeDriver: Platform.OS !== "web"` but `Animated.Value` stored in a ref map may be stale if card's memo identity changes mid-animation | Like a post, then quickly collapse/expand. | The scale animation is now platform-guarded for web compatibility. |
| 22 | Chat "unread" divider shows at wrong position if messages arrive while scrolling | Open chat, receive new messages from another user, scroll up. | The `initialCount` check doesn't account for messages that arrived before the initial load completes. |
| 23 | Onboarding: "Join default channels" RPC may fail silently if department name has special characters | Sign up with department containing `&` or `'`. | The `.or()` filter now sanitizes department characters, but a user who already has a special-char department will not auto-join channels. |
| 24 | Verification banner persists after approval until next app restart | Get approved, stay on same screen. | `VerificationBanner` checks `profile.verification_status` which is fetched once. Only a `pull-to-refresh` on profile or app restart will update it. |
| 25 | FlatList `getItemLayout` causes off-by-one scroll positions for variable-height items | Scroll to bottom of feed, then scroll back up. | Estimated heights don't match actual rendered heights. Content will "jump" as items render. Acceptable for MVP. |

## UI Polish (Low Priority)

| # | Issue | Notes |
|---|-------|-------|
| 26 | Empty states use basic centered text — no illustrations. | Add custom illustrations per screen. |
| 27 | No haptic feedback on like/reaction buttons. | Add `expo-haptics`. |
| 28 | Pull-to-refresh uses default spinner — no branded animation. | Custom refresh control deferred. |
| 29 | Profile screen uses `ScrollView` not `FlatList` for the content area. This means all posts/listings are rendered upfront regardless of count. | Convert to `FlatList` with `ListHeaderComponent` for the profile header. |
| 30 | No `ActivityIndicator` on initial load screens — just text "Loading...". | Replace with `LoadingScreen` component. |

## Tech Debt

| # | Item | Notes |
|---|------|-------|
| 31 | `src/constants/theme.ts` is a duplicate of `src/theme/index.ts`. Many files import from both. | Consolidate into a single theme source of truth. |
| 32 | `Spacing` constants defined differently in `constants/theme.ts` (half/one/two/three/four/five/six) vs `theme/index.ts` (xs/sm/md/lg/xl). Both are used across files. | Standardize on one naming convention. |
| 33 | `PostCard` uses both `useTheme()` and `colors` directly — inconsistent styling approach. | Audit all components and use only one pattern. |
| 34 | Test coverage is minimal (jest config + auth + posts tests only). | Add tests for events, marketplace, chats, confessions, and RLS policies. |
| 35 | Migration 00018 adds FK constraints from content tables to `profiles` for PostgREST join support. Run on Supabase before deploying code changes. | Required for `profiles(name)` and `creator:profiles(name)` query syntax to work. |
