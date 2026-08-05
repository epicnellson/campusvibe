import { StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

type OnlineDotProps = {
  size?: number;
};

export function OnlineDot({ size = 12 }: OnlineDotProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1, size * 0.18),
          backgroundColor: theme.success,
          borderColor: theme.background,
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
  },
});
