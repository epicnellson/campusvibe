import { forwardRef, useState, type ForwardedRef } from "react";
import {
  TextInput,
  StyleSheet,
  type TextInputProps,
  View,
  Text,
  Animated,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { spacing, borderRadius, fontSize, fontWeight } from "@/theme";

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(
  function Input(
    { label, error, leftIcon, rightIcon, style, onFocus, onBlur, ...rest },
    ref: ForwardedRef<TextInput>
  ) {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);
    const borderAnim = useState(new Animated.Value(0))[0];

    const handleFocus = (e: any) => {
      setFocused(true);
      Animated.timing(borderAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setFocused(false);
      Animated.timing(borderAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      onBlur?.(e);
    };

    const borderColor = error
      ? theme.error
      : focused
      ? theme.primary
      : theme.background === '#000000' ? '#1E1E1E' : theme.border;

    return (
      <View style={styles.wrapper}>
        {label && (
          <Text
            style={[
              styles.label,
              { color: error ? theme.error : theme.textSecondary },
            ]}
          >
            {label}
          </Text>
        )}
        <View
          style={[
            styles.container,
            { backgroundColor: theme.background === '#000000' ? '#121212' : theme.backgroundElement, borderColor },
            leftIcon ? styles.withLeftIcon : undefined,
          ]}
        >
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              { color: theme.background === '#000000' ? '#FFFFFF' : theme.text },
              leftIcon ? styles.inputWithLeftIcon : undefined,
              rightIcon ? styles.inputWithRightIcon : undefined,
              style,
            ]}
            placeholderTextColor={theme.background === '#000000' ? '#71717A' : theme.textTertiary}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...rest}
          />
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
        {error && (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  withLeftIcon: {},
  input: {
    flex: 1,
    fontSize: fontSize.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.xs,
  },
  inputWithRightIcon: {
    paddingRight: spacing.xs,
  },
  iconLeft: {
    paddingLeft: spacing.md,
  },
  iconRight: {
    paddingRight: spacing.md,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    marginLeft: spacing.xs,
  },
});
