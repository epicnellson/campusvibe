import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/Avatar";
import { SearchResultsSkeleton } from "@/components/feed-skeleton";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { resolveImageUrl } from "@/services/storage";
import {
  performSearch,
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  type SearchResult,
  type SearchUser,
  type SearchPost,
  type SearchEvent,
  type SearchListing,
} from "@/services/search";

type Section =
  | { type: "header"; title: string }
  | { type: "history"; term: string }
  | { type: "user"; data: SearchUser }
  | { type: "post"; data: SearchPost }
  | { type: "event"; data: SearchEvent }
  | { type: "listing"; data: SearchListing };

export default function SearchTabScreen() {
  const colors = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    getSearchHistory().then(setHistory);
  }, []);

  const doSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await performSearch(term);
      setResults(res);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text), 300);
    },
    [doSearch]
  );

  const handleSubmit = useCallback(async () => {
    if (query.trim().length >= 2) {
      await addSearchHistory(query.trim());
      const h = await getSearchHistory();
      setHistory(h);
      doSearch(query);
    }
  }, [query, doSearch]);

  const handleSelectHistory = useCallback(
    (term: string) => {
      setQuery(term);
      doSearch(term);
    },
    [doSearch]
  );

  const handleClearHistory = useCallback(async () => {
    await clearSearchHistory();
    setHistory([]);
  }, []);

  const sections: Section[] = [];
  if (!results) {
    if (history.length > 0) {
      sections.push({ type: "header", title: "Recent Searches" });
      for (const term of history) {
        sections.push({ type: "history", term });
      }
    }
  } else {
    if (results.users.length > 0) {
      sections.push({ type: "header", title: "People" });
      for (const u of results.users) sections.push({ type: "user", data: u });
    }
    if (results.posts.length > 0) {
      sections.push({ type: "header", title: "Posts" });
      for (const p of results.posts) sections.push({ type: "post", data: p });
    }
    if (results.events.length > 0) {
      sections.push({ type: "header", title: "Events" });
      for (const e of results.events) sections.push({ type: "event", data: e });
    }
    if (results.listings.length > 0) {
      sections.push({ type: "header", title: "Marketplace" });
      for (const l of results.listings) sections.push({ type: "listing", data: l });
    }
    if (sections.length === 0) {
      sections.push({ type: "header", title: "No results found" });
    }
  }

  const showEmpty = !loading && query.trim().length >= 2 && results &&
    results.users.length === 0 && results.posts.length === 0 &&
    results.events.length === 0 && results.listings.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.safeArea}>
        <View style={styles.headerBar}>
          <ThemedText style={styles.title}>Search</ThemedText>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#71717A" />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={handleChange}
              onSubmitEditing={handleSubmit}
              placeholder="Search people, posts, events..."
              placeholderTextColor="#71717A"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => { setQuery(""); setResults(null); }}
                style={styles.clearBtn}
              >
                <Ionicons name="close-circle" size={18} color="#71717A" />
              </Pressable>
            )}
          </View>
        </View>

        {loading ? <SearchResultsSkeleton /> : null}

        {!loading && results && history.length > 0 && (
          <Pressable onPress={handleClearHistory} style={styles.clearHistoryBtn}>
            <ThemedText style={styles.clearHistoryText}>Clear search history</ThemedText>
          </Pressable>
        )}

        {!loading && (
        <FlatList
          data={sections}
          keyExtractor={(item, idx) => {
            if (item.type === "header") return `h-${item.title}`;
            if (item.type === "history") return `hist-${item.term}`;
            if (item.type === "user") return `u-${item.data.id}`;
            if (item.type === "post") return `p-${item.data.id}`;
            if (item.type === "event") return `e-${item.data.id}`;
            return `l-${(item as any).data.id}-${idx}`;
          }}
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>{item.title}</ThemedText>
                  {item.title === "Recent Searches" && (
                    <Pressable onPress={handleClearHistory}>
                      <ThemedText style={styles.clearBtnText}>Clear</ThemedText>
                    </Pressable>
                  )}
                </View>
              );
            }

            if (item.type === "history") {
              return (
                <Pressable
                  onPress={() => handleSelectHistory(item.term)}
                  style={styles.resultRow}
                >
                  <View style={[styles.resultIcon, { backgroundColor: "#1C1C1E" }]}>
                    <Ionicons name="time-outline" size={18} color="#71717A" />
                  </View>
                  <ThemedText style={styles.historyText}>{item.term}</ThemedText>
                </Pressable>
              );
            }

            if (item.type === "user") {
              const u = item.data;
              return (
                <Pressable
                  onPress={() => router.push(`/user/${u.id}`)}
                  style={styles.resultRow}
                >
                  <Avatar
                    uri={resolveImageUrl(u.avatar_url, "profile-photos") ?? undefined}
                    name={u.name}
                    size={44}
                  />
                  <View style={styles.resultInfo}>
                    <View style={styles.nameRow}>
                      <ThemedText style={styles.resultName}>{u.name}</ThemedText>
                      {u.verification_status === "approved" && (
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      )}
                    </View>
                    <ThemedText style={styles.resultMeta}>
                      {[u.department, u.year].filter(Boolean).join(" · ")}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#71717A" />
                </Pressable>
              );
            }

            if (item.type === "post") {
              const p = item.data;
              return (
                <Pressable
                  onPress={() => router.push(`/post/${p.id}`)}
                  style={styles.resultRow}
                >
                  <View style={[styles.resultIcon, { backgroundColor: "#1C1C1E" }]}>
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.resultInfo}>
                    <ThemedText style={styles.resultName} numberOfLines={1}>
                      {p.authorName ?? "User"}
                    </ThemedText>
                    <ThemedText style={styles.resultMeta} numberOfLines={1}>
                      {p.content}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            }

            if (item.type === "event") {
              const e = item.data;
              return (
                <Pressable
                  onPress={() => router.push(`/event/${e.id}`)}
                  style={styles.resultRow}
                >
                  <View style={[styles.resultIcon, { backgroundColor: "#1C1C1E" }]}>
                    <Ionicons name="calendar-outline" size={20} color="#1DB954" />
                  </View>
                  <View style={styles.resultInfo}>
                    <ThemedText style={styles.resultName} numberOfLines={1}>
                      {e.title}
                    </ThemedText>
                    <ThemedText style={styles.resultMeta} numberOfLines={1}>
                      {e.location} · {e.date}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            }

            if (item.type === "listing") {
              const l = item.data;
              const photo = l.photos?.length > 0 ? l.photos[0] : null;
              return (
                <Pressable
                  onPress={() => router.push({ pathname: "/listing/[id]", params: { id: String(l.id) } })}
                  style={styles.resultRow}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.listingThumb} />
                  ) : (
                    <View style={[styles.resultIcon, { backgroundColor: "#1C1C1E" }]}>
                      <Ionicons name="pricetag-outline" size={20} color="#FF9500" />
                    </View>
                  )}
                  <View style={styles.resultInfo}>
                    <ThemedText style={styles.resultName} numberOfLines={1}>
                      {l.title}
                    </ThemedText>
                    <ThemedText style={styles.resultMeta}>
                      {l.price} · {l.category}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            }

            return null;
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            showEmpty ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="search-outline" size={36} color="#3A3A3A" />
                </View>
                <ThemedText style={styles.emptyTitle}>No results found</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  No results for "{query}". Try a different search term.
                </ThemedText>
              </View>
            ) : !loading && !results && history.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="search-outline" size={36} color="#3A3A3A" />
                </View>
                <ThemedText style={styles.emptyTitle}>Search CampusVibe</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Find people, posts, events, and listings
                </ThemedText>
              </View>
            ) : null
          }
        />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
    paddingBottom: BottomTabInset,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#FFFFFF",
    marginBottom: 10,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    paddingVertical: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#71717A",
  },
  clearHistoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  clearHistoryText: {
    fontSize: 13,
    color: "#71717A",
  },
  list: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearBtnText: {
    fontSize: 13,
    color: "#71717A",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  resultMeta: {
    fontSize: 13,
    color: "#71717A",
  },
  historyText: {
    fontSize: 15,
    color: "#E1E1E1",
    flex: 1,
  },
  listingThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },
});
