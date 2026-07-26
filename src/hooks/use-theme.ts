import { getThemeColors } from "@/theme";
import { useThemePreference } from "@/hooks/use-theme-context";

export function useTheme() {
  const { isDark } = useThemePreference();
  return getThemeColors(isDark ? "dark" : "light");
}

export function useIsDarkMode() {
  const { isDark } = useThemePreference();
  return isDark;
}
