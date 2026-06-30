import { useEffect, useState } from "react";
import { Image, StyleSheet, TouchableOpacity } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize, fontWeight, colors } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import { useSession } from "@/hooks/use-session";
import type { Profile } from "@/services/database.types";
import { fetchSuggestedUsers, followUser, unfollowUser } from "@/services/follows";

type Props = {
  department?: string;
  onComplete: () => void;
};

export function SuggestedUsersStep({ department, onComplete }: Props) {
  const { session } = useSession();
  const theme = useTheme();
  const [users, setUsers] = useState<
    Pick<Profile, "id" | "name" | "department" | "avatar_url">[]
  >([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    setLoading(true);
    fetchSuggestedUsers(session.user.id, department)
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.user?.id, department]);

  const toggleFollow = async (userId: string) => {
    if (following.has(userId)) {
      setFollowing((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      await unfollowUser(userId).catch(() => {});
    } else {
      setFollowing((prev) => new Set(prev).add(userId));
      await followUser(userId).catch(() => {});
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Find classmates</ThemedText>
      <ThemedText themeColor="textSecondary">
        Follow some people to get started
      </ThemedText>

      <ThemedView style={styles.userList}>
        {loading ? (
          <ThemedText themeColor="textSecondary">Finding people...</ThemedText>
        ) : users.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No one else is here yet — invite your friends!
          </ThemedText>
        ) : (
          users.map((user) => (
            <ThemedView
              key={user.id}
              style={[styles.userCard, { backgroundColor: theme.backgroundElement }]}
            >
              <Avatar name={user.name} uri={user.avatar_url} size={48} />
              <ThemedView style={styles.userInfo}>
                <ThemedText style={styles.userName}>{user.name}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.userDept}>
                  {user.department}
                </ThemedText>
              </ThemedView>
              <TouchableOpacity
                onPress={() => toggleFollow(user.id)}
                style={[
                  styles.followButton,
                  {
                    backgroundColor: following.has(user.id)
                      ? theme.backgroundSelected
                      : colors.primary,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.followText,
                    { color: following.has(user.id) ? theme.text : "#ffffff" },
                  ]}
                >
                  {following.has(user.id) ? "Following" : "Follow"}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ))
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  userList: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  userInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  userName: {
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.md,
  },
  userDept: {
    fontSize: fontSize.sm,
  },
  followButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  followText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
