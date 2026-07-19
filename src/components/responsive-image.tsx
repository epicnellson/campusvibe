import { useState, useCallback, memo } from "react";
import { useWindowDimensions } from "react-native";
import { Image } from "expo-image";

type Props = {
  source: string | number;
  style?: object;
  borderRadius?: number;
  contentFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  cachePolicy?: "none" | "memory-disk" | "disk" | "memory";
  transition?: number;
};

const MAX_HEIGHT_RATIO = 1.5;

export const ResponsiveImage = memo(function ResponsiveImage({
  source,
  style,
  borderRadius = 14,
  contentFit = "contain",
  cachePolicy = "memory-disk",
  transition = 300,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const handleLoad = useCallback((e: any) => {
    const w = e?.source?.width;
    const h = e?.source?.height;
    if (w && h && w > 0 && h > 0) {
      setNaturalSize({ width: w, height: h });
    }
  }, []);

  const containerWidth = screenWidth - 32;

  let imageStyle: object;
  if (naturalSize) {
    const ratio = naturalSize.width / naturalSize.height;
    const naturalHeight = containerWidth / ratio;
    const maxHeight = containerWidth * MAX_HEIGHT_RATIO;
    const finalHeight = Math.min(naturalHeight, maxHeight);
    imageStyle = {
      width: "100%" as const,
      height: finalHeight,
      borderRadius,
      backgroundColor: "#0A0A0C",
    };
  } else {
    imageStyle = {
      width: "100%" as const,
      aspectRatio: 4 / 3,
      borderRadius,
      backgroundColor: "#0A0A0C",
    };
  }

  return (
    <Image
      source={source}
      style={[imageStyle, style]}
      contentFit={naturalSize ? "contain" : "cover"}
      cachePolicy={cachePolicy}
      transition={transition}
      onLoad={handleLoad}
    />
  );
});
