/**
 * AnimatedToggleSwitch.tsx
 *
 * High-end iOS/Material physics-driven animated toggle switch.
 * Features fluid spring momentum sliding thumb, smooth background track color interpolation,
 * and tactile haptic feedback on toggle change.
 */

import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, View } from 'react-native';
import { triggerLightHaptic } from '../lib/biometrics';

interface AnimatedToggleSwitchProps {
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  disabled?: boolean;
}

export default function AnimatedToggleSwitch({
  value,
  onValueChange,
  activeColor = '#10B981',
  inactiveColor = '#334155',
  thumbColor = '#FFFFFF',
  disabled = false,
}: AnimatedToggleSwitchProps) {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animatedValue, {
        toValue: value ? 1 : 0,
        friction: 6,
        tension: 100,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(thumbScale, {
          toValue: 1.15,
          duration: 90,
          useNativeDriver: false,
        }),
        Animated.spring(thumbScale, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [value]);

  const handlePress = () => {
    if (disabled) return;
    triggerLightHaptic();
    onValueChange(!value);
  };

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: thumbColor,
              transform: [{ translateX }, { scale: thumbScale }],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
