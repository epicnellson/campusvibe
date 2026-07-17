import { ActivityIndicator, Image, StyleSheet, View, type ImageProps } from "react-native";

interface Props extends ImageProps {
  uri: string;
  children?: React.ReactNode;
}

export function ImageViewer({ uri, children, ...rest }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        {...rest}
      />
      {!uri && (
        <ActivityIndicator size="large" color="#FFFFFF" style={StyleSheet.absoluteFill} />
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
