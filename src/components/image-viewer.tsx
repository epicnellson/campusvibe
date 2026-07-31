import { useCallback, useRef } from "react";
import {
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Share,
  StyleSheet,
  View,
  Animated,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

type ImageViewerProps = {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function ImageViewer({ visible, imageUrl, onClose }: ImageViewerProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const s = useRef({
    scale: 1,
    lastScale: 1,
    lastDist: 0,
    accX: 0,
    accY: 0,
    lastX: 0,
    lastY: 0,
  });

  const lastTap = useRef(0);

  const resetZoom = useCallback(() => {
    s.current.scale = 1;
    s.current.lastScale = 1;
    s.current.accX = 0;
    s.current.accY = 0;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: Platform.OS !== "web" }),
    ]).start();
  }, [scale, translateX, translateY]);

  const zoomTo = useCallback(
    (target: number) => {
      s.current.scale = target;
      s.current.lastScale = target;
      Animated.spring(scale, { toValue: target, useNativeDriver: Platform.OS !== "web" }).start();
    },
    [scale]
  );

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (s.current.scale > 1.5) {
        resetZoom();
      } else {
        zoomTo(2.5);
      }
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, [resetZoom, zoomTo]);

  const handleShare = useCallback(() => {
    if (imageUrl) {
      Share.share({ url: imageUrl }).catch(() => {});
    }
  }, [imageUrl]);

  const pr = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.numberActiveTouches === 2 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        s.current.lastDist = 0;
        s.current.lastX = s.current.accX;
        s.current.lastY = s.current.accY;
      },
      onPanResponderMove: (evt, gs) => {
        if (evt.nativeEvent.touches.length >= 2) {
          const t1 = evt.nativeEvent.touches[0];
          const t2 = evt.nativeEvent.touches[1];
          const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
          if (s.current.lastDist === 0) {
            s.current.lastDist = dist;
          } else {
            const newScale = Math.max(
              1,
              Math.min(5, s.current.lastScale * (dist / s.current.lastDist))
            );
            scale.setValue(newScale);
            s.current.scale = newScale;
          }
        } else if (gs.numberActiveTouches === 1) {
          if (s.current.scale > 1) {
            const nx = s.current.lastX + gs.dx / s.current.scale;
            const ny = s.current.lastY + gs.dy / s.current.scale;
            translateX.setValue(nx);
            translateY.setValue(ny);
            s.current.accX = nx;
            s.current.accY = ny;
          } else if (gs.dy > 0) {
            translateY.setValue(gs.dy * 0.4);
          }
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 && s.current.scale <= 1) {
          onClose();
          return;
        }
        s.current.lastDist = 0;
        if (s.current.scale < 1.2) {
          resetZoom();
        } else {
          s.current.lastScale = s.current.scale;
        }
        if (s.current.scale <= 1) {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: Platform.OS !== "web",
          }).start();
        }
      },
    })
  ).current;

  if (!imageUrl) return null;

  const isWeb = Platform.OS === "web";

  const imageContent = isWeb ? (
    <View style={styles.imageWrap}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        contentFit="contain"
      />
    </View>
  ) : (
    <Animated.View
      style={[
        styles.imageWrap,
        {
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
      {...pr.panHandlers}
    >
      <Pressable
        onPress={handleDoubleTap}
        style={styles.imagePressable}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="contain"
          transition={300}
        />
      </Pressable>
    </Animated.View>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {imageContent}

        <Pressable
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close image viewer"
        >
          <View style={styles.iconBg}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </View>
        </Pressable>

        <Pressable
          onPress={handleShare}
          style={styles.shareBtn}
          accessibilityRole="button"
          accessibilityLabel="Share image"
        >
          <View style={styles.iconBg}>
            <Ionicons name="share-outline" size={24} color="#FFFFFF" />
          </View>
        </Pressable>

        <View style={styles.infoBar}>
          <View style={styles.infoBg}>
            <Ionicons name="image-outline" size={14} color="rgba(255,255,255,0.6)" />
            <View style={styles.infoDot} />
            <View style={{ flex: 1 }}>
              <View style={styles.infoLine} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePressable: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    zIndex: 10,
  },
  shareBtn: {
    position: "absolute",
    top: 50,
    right: 64,
    zIndex: 10,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  infoBar: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  infoBg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  infoDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  infoLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 60,
  },
});
