import { Image, StyleSheet, View, type ImageProps } from "react-native";

interface Props extends ImageProps {
  uri: string;
  children?: React.ReactNode;
}

export function ImageViewer({ uri, children, ...rest }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
        {...rest}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
