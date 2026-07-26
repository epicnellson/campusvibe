import { useState, useCallback, memo } from "react";
import { useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  source: string | number;
  style?: object;
  borderRadius?: number;
  contentFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  cachePolicy?: "none" | "memory-disk" | "disk" | "memory";
  transition?: number;
  aspectRatio?: number;
  recyclingKey?: string;
};

const MAX_HEIGHT_RATIO = 1.5;
const DEFAULT_ASPECT_RATIO = 4 / 3;

export const ResponsiveImage = memo(function ResponsiveImage({
  source,
  style,
  borderRadius = 14,
  contentFit = "contain",
  cachePolicy = "memory-disk",
  transition = 300,
  aspectRatio: forcedAspectRatio,
  recyclingKey,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const colors = useTheme();

  const handleLoad = useCallback((e: any) => {
    const w = e?.source?.width;
    const h = e?.source?.height;
    if (w && h && w > 0 && h > 0) {
      setNaturalSize({ width: w, height: h });
    }
  }, []);

  const containerWidth = screenWidth - 32;

  const resolvedAspectRatio = forcedAspectRatio ?? (
    naturalSize
      ? Math.min(naturalSize.width / naturalSize.height, MAX_HEIGHT_RATIO)
      : DEFAULT_ASPECT_RATIO
  );

  const imageStyle: object = {
    width: "100%" as const,
    aspectRatio: resolvedAspectRatio,
    borderRadius,
    backgroundColor: "#0A0A0C",
  };

  return (
    <Image
      source={source}
      style={[imageStyle, style]}
      contentFit={naturalSize ? contentFit : "cover"}
      cachePolicy={cachePolicy}
      transition={transition}
      onLoad={handleLoad}
      recyclingKey={recyclingKey}
      placeholder="#0A0A0C"
      priority="normal"
    />
  );
});
