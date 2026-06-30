import { getThemeColors, lightColors, colors } from '@/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === 'unspecified' ? 'light' : scheme;
  return getThemeColors(theme);
}

export function useIsDarkMode() {
  const scheme = useColorScheme();
  return scheme !== 'light';
}
