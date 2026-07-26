import { ActivityIndicator, Image, StyleSheet, View, type ImageProps } from "react-native";
import { useTheme } from "@/hooks/use-theme";

interface Props extends ImageProps {
  uri: string;
  children?: React.ReactNode;
}

export function ImageViewer({ uri, children, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        {...rest}
      />
      {!uri && (
        <ActivityIndicator size="large" color={theme.textOnDark} style={StyleSheet.absoluteFill} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
