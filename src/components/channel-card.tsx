import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
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
      <View style={styles.icon}>
        <ThemedText style={styles.iconText}>
          {channelIcon(channel.type)}
        </ThemedText>
      </View>
      <View style={styles.info}>
        <ThemedText style={styles.channelName}>{name}</ThemedText>
        <ThemedText style={styles.channelMeta} numberOfLines={1}>
          {channel.type === "dm"
            ? "Private conversation"
            : `${channel.members?.length ?? 0} members`}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export const ChannelCard = memo(ChannelCardInner);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E1E",
    backgroundColor: "#000000",
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121214",
  },
  iconText: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  channelName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  channelMeta: {
    fontSize: 13,
    color: "#71717A",
  },
  pressed: {
    opacity: 0.7,
  },
});
