/**
 * AnimatedToggleSwitch.tsx
 *
 * High-end iOS/Material physics-driven animated toggle switch.
 * Features fluid spring momentum sliding thumb, smooth background track color interpolation,
 * and tactile haptic feedback on toggle change.
 */

import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, Easing } from 'react-native';
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

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value ? 1 : 0,
      damping: 16,
      stiffness: 200,
      mass: 0.7,
      overshootClamping: false,
      useNativeDriver: false,
    }).start();
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
              transform: [{ translateX }],
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
