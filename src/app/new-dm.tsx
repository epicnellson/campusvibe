import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Avatar } from "@/components/ui/Avatar";
import { MaxContentWidth } from "@/constants/theme";
import { fetchAllUsers, getOrCreateDMChannel } from "@/services/chats";
import { auth } from "@/services/firebase";
import { router } from "expo-router";
import { db_ops } from "@/services/db";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/services/retry";

type UserResult = {
  id: string;
  name: string;
  department: string;
  avatar_url?: string | null;
  email?: string;
  year?: string;
  verification_status?: string;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1E1E1E",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchRow: {
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
  searchClear: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  listContent: { paddingBottom: 24 },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1E1E1E",
  },
  userItemPressed: { opacity: 0.6 },
  userInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  userName: { fontSize: 16, fontWeight: "500", color: "#FFFFFF" },
  userMeta: { fontSize: 13, color: "#71717A" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 20,
  },
});

export default function NewDMScreen() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [creatingChannel, setCreatingChannel] = useState<string | null>(null);
  const toast = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    setCurrentUserId(user?.uid ?? null);
  }, []);

  // Load all users on mount
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const loadUsers = async () => {
      setLoading(true);
      try {
        // Get all profiles
        const profiles = await db_ops.query("profiles", { limitCount: 100 });
        if (cancelled) return;
        const filtered = (profiles as any[]).filter(
          (p) => p.id !== currentUserId
        );
        setUsers(filtered);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
    return () => { cancelled = true; };
  }, [currentUserId]);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 1) {
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await fetchAllUsers(text.trim());
        // Filter out current user
        const filtered = results.filter((r) => r.id !== currentUserId);
        setUsers(filtered);
      } catch {
        // keep existing users
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [currentUserId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSelectUser = useCallback(
    async (otherUserId: string) => {
      if (!currentUserId) {
        Alert.alert("Error", "Please wait for the app to load.");
        return;
      }
      if (creatingChannel) return;
      setCreatingChannel(otherUserId);
      try {
        const channelId = await getOrCreateDMChannel(currentUserId, otherUserId);
        router.push(`/chat/${channelId}`);
      } catch (err) {
        toast.show(getErrorMessage(err), "error");
      } finally {
        setCreatingChannel(null);
      }
    },
    [currentUserId, creatingChannel]
  );

  const sectionLabel = search.trim().length >= 1
    ? searching
      ? "Searching..."
      : `Results for "${search}"`
    : loading
    ? "Loading people..."
    : "All People";

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>New Message</ThemedText>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#71717A" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={handleSearch}
              placeholder="Search by name or email..."
              placeholderTextColor="#71717A"
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearch("");
                  setSearching(false);
                  // Reload all users
                  if (currentUserId) {
                    db_ops.query("profiles", { limitCount: 100 }).then((profiles) => {
                      setUsers(
                        (profiles as any[]).filter((p) => p.id !== currentUserId)
                      );
                    }).catch(() => {});
                  }
                }}
                style={styles.searchClear}
              >
                <Ionicons name="close" size={12} color="#A1A1A6" />
              </Pressable>
            )}
          </View>
        </View>

        <ThemedText style={styles.sectionLabel}>{sectionLabel}</ThemedText>

        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isCreating = creatingChannel === item.id;
            const meta = [item.department, item.year].filter(Boolean).join(" · ");
            return (
              <Pressable
                onPress={() => handleSelectUser(item.id)}
                disabled={isCreating}
                style={({ pressed }) => [
                  styles.userItem,
                  pressed && styles.userItemPressed,
                  isCreating && { opacity: 0.5 },
                ]}
              >
                <Avatar uri={item.avatar_url} name={item.name} size={48} />
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <ThemedText style={styles.userName}>{item.name}</ThemedText>
                    {item.verification_status === "approved" && (
                      <Ionicons name="checkmark-circle" size={15} color="#6C47FF" />
                    )}
                  </View>
                  {meta ? (
                    <ThemedText style={styles.userMeta}>{meta}</ThemedText>
                  ) : null}
                </View>
                {isCreating ? (
                  <ActivityIndicator size="small" color="#6C47FF" />
                ) : (
                  <Ionicons name="chatbubble-outline" size={18} color="#3A3A3A" />
                )}
              </Pressable>
            );
          }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={
                    search.trim().length >= 1
                      ? "search-outline"
                      : "people-outline"
                  }
                  size={36}
                  color="#3A3A3A"
                />
              </View>
              <ThemedText style={styles.emptyTitle}>
                {search.trim().length >= 1
                  ? searching
                    ? "Searching..."
                    : "No users found"
                  : loading
                  ? "Loading..."
                  : "No people yet"}
              </ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                {search.trim().length >= 1
                  ? `No results for "${search}"`
                  : loading
                  ? "Fetching people..."
                  : "No other users have joined yet."}
              </ThemedText>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </ThemedView>
  );
}
