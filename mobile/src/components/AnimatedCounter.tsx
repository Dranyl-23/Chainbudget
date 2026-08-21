/**
 * AnimatedCounter.tsx
 *
 * Micro-interaction component for smoothly rolling and animating numeric balances.
 * Animates numbers from previous to target values using 60fps easing.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';

type AnimatedCounterProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
};

export default function AnimatedCounter({
  value,
  prefix = '₱',
  suffix = '',
  duration = 800,
  style,
  ...textProps
}: AnimatedCounterProps & TextProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animFrameRef = useRef<any>(null);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    const startTime = Date.now();

    const updateCounter = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeOut);
      
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(endValue);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateCounter);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value, duration]);

  return (
    <Text style={style} {...textProps}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </Text>
  );
}
