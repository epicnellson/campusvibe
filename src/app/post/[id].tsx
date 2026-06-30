import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";

export default function PostDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (id) {
        router.replace(`/(tabs)?postId=${id}`);
      } else {
        router.replace("/(tabs)");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [id]);

  return (
    <ThemedView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ThemedText>Opening post...</ThemedText>
    </ThemedView>
  );
}
