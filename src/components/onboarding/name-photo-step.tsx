import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Input } from "@/components/ui/input";
import { spacing, borderRadius, fontSize, fontWeight } from "@/theme";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  name: string;
  onNameChange: (name: string) => void;
  photoUri: string | null;
  onPhotoChange: (uri: string | null) => void;
};

export function NamePhotoStep({ name, onNameChange, photoUri, onPhotoChange }: Props) {
  const theme = useTheme();

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onPhotoChange(result.assets[0].uri);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Welcome!</ThemedText>
      <ThemedText themeColor="textSecondary">
        Let's get to know you
      </ThemedText>

      <ThemedView style={styles.form}>
        <TouchableOpacity
          onPress={pickPhoto}
          style={[styles.avatarCircle, { backgroundColor: theme.backgroundElement }]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
          ) : (
            <ThemedText style={styles.avatarPlaceholder}>+</ThemedText>
          )}
        </TouchableOpacity>
        <ThemedText style={styles.avatarHint} themeColor="textSecondary">
          Tap to add a photo
        </ThemedText>

        <Input
          placeholder="Your name"
          value={name}
          onChangeText={onNameChange}
          autoCapitalize="words"
          autoFocus
        />
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
  form: {
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    fontSize: 40,
    fontWeight: "300",
  },
  avatarHint: {
    marginTop: -spacing.sm,
    fontSize: fontSize.sm,
  },
});
