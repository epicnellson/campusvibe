import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { fetchAllUsers, getOrCreateDMChannel } from "@/services/chats";
import { supabase } from "@/services/supabase";
import { router } from "expo-router";

export default function NewDMScreen() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<
    { id: string; name: string; department: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const handleSearch = async (text: string) => {
    setSearch(text);
    if (text.trim().length < 2) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const results = await fetchAllUsers(text.trim());
      setUsers(results);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (otherUserId: string) => {
    if (!currentUserId) return;
    try {
      const channelId = await getOrCreateDMChannel(currentUserId, otherUserId);
      router.replace(`/chat/${channelId}`);
    } catch {
      // silently fail
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedView style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ThemedText style={styles.backText}>{"<"}</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle}>
            New Message
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.searchBar}>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={handleSearch}
            placeholder="Search by name..."
            placeholderTextColor="#999"
            autoFocus
          />
        </ThemedView>

        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelectUser(item.id)}
              style={({ pressed }) => [
                styles.userItem,
                pressed && styles.pressed,
              ]}
            >
              <ThemedView style={styles.avatar}>
                <ThemedText style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.userInfo}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.department}
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedView style={styles.empty}>
              <ThemedText themeColor="textSecondary">
                {search.length < 2
                  ? "Type at least 2 characters to search"
                  : loading
                    ? "Searching..."
                    : "No users found"}
              </ThemedText>
            </ThemedView>
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F3",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 20,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 17,
  },
  searchBar: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  input: {
    backgroundColor: "#F0F0F3",
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: Spacing.three,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.three,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#208AEF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  userInfo: {
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing.four,
  },
});
