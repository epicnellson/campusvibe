import { StyleSheet, Text, type TextProps } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { fontSize, fontWeight } from '@/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: keyof ReturnType<typeof useTheme>;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  smallBold: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.bold,
  },
  default: {
    fontSize: fontSize.md,
    lineHeight: 22,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: 28,
  },
  link: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  linkPrimary: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: '#6C47FF',
  },
  code: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
