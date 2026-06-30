export const colors = {
  primary: "#6C47FF",
  primaryLight: "#8B6EFF",
  primaryDark: "#5335CC",
  secondary: "#1DB954",
  secondaryLight: "#2ECC71",
  background: "#0A0A0A",
  backgroundSecondary: "#141414",
  backgroundElement: "#1E1E1E",
  backgroundSelected: "#2A2A2A",
  surface: "#FFFFFF",
  surfaceSecondary: "#F5F5F5",
  surfaceElement: "#E8E8E8",
  text: "#FFFFFF",
  textSecondary: "#9E9E9E",
  textTertiary: "#666666",
  textInverse: "#0A0A0A",
  border: "#2A2A2A",
  borderLight: "#3A3A3A",
  error: "#FF3B30",
  errorLight: "#FF6B5E",
  warning: "#FF9500",
  warningLight: "#FFB84D",
  success: "#34C759",
  successLight: "#5EDB7C",
  info: "#5AC8FA",
  overlay: "rgba(0, 0, 0, 0.6)",
  transparent: "transparent",
} as const;

export const lightColors = {
  primary: "#6C47FF",
  primaryLight: "#8B6EFF",
  primaryDark: "#5335CC",
  secondary: "#1DB954",
  secondaryLight: "#2ECC71",
  background: "#FFFFFF",
  backgroundSecondary: "#F5F5F5",
  backgroundElement: "#E8E8E8",
  backgroundSelected: "#D4D4D4",
  surface: "#0A0A0A",
  surfaceSecondary: "#141414",
  surfaceElement: "#1E1E1E",
  text: "#0A0A0A",
  textSecondary: "#666666",
  textTertiary: "#9E9E9E",
  textInverse: "#FFFFFF",
  border: "#E0E0E0",
  borderLight: "#D0D0D0",
  error: "#FF3B30",
  errorLight: "#FF6B5E",
  warning: "#FF9500",
  warningLight: "#FFB84D",
  success: "#34C759",
  successLight: "#5EDB7C",
  info: "#5AC8FA",
  overlay: "rgba(0, 0, 0, 0.3)",
  transparent: "transparent",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
} as const;

export const fontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export const shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
} as const;

export type Colors = typeof colors;
export type ThemeColorScheme = "light" | "dark";

export function getThemeColors(scheme: ThemeColorScheme) {
  return scheme === "dark" ? colors : lightColors;
}
