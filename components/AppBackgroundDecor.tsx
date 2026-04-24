import React from 'react';
import { StyleSheet, View } from 'react-native';

type AppPalette = {
  orbPrimary: string;
  orbSecondary: string;
  orbTertiary: string;
  dot: string;
};

type Props = {
  palette: AppPalette;
};

export default function AppBackgroundDecor({ palette }: Props) {
  return (
    <View pointerEvents="none" style={styles.appBackgroundPattern}>
      <View
        style={[
          styles.bgOrb,
          styles.bgOrbOne,
          { backgroundColor: palette.orbPrimary },
        ]}
      />
      <View
        style={[
          styles.bgOrb,
          styles.bgOrbTwo,
          { backgroundColor: palette.orbSecondary },
        ]}
      />
      <View
        style={[
          styles.bgOrb,
          styles.bgOrbThree,
          { backgroundColor: palette.orbTertiary },
        ]}
      />
      <View
        style={[
          styles.bgGridDot,
          styles.bgGridDotOne,
          { backgroundColor: palette.dot },
        ]}
      />
      <View
        style={[
          styles.bgGridDot,
          styles.bgGridDotTwo,
          { backgroundColor: palette.dot },
        ]}
      />
      <View
        style={[
          styles.bgGridDot,
          styles.bgGridDotThree,
          { backgroundColor: palette.dot },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appBackgroundPattern: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  bgOrb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  bgOrbOne: {
    width: 180,
    height: 180,
    top: -30,
    right: -40,
  },
  bgOrbTwo: {
    width: 140,
    height: 140,
    bottom: 80,
    left: -30,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  bgOrbThree: {
    width: 96,
    height: 96,
    top: '42%',
    right: 32,
    backgroundColor: 'rgba(168, 85, 247, 0.07)',
  },
  bgGridDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(79, 70, 229, 0.18)',
  },
  bgGridDotOne: {
    top: 120,
    left: 34,
  },
  bgGridDotTwo: {
    top: 154,
    left: 64,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bgGridDotThree: {
    bottom: 160,
    right: 48,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
