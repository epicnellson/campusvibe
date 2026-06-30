import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, borderRadius, fontSize } from "@/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Channel } from "@/services/database.types";

export type ChannelCardProps = {
  channel: Channel & { members: { user_id: string }[] };
  displayName?: string;
  onPress: () => void;
};

function channelIcon(type: string): string {
  switch (type) {
    case "general":
      return "📢";
    case "department":
      return "🏫";
    case "hostel":
      return "🏠";
    case "dm":
      return "💬";
    default:
      return "#";
  }
}

function ChannelCardInner({ channel, displayName, onPress }: ChannelCardProps) {
  const theme = useTheme();
  const name =
    displayName ??
    (channel.type === "dm" ? "Direct Message" : channel.name);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityLabel={`Open ${name} channel`}
      accessibilityRole="button"
    >
      <ThemedView style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.iconText}>
          {channelIcon(channel.type)}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.info}>
        <ThemedText type="smallBold">{name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {channel.type === "dm"
            ? "Private conversation"
            : `${channel.members?.length ?? 0} members`}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export const ChannelCard = memo(ChannelCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: fontSize.xl,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
