import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: DURATION,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => setVisible(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [opacity]);

  if (!visible) return null;

  return <Animated.View style={[styles.backgroundSolidColor, { opacity }]} />;
}

const styles = StyleSheet.create({
  backgroundSolidColor: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#208AEF',
    zIndex: 1000,
  },
});