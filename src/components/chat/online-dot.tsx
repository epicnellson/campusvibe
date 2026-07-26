import { StyleSheet, View } from "react-native";

type OnlineDotProps = {
  size?: number;
};

export function OnlineDot({ size = 12 }: OnlineDotProps) {
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1, size * 0.18),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#34C759",
    borderColor: "#000000",
  },
});
