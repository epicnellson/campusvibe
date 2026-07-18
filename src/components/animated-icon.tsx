import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet } from 'react-native';

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
    }, 800);
    return () => clearTimeout(timer);
  }, [opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.background, { opacity }]}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  background: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#000000',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 180,
    height: 180,
  },
});
