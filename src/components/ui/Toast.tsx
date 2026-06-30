import {
  useEffect,
  useRef,
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from "@/theme";

type ToastType = "success" | "error" | "warning";

type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type ToastContextType = {
  show: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastContextType>({
  show: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const typeColors: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: colors.success, icon: "✓" },
  error: { bg: colors.error, icon: "✕" },
  warning: { bg: colors.warning, icon: "!" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, type: ToastType = "success", duration = 3000) => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    []
  );

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View
        style={[
          styles.container,
          { bottom: insets.bottom + spacing.md },
        ]}
        pointerEvents="box-none"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDone={() => remove(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const tc = typeColors[toast.type];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(() => onDone());
    }, toast.duration ?? 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: tc.bg, transform: [{ translateY }], opacity },
      ]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{tc.icon}</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {toast.message}
      </Text>
      <TouchableOpacity onPress={onDone} style={styles.dismiss}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.large,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  message: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  dismiss: {
    padding: spacing.xs,
  },
  dismissText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
});
