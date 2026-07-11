import { getThemeColors, lightColors, colors } from '@/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme ?? 'light';
  return getThemeColors(theme);
}

export function useIsDarkMode() {
  const scheme = useColorScheme();
  return scheme === 'dark';
}
