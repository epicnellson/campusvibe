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
- **Feed duplicate-key warning fixed**: "two children with the same key" came from `setItems` appends in `index.tsx` that trusted the composer's dedup (refresh prepend + loadMore append). Added `mergeFeedItems()` helper that dedupes by `${type}-${data.id}` against `prev`; used it at both append call sites. `tsc --noEmit` passes.
- **Unguarded `onSnapshot` calls fixed**: The three realtime listeners on `posts`/`confessions`/`events` in `index.tsx` had no error callback, so Firestore `permission-denied` failures surfaced as "Uncaught Error in snapshot listener" console crashes. Added `() => {}` error handlers to all three.
- **`chat/[id].tsx` hook audit**: Confirmed NO hooks-after-early-return bug — all `useCallback`s (incl. `handleStartCall`) are defined before the `if (loading)` return at line 799. No fix needed (earlier note was stale).
- **`expo-av` → `expo-audio` migration**: `message-bubble.tsx` `VoicePlayer` rewritten with `useAudioPlayer(url, { updateInterval: 100 })` + `useAudioPlayerStatus(player)` (play/pause/seek/rate, reset on `didJustFinish`); `message-input.tsx` native recording rewritten with `useAudioRecorder(RecordingPresets.HIGH_QUALITY)` + `requestRecordingPermissionsAsync()` + `setAudioModeAsync({ allowsRecording, playsInSilentMode })` (`prepareToRecordAsync()` → `record()` → `stop()`, uri on `recorder.uri`). Web recording keeps MediaRecorder path. `expo-av@~16.0.8` removed from `package.json`; `expo-audio@~1.1.1` added with `expo-audio` config plugin (microphonePermission) in `app.json`.
- **Deprecated `shadow*` props fixed**: `chat/[id].tsx` FAB style converted from `shadowColor/shadowOffset/shadowOpacity/shadowRadius` to `boxShadow: "0 2px 4px rgba(0,0,0,0.3)"` (matches existing `boxShadow` pattern in `theme/index.ts`). No `shadow*` props remain in `src/`.
- **Firestore rules code-vs-rules mismatch fixed**: `subscribeToTypingStatus` queries collection `typing_status` but rules matched `/typing/{channelId}` → renamed match to `/typing_status/`. Added `/calls/{callId}` match (reads/writes for authenticated users) — the incoming-call listener and call screen use it. Deploy required.
- **All remaining unguarded listeners hardened**: added `() => {}` error callbacks to `db.ts` (`subscribeToDoc`/`subscribeToCollection`), `chats.ts` (`subscribeToChannelMessages`/`subscribeToChannelUpdates`/`subscribeToTypingStatus`/`subscribeToOnlineStatus`), and the `calls` incoming-call listener in `chat/[id].tsx` — stops "Uncaught Error in snapshot listener" console crashes when rules are stale/not deployed.
- **Profile index errors root-caused**: `profile.tsx` "The query requires an index" on `posts`/`listings` — the composite indexes already exist in `firestore.indexes.json` (user_id+created_at) but were never deployed. Run `firebase deploy --only firestore:rules,indexes` to fix both the index errors and the `online_status`/`typing_status`/`calls` permission-denied noise.
- **Chat audit #1 (duplicate subscriptions) fixed**: `chats.tsx` `load()` now uses a `loadGenerationRef` generation guard (stale loads bail before mutating state or subscribing) and calls a shared `teardownSubscriptions()` at the start of every load — overlapping loads (mount + focus + pull-to-refresh) can no longer stack duplicate online/typing/channel-update listeners.
- **Chat audit #8 (extras map overwrite) fixed**: `chats.tsx` `load()` now merges the fresh `extraMap` into existing `extras` via a functional `setExtras((prev) => ...)` (preserving realtime fields like `isOnline`/`isTyping`/unread increments that landed during the fetch window, taking the max unread count) and prunes entries for deleted channels instead of replacing the whole map.
- **Chat audit #13 (stashed modal actions) fixed**: forward and report modals in `chat/[id].tsx` are now dismissible via `onRequestClose` (Android back) and a new `modalBackdrop` Pressable that clears the stashed `messageId`/`channelOwnerId`, so actions can't fire against a stale mounted target.
- **Chat audit #4 (error-path `setItems`) confirmed clean**: error handlers in `index.tsx:249` and `chats.tsx:318` only call `setError` — no direct list-replace calls on failure paths (already guarded by `loadGenerationRef`).
- **External feed content hidden — root-caused and fixed**: `FeedDeduplicator` (`dedup.ts`) persisted `feed_dedup_v2_<uid>` in AsyncStorage with **no TTL**, so any article/video/photo ever fetched was permanently suppressed on every later load (`composer.ts` filters external via `dedup.filterNew`). Since external providers return stable top-content (news top stories, trending gifs, popular videos), the feed degraded to campus-only after the dedup store filled. Fix: added a **24h TTL** via a per-entry `timestamps` map — `isDuplicate()` only treats content as duplicate if seen within `DEDUP_TTL_MS`; `evict()` prunes expired entries; old-format persisted data (no timestamps) degrades gracefully to "all resurfaced once", so external content returns on the next load. `SeenStore` already resurfaced at 24h, so both stores now align. `tsc --noEmit` passes.
- **`clearTransientState()` prefix note**: budget's `feed_dedup_` prefix also matches the dedup store's `feed_dedup_v2_` key, so it wipes the dedup store from disk at every `loadInitial` — cross-session dedup survives only because `restore()` runs before the wipe and `persist()` rewrites afterward. Don't rely on this ordering for correctness; the TTL is now the real guard.
- **Feed refresh now re-fetches external content** (`composer.ts` `refresh()`): calls `clearTransientState()` before fetching (drops proxy cache/backoff so pull-to-refresh actually hits providers), dedupes external items against the in-memory buffer instead of the persistent store (previously-shown articles/videos can resurface on refresh; still registered for cold-load suppression), and STAGE 6 filters against the buffer only (no `seen.filterNew` on refresh). `loadInitial`/`loadMore` still use persistent dedup + seen filtering.
- **Firestore QUIC error fixed** (`firebase.ts`): `getFirestore(app)` → `initializeFirestore(app, { experimentalForceLongPolling: true })` wrapped in a try/catch that falls back to `getFirestore(app)` if already initialized (guards the "called with different options" HMR error). Web-only via `Platform.OS === "web"` (native passes `{}`). NOTE: tried `experimentalAutoDetectLongPolling` but auto-detect still picks streaming WebChannel first, which gets 400 Bad Request + `ERR_QUIC_PROTOCOL_ERROR.QUIC_TOO_MANY_RTOS` before falling back. `experimentalForceLongPolling` (stronger) is required — forces XHR long-polling from the start, bypassing WebChannel streaming entirely. Also extended the `console.warn` filter in `_layout.tsx` (was only `console.error`) for `WebChannelConnection ... transport` messages — the SDK auto-reconnects so they're noise. Note: `ERR_QUIC_PROTOCOL_ERROR.QUIC_TOO_MANY_RTOS` is Chrome transport-level (HTTP/3 negotiation on googleapis); long-polling reduces but can't fully suppress the console noise — the app recovers via HTTP/1.1 fallback. A stale-bundle `getFirestore is not defined` mid-edit error requires a Metro cache clear + page reload.
- **`createShadow()` helper added** (`src/theme/index.ts`): cross-platform shadow helper — web → `boxShadow` string (deprecated `shadow*` props warn on react-native-web), native → `elevation` + `shadow*`. Replaced the last deprecated `shadow*` props in `incoming-call-overlay.tsx` banner with `...createShadow(12, "#000000", 0.35)`. Files already using the `boxShadow` + `elevation` hybrid (`chat/[id].tsx` FAB, `custom-tab-bar.tsx`, theme `shadows`) left unchanged.
- **`eslint-config-expo` was declared but missing** — blocked `npx expo start` with `CommandError`. Installed via `npm install --save-dev eslint-config-expo@~10.0.0 --legacy-peer-deps`. Metro now boots (advisory-only warnings remain: `expo@54.0.35` vs expected `~54.0.36`, `react-native-pager-view@7.0.0` vs expected `6.9.1`).
- **Call invite pipeline wired**:
  - `webrtc.ts` `startCall()` now writes a real `calls/{callId}` doc with `caller_name` + `caller_avatar_url` (fetched from `profiles`) and `created_at`, and arms a **30s ringing timeout** that marks the call `missed` if still `ringing`. `declineCall()` writes `status: "rejected"` (was `missed`). `listenForSignaling()` treats `rejected` as terminal (maps to `missed`).
  - **New `IncomingCallOverlay`** (`src/components/calls/incoming-call-overlay.tsx`), mounted in `_layout.tsx` inside `ToastProvider`: global `calls` listener (`callee_id == me && status == "ringing"`), 45s stale-ring auto-miss, 30s banner timeout, top slide-down banner ("Incoming audio/video call from <name>") with Accept/Decline, accept hands off to full-screen `ActiveCallModal` (incoming). Skips when `webrtcService.isInCall()` or a modal is already open.
  - **Chat screen de-duplicated**: removed `chat/[id].tsx`'s per-screen incoming `calls` listener + `activeCallRef`/`seenIncomingCallIdsRef`/`STALE_RING_MS` — the overlay is now the single source of truth for incoming calls. Outgoing flow unchanged (modal still calls `startCall`).
  - `active-call-modal.tsx` incoming doc listener also treats `rejected` as terminal.
  - **`firestore.indexes.json`**: added composite index `calls (callee_id ASC, status ASC)` — required by the overlay/chat query. Deploy with `firebase deploy --only firestore:indexes`.
  - `npx tsc --noEmit` passes.
- **Feed pipeline merge/sort/fallback completed**:
  - Audit confirmed NO over-filtering: `CampusProvider`'s primary `newest_posts` strategy queries ALL posts (no `user_id == currentUserId` filter); `friend_posts`/`department_posts` are additive. Collection paths `posts`/`confessions`/`events` are consistent between the composer and the realtime listeners in `index.tsx`.
  - `index.tsx` now sorts the merged feed chronologically (newest first) via `sortFeedItems`/`getItemTimestamp` (handles Firestore Timestamps, ISO strings, epoch ms, `published_at`, event `date` fallback). `mergeFeedItems` dedupes AND sorts; realtime prepends for new posts/confessions/events now route through it so listeners can't overwrite or un-sort API/external data.
  - **Fallback seeding**: `FeedComposer.buildFallbackItems()` synthesizes 3 CampusVibe welcome posts (rendered as normal `PostCard`s) when `loadInitial`/`refresh` return zero items — the feed is never blank on a fresh account or when every provider is down. Ids are `fallback-*` so they never collide with real docs or dedup state.
  - `npx tsc --noEmit` passes.
- **Funny video feed providers**:
  - `pexels.ts`: `VIDEO_QUERIES` → `["funny bloopers", "funny pets", "funny fail", "humor", "funny animals"]` (passed to edge route `/videos/search?query=`). Query advancement changed from sequential cycling to `Math.floor(Math.random() * queries.length)`.
  - `giphy.ts`: `SEARCH_QUERIES` → comedy-focused list headed by `["funny meme", "hilarious reaction", "lol video", "dank meme", "comedy fail"]`. Trending mode removed — provider is now search-only (`/v1/gifs/search?q=`), `GiphyState` simplified to `{ searchIndex, searchOffset, searchDone }`.
  - **Shuffle**: `shuffle()` Fisher–Yates helper added to `normalize.ts`; both providers wrap `normalize()` output in it so every refresh yields a randomized stream of short funny Pexels video MP4s + GIPHY GIF/MP4s.
  - `npx tsc --noEmit` passes.
- **Remaining external providers made strictly funny/humorous**:
  - `youtube.ts`: `SEARCH_QUERIES` replaced with comedy/viral-only terms ("try not to laugh", "funny fails compilation", "dank memes", "comedy skit", …); `INITIAL_STATE.mode` → `"search"` + `popularDone: true` so the generic `chart=mostPopular` branch is never used; normalize now wrapped in `shuffle()`.
  - `unsplash.ts`: 30 campus/lifestyle queries collapsed to `["funny animals", "humor", "funny face", "comedy", "funny expressions"]`; normalize wrapped in `shuffle()`.
  - `mastodon.ts`: academic queries → `["funny memes", "jokes", "lol", "funny", "meme", "dad jokes", "comedy", "humor", "hilarious", "funny stories"]`; normalize wrapped in `shuffle()`.
  - `bluesky.ts`: education queries → comedy terms; normalize wrapped in `shuffle()`. Provider still disabled in `index.ts` (region 403).
  - `news.ts`: normalize wrapped in `shuffle()` (queries were already college-comedy).
  - **New `RedditProvider`** (`src/services/feed/providers/reddit.ts`): scrapes `/r/{funny,funnyvideos,dankmemes,memes,unexpected,wholesomememes}/hot.json` via new `reddit` route in `feed-proxy` edge function (User-Agent header, no API key). Surfaces **image + gif posts only** — `post.is_video` is filtered out because the shared `ExternalFeedCard` renders every `type === "video"` with `YouTubeEmbed`, so Reddit-hosted videos would render a broken player. Normalize filters NSFW/stickied/spoiler/removed posts, prefers `preview.images[0].source.url` (unescaped `&amp;`), keeps `.gif` direct URLs as `type: "gif"`, sets `contentCategory: "memes"`, and wraps output in `shuffle()`. Registered in `createFeedComposer`, `reddit: 0.35` added to `providerPriority` in both `types.ts` `DEFAULT_CONFIG` and `composer.ts` inline config, `"reddit"` added to `ExternalFeedItem.source` union. NOTE: Reddit may rate-limit/block Google Cloud edge IPs — if 429s persist, only the campus feed will surface.
  - `feed-aggregator` edge function (legacy, no app callers) aligned: Unsplash query → `funny animals humor comedy`, YouTube `chart=mostPopular` → `search?q=funny shorts`.
  - `npx tsc --noEmit` passes.
- **Feed/post-detail interaction sync (data consistency)**: `PostInteractionsProvider` (`src/hooks/use-post-interactions.tsx`) is now the single source of truth for like/reaction/repost/comment counts across the feed and `post/[id].tsx`.
  - `bulkSetReactions`/`bulkSetRepostedIds`/`bulkSetRepostCounts`/`bulkSetCommentCounts` switched from **replace** to **merge** semantics (functional updates that only touch incoming keys) so a background feed refresh can't clobber detail-screen state.
  - Added targeted `setRepostedForPost(postId, bool)` + `setRepostCountForPost(postId, n)` (previously only bulk setters existed).
  - `post/[id].tsx` now **hydrates the shared store on load**: `fetchReactions(id)` → `setReactionsForPost`, `setCommentCount(id, comments.length)`, `getUserRepostedPostIds`/`getRepostCount` → `setRepostedForPost`/`setRepostCountForPost`. Deep-linked/direct-opened posts no longer show 0 reactions / un-reposted / stale comment counts.
  - Detail screen comment count reads store-first (`commentCounts.get(id) ?? comments.length`); `handleSendReply` increments the store optimistically, sets it to the refetched authoritative length on success, and decrements on failure — feed card shows the updated count on back-navigation.
  - Added realtime listeners on detail: `onSnapshot` on the `posts/{id}` doc (updates `post.likes`) and `reactions` collection (`post_id == id` → `setReactionsForPost`), mirroring the feed's pattern. Share counts aren't stored anywhere (native share sheet only), so nothing to sync.
  - `npx tsc --noEmit` passes.
- **`feed-proxy` 403 fixed** (`src/services/feed-proxy.ts`): client now sends `apikey: EXPO_PUBLIC_SUPABASE_ANON_KEY` header (Supabase API gateway requires an apikey even when `verify_jwt = false`); missing it caused 403 on every proxy call. 403/429 responses now return `{ _skipped: true, _reason: "rate_limited_<status>" }` instead of throwing, so the composer's multi-provider fallback (Pexels/GIPHY/campus) continues. Edge `proxyReddit` redeployed: `User-Agent` → Reddit-recommended `web:campusvibe:v1.0.0 (by /u/campusvibe)`, and 403/429 upstream now returns an empty `data.children` listing (200) instead of a 4xx error.
- **Input vertical alignment pass** (`src/components/ui/input.tsx`): container gets `minHeight: 48` + `paddingVertical: 12` + `justifyContent: "center"`; TextInput loses its `paddingVertical: 12` (now `paddingVertical: 0` + `textAlignVertical: "center"`) so single-line text/icons are always vertically centered regardless of icon or fixed-height usage; label/error get explicit `lineHeight` and label `alignSelf: "flex-start"`. Multiline textareas (`create-event`/`create-listing` `textArea` style) keep identical padding since their `minHeight: 100` + `textAlignVertical: "top"` still override the base. Chat `message-input.tsx` already had correct centering (no change).
- **External content restored in feed (live-verified upstreams)**: curl confirmed all edge providers return 200 real data with `apikey` + publishable key (pexels/giphy/unsplash/youtube/news); Reddit returns the graceful empty-list fallback (cloud IP blocked). Two client-side fixes completed:
  - **External items no longer sink to bottom** (`src/app/(tabs)/index.tsx` `toDisplayItem`): `published_at` now falls back to `item.timestamps.fetchedAt` when `publishedAt` is null (Pexels/GIPHY/Unsplash have no publish date → previously timestamp 0 → sorted below all campus posts → looked "missing"). External content now sorts by fetch time and interleaves near the top of the feed.
  - **Load-more exhaustion respected** (`composer.ts` `loadMore` now returns `hasMore: false` when a page produces no items AND fetched no raw items — previously always `true`); `index.tsx` `loadMoreExternal` honors `page.hasMore` via `setFeedHasMore(false)` in addition to the existing 3-empty-strike guard. The "Loading more…" footer now stops on genuine exhaustion instead of spinning until the strike limit.
  - `npx tsc --noEmit` passes.
- **Pull-to-refresh + mock-fallback audit** (feed tab is `src/app/(tabs)/index.tsx`; NO `feed.tsx` and NO `fetchExternalFeed()` exist — external fetching lives in the `FeedComposer` class). "Anonymous Badger"/"Omar Ibrahim" only exist in `functions/src/seed.ts` (a DB seed script) — the app's only synthetic feed content is `buildFallbackItems()` ("CampusVibe" welcome posts), now initial-load-only:
  - `composer.ts` `refresh()` no longer seeds fallback items — a manual pull-to-refresh that returns 0 items keeps the existing buffer on screen instead of swapping in hardcoded posts. `buildFallbackItems()` remains only in `loadInitial` for blank fresh accounts.
  - `index.tsx` `onRefresh` → `load(true)` → `composer.refresh()` (already forces a real external re-fetch via `clearTransientState()` + `fetchExternalFresh()`) and merges via `mergeFeedItems(prev, items, "prepend")` = `deduplicateById([...apiItems, ...prev])`.
  - **Debug logs + 0-item toast**: `console.log("[feed] pull-to-refresh triggered")`, `console.log("[feed] refresh fetched API items:", n)`, `console.log("[feed] initial fetched API items:", n)`. When refresh returns 0 items, a `warning` toast shows "Couldn't fetch new posts — showing your saved feed" (or "No new posts available right now") via `useToast` `showToast`. `itemsLengthRef` (synced by effect) avoids re-creating `load` on every items change; `showToast` is stable (`useCallback([])` in `Toast.tsx`).
- **"20 API items don't display" root-caused and fixed** (`src/app/(tabs)/index.tsx`): the render source was always correct — `data={items}` (no `seedPosts`/`mockData` array), `toDisplayItem` never drops external items, and the campus provider sets `meta.rawRow`/`rawTable` so campus posts map fine. The real bug: `await enrichCampusItems(displayItems)` runs AFTER `setItems`, and any Firestore error in it (`fetchReactionsForPosts`/`getUserRepostedPostIds`/`fetchCommentCounts`/`getRepostCount` — permission/index/offline) threw into `load`'s `catch`, which set `error` → the error view replaced the FlatList even though `items` held the fetched posts. Fix: `enrichCampusItems` is now wrapped in try/catch (best-effort — logs `[feed] enrichCampusItems failed:` and returns), so fetched items always render; counts/reactions silently default when enrichment fails.
- **Feed render-pipeline diagnostic pass**: re-verified there is NO `setPosts`, NO `seedPosts`/`mockData` render source, NO AsyncStorage cache-restore override in the component, NO `activeTab`/`for-you` filter, and NO `return null` gate in `renderItem`/`ExternalFeedCard` — `data={items}` (index.tsx:682) is the single source written by `setItems(sortFeedItems(displayItems))` (replace on cold load) and `mergeFeedItems(prev, items, "prepend")` (merge on refresh/loadMore; all realtime listeners also merge-preserve). The 20-item log was already followed by the correct state write; the only earlier failure path (enrichment throwing → error screen) is fixed. Added mapped-count visibility logs so the 20→N→render trace is provable: `[feed] initial fetched API items: N`, `[feed] display items mapped: N -> setItems`, `[feed] refresh display items mapped: N -> prepend`, `[feed] loadMore display items mapped: N -> append`.
- **Temp renderItem log + Pexels broken-video fix** (`src/app/(tabs)/index.tsx` `renderItem`): added temporary `console.log("[FlatList Render]", id, label, source)` so the rendered keys are visible per row (id = `getItemId(item)`, label = external title/description or post content, source = external provider or `campus`). **Diagnosis of ask #2**: `ExternalFeedCard` is NOT receiving undefined media — it was receiving a **wrong-typed `video_id`**. Pexels videos set `videoId` to the Pexels numeric ID (pexels.ts:191), which flowed through `toDisplayItem.video_id` → `ExternalFeedCard.isVideo` → `YouTubeEmbed videoId="4456002"` → broken "Video unavailable" embed + 404 YouTube thumbnail. Fix: `toDisplayItem` now only passes `video_id` when it matches a real 11-char YouTube ID (`/^[A-Za-z0-9_-]{11}$/`; only the `youtube` provider qualifies) and for `type === "video"` items prefers `media.thumbnailUrl` over the raw MP4 `media.url` for `image_url` so non-YouTube videos render as a poster-frame image card. `npx tsc --noEmit` passes.
- **Feed composition rebalanced + progressive render removed** (audit: `post-cv-usr-*`/`cv-usr-*` ids exist ONLY in `functions/src/seed.ts` — zero `seedPosts`/`mockData`/`mockPosts` matches in `src/`, so there is no app-side seed array; seeded posts are real Firestore docs the campus provider fetches as part of the "20 API items"). Per user decision, both levers applied so external API content renders more prominently:
  - **campus ratio lowered** 0.70–0.85 → **0.20–0.30** and `explorationRatio` 0.18 → 0.25 in all three definitions (`composer.ts` inline config, `types.ts` `DEFAULT_CONFIG`, `diversifier.ts` defaults) — external providers (Pexels/GIPHY/Reddit/YouTube/etc.) now fill ~70–80% of feed slots instead of 15–30%.
  - **Progressive campus-only first render removed**: `loadInitial()` no longer takes an `onProgressiveUpdate` callback — the first render waits for the full mixed campus+external batch, so the seed-only flash never appears. The diversified campus list is still computed (inline) for the `externalProviders.length === 0` early return. `index.tsx` `load()` updated to `await composer.loadInitial()`.
  - `npx tsc --noEmit` passes.
- **`feed-proxy.ts` timeout + silent degradation**: added `PROXY_TIMEOUT_MS = 10000` (kept below the composer's `PROVIDER_TIMEOUT_MS = 12000` so the skip lands at the proxy layer, not as a harder AbortError). `feedProxy()` now creates an internal `AbortController` combined with the caller's signal (parent abort still re-throws as cancellation); an internal timeout returns `{ _skipped: true, _reason: "timeout", items: [], data: {} }` instead of throwing. 5xx incl. 502/504 already returned `_skipped` via the `>= 500` branch. A single slow provider (e.g. Mastodon 504) therefore degrades quietly while Pexels/GIPHY/YouTube results continue (providers run via `Promise.allSettled` in `fetchConcurrentIndependent`).
- **Audit: no restrictive frontend filters on external items**: `renderItem` → `ExternalFeedCard` has no top-level `return null` gate; `toDisplayItem` always returns a valid external item for non-campus sources; nothing checks `university === currentUniv` or mandatory user props. `npx tsc --noEmit` passes.
  - `npx tsc --noEmit` passes.
- **Dedup + pagination guards hardened** (`src/app/(tabs)/index.tsx`): audit confirmed `mergeFeedItems` already dedupes by `${type}-${id}` on pagination/refresh, `onEndReachedThreshold={0.5}` is set, initial state is already `useState<FeedDisplayItem[]>([])` (no mock pre-seed). Two genuine gaps closed: (1) `sortFeedItems` now **dedupes** (cold-load `setItems(sortFeedItems(...))` was the only setter without dedup — relied solely on composer batch-level dedup; now the state pipeline is dedup-invariant and external items can't be shadowed by repeated mock rows); (2) `onEndReached` now also guards `!loadInFlightRef.current` so `loadMore` can't fire during a refresh (only `!loading` was checked, which is false during refresh). `npx tsc --noEmit` passes.
- **Feed dedup refactor + clean refresh + query diversity**:
  - `sortFeedItems` (`index.tsx`) now dedupes via the Map pattern `Array.from(new Map(items.map(i => [`${i.type}:${getItemId(i)}`, i])).values())` (strict, O(n), last-occurrence-wins); `mergeFeedItems` simplified to concat + `sortFeedItems` (dedup-invariant, applied to cold load, refresh, loadMore).
  - `onEndReached` already guards `!loading && !loadInFlightRef.current && hasInitiallyLoaded.current && feedHasMore` — cannot fire on mount (hasInitiallyLoaded=false) or during an active load/refresh (loadInFlightRef).
  - **Pull-to-refresh is now a clean replace**: `composer.refresh()` resets ALL provider states + `providerPages`/`providerDone`/`providerSkipped` + budgets (was campus-only), so a refresh is a fully randomized re-fetch from scratch, not a resume of the last `loadMore` cursors. UI side `setItems` **replaces** the feed (no prepend accumulation); if the fresh fetch returns 0 items the saved feed is kept + warning toast.
  - **Query diversity**: expanded query arrays in YouTube (37), Pexels videos (21), GIPHY (45), Reddit (20 subreddits) across three categories (Campus & College Life / Funny & Memes / Trending & Music). All four providers **randomize** the query/subreddit on each fresh fetch (YouTube when `searchPageToken` empty, Pexels when `page===1 && pagesForMode===0`, GIPHY when `searchOffset===0`, Reddit when `after` null) while preserving in-query pagination cursors.
  - **YouTube localization**: `feed-proxy` edge function now appends `&relevanceLanguage=en&regionCode=US` to the YouTube search URL (client sends `relevanceLanguage: "en"`). **Requires edge redeploy** (`supabase functions deploy feed-proxy`).
  - `npx tsc --noEmit` passes.
- **Campus pool shuffle + even campus/API weave** (`composer.ts`):
  - **Campus posts are now Fisher-Yates shuffled on every fetch** — `loadInitial`, `refresh`, and `loadMore` all call the existing `shuffle()` (normalize.ts) on the campus items right after normalize/dedupe, so Omar/Adebayo/Carlos et al. land in varied positions on every cold load and refresh instead of the static DB/strategy order the `CampusProvider` returns.
  - **New `interleaveCampusAndExternal()` STAGE 7**: after STAGE 6 (the `[...campusCandidates, ...externalCandidates]` concat that previously stacked all campus at the top), the composer now evenly weaves campus and external items across the whole page using the largest-remainder method (minority group placed at `floor((i+0.5)*total/k)` slot indices). Result: a stable "1 campus every few API items" cadence across the full 20-item payload — never a campus block followed by an API block. Applied in `loadInitial`, `refresh` (fresh page), and `loadMore` (both main + fallback paths).
  - Re-shuffle on `onRefresh` already flows through `composer.refresh()` (full provider reset + fresh randomized external offsets from the previous session) and now also re-shuffles the campus pool + re-weaves the replaced page.
  - `npx tsc --noEmit` passes.
- **Feed freshness algorithm with Seen-Item Suppression**:
  - `SeenStore.partition()` (`seen.ts`) splits candidates into strictly-unseen vs seen. New `suppressSeenWithFallback()` (`composer.ts`) applies **strict seen suppression to BOTH campus and external items** on cold load, refresh, AND pagination — any item the user has already viewed is filtered out (previous design only suppressed external). If the unseen pool drops below `MIN_UNSEEN = 5`, older seen items are re-appended **only at the very end** of the list (`[...interleave(unseen), ...seen.slice(0, need)]`).
  - Viewed-item recording already runs via `onViewableItemsChanged` → `composer.touchItems()` (AsyncStorage-persisted `SeenStore`, 1500-item LRU eviction).
  - `onRefresh` clean slate: `index.tsx` now keeps `itemsRef` and calls `composer.touchItems(displayedIds)` before `composer.refresh()` so the currently displayed posts are marked seen → refresh() pulls an entirely fresh unseen batch (providers/cursors already reset from the previous session).
  - **Strict 1:1 slot pattern**: campus ratio raised from 0.20–0.30 → **0.45–0.55** in `composer.ts` inline config, `types.ts` `DEFAULT_CONFIG`, and `diversifier.ts` defaults so the even-spread weave yields "Slot 0 = External, then Campus/External alternation" — never 3–4 consecutive campus posts.
  - **Pagination exhaustion fix**: `loadMore` sets `hasMore = false` when the page contains only already-seen fallback items (`scored.some(!seen)` false), preventing an infinite replay of the same fallback page.
  - `npx tsc --noEmit` passes.
- **Cleanup / health audit** (orphans, debug logs, jest):
  - **Deleted `src/services/feed-seen.ts`**: confirmed orphan (zero imports; dead duplicate of `feed/seen.ts`).
  - **Removed all 7 debug `console.log`s** from `src/app/(tabs)/index.tsx` (the `[feed] ...` load/refresh/loadMore logs and the per-row `[FlatList Render]` log in `renderItem`, including its now-unused `renderLabel`/`renderSource` consts). Zero `console.log`/`console.debug` remain in `src/`.
  - **Jest is now actually runnable** — `npm test` = `npx jest`. It was previously broken in three ways: (1) `jest.config.js` had a typo `setupFilesAfterSetup` (correct: `setupFilesAfterEnv`) AND never loaded `__tests__/setup.ts` (so no firebase/db mocks applied — the real ESM-only firebase v12 modules made every suite fail to parse); (2) no `test` script and no jest deps in `package.json`; (3) `auth.test.ts` tested removed exports (`validateEmailDomain`/`sendMagicLink`/`completeEmailLinkSignIn`). Fixes: `setupFilesAfterEnv: ["@testing-library/jest-dom", "<rootDir>/__tests__/setup.ts"]`, `testPathIgnorePatterns` excludes `__tests__/setup.ts`, devDeps added (`jest@~29.7.0`, `jest-expo@~54.0.0`, `@testing-library/jest-dom`, `react-test-renderer@19.1.0`), `auth.test.ts` rewritten against the current API (`signUp`/`signIn`/`resendVerification`/`signOut`), `setup.ts` extended with current `firebase/auth` mocks + `@/services/retry` (withRetry passthrough — avoids 1/2/4s retry delays in tests) + `expo-web-browser` mocks.
  - **Restored empty-content guard in `createConfession()`** (`Please write something before posting.`) — the stale test asserted it and the check had been dropped; also keeps moderation from running on blank content.
  - **Result: `npx jest` → 3 suites / 18 tests passing** (auth, posts, confessions). `npx tsc --noEmit` passes. Confirmed NOT orphans (kept): `functions/` (live Firebase Functions), `src/app/index.tsx` (welcome screen), `src/app/search.tsx` (route-collision `<Redirect>` guard for `/search`), `admin/` (static dashboard).

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
