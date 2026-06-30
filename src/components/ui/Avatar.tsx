import { View, StyleSheet, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/themed-text";
import { colors, fontSize, fontWeight, borderRadius } from "@/theme";

export type AvatarProps = {
  uri?: string | null;
  name: string;
  size?: number;
  style?: ViewStyle;
};

export function Avatar({ uri, name, size = 40, style }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const bgColor = stringToColor(name);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size / 2 },
          style as any,
        ]}
        accessibilityLabel={`${name}'s avatar`}
        accessibilityRole="image"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}
      accessibilityLabel={`${name}'s avatar`}
    >
      <ThemedText
        style={[
          styles.initials,
          { fontSize: size * 0.4 },
        ]}
      >
        {initials}
      </ThemedText>
    </View>
  );
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.backgroundElement,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#FFFFFF",
    fontWeight: fontWeight.semibold,
  },
});
