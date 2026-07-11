import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

let scheduleOnRN: ((fn: (v: boolean) => void, v: boolean) => void) | undefined;
try {
  const worklets = require('react-native-worklets');
  scheduleOnRN = worklets.scheduleOnRN;
} catch {
  // react-native-worklets not available
}

function createSplashKeyframe(scale: number) {
  return new Keyframe({
    0: {
      transform: [{ scale }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });
}

const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  const splashKeyframe = useMemo(() => {
    const scale = Dimensions.get('screen').height / 90 || 8;
    return createSplashKeyframe(scale);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished && scheduleOnRN) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.backgroundSolidColor}
    />
  );
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  backgroundSolidColor: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#208AEF',
    zIndex: 1000,
  },
});