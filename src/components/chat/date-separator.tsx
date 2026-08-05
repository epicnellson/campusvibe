import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";

type DateSeparatorProps = {
  label: string;
};

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <ThemedText style={styles.text}>{label}</ThemedText>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2A2A2A",
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
    color: "#71717A",
    letterSpacing: 0.3,
  },
});
