import React from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppBackgroundDecor from './AppBackgroundDecor';

const appText = require('../content/appText.json');

type AppPalette = {
  gradient: string[];
  textPrimary: string;
  textSecondary: string;
  splashShell: string;
  splashShellBorder: string;
  orbPrimary: string;
  orbSecondary: string;
  orbTertiary: string;
  dot: string;
};

type Props = {
  palette: AppPalette;
};

export default function SplashScreen({ palette }: Props) {
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const floatAnim = React.useRef(new Animated.Value(0)).current;
  const orbitAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [floatAnim, opacityAnim, orbitAnim, scaleAnim]);

  const floatTranslate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const orbitRotate = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={palette.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.splashContainer}
    >
      <AppBackgroundDecor palette={palette} />
      <Animated.View
        style={[
          styles.splashOrbit,
          {
            transform: [{ rotate: orbitRotate }],
          },
        ]}
      >
        <View style={[styles.splashOrbitDot, styles.splashOrbitDotPrimary]} />
        <View style={[styles.splashOrbitDot, styles.splashOrbitDotSecondary]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.splashContent,
          {
            transform: [{ scale: scaleAnim }, { translateY: floatTranslate }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View
          style={[
            styles.splashIconShell,
            {
              backgroundColor: palette.splashShell,
              borderColor: palette.splashShellBorder,
            },
          ]}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.splashIconGradient}
          >
            <Text style={styles.splashIcon}>✓</Text>
          </LinearGradient>
        </View>
        <Text style={[styles.splashTitle, { color: palette.textPrimary }]}>
          {appText.splash.title}
        </Text>
        <Text style={[styles.splashSubtitle, { color: palette.textSecondary }]}>
          {appText.splash.subtitle}
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  splashOrbit: {
    position: 'absolute',
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashOrbitDot: {
    position: 'absolute',
    borderRadius: 999,
  },
  splashOrbitDotPrimary: {
    top: 18,
    width: 14,
    height: 14,
    backgroundColor: '#7C3AED',
  },
  splashOrbitDotSecondary: {
    bottom: 28,
    right: 30,
    width: 10,
    height: 10,
    backgroundColor: '#F59E0B',
  },
  splashContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  splashIconShell: {
    width: 118,
    height: 118,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 10,
    marginBottom: 24,
  },
  splashIconGradient: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashIcon: {
    fontSize: 46,
    color: '#FFFFFF',
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E1B4B',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  splashSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
});
