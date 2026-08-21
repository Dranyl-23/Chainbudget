/**
 * ScaleButton.tsx
 *
 * Micro-interaction wrapper providing smooth spring-scale feedback on press
 * (scale to 0.96 on press in, spring back on release) with light haptic feedback.
 */

import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { triggerLightHaptic } from '../lib/biometrics';

type ScaleButtonProps = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  enableHaptic?: boolean;
};

export default function ScaleButton({
  children,
  style,
  containerStyle,
  scaleTo = 0.96,
  enableHaptic = true,
  onPressIn,
  onPressOut,
  ...rest
}: ScaleButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    if (enableHaptic) triggerLightHaptic();
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
    onPressOut?.(e);
  };

  const flattenedStyle: Record<string, any> = (StyleSheet.flatten(style) as any) || {};
  const autoContainerStyle: ViewStyle = {};

  if (flattenedStyle.flex !== undefined) autoContainerStyle.flex = flattenedStyle.flex;
  if (flattenedStyle.flexGrow !== undefined) autoContainerStyle.flexGrow = flattenedStyle.flexGrow;
  if (flattenedStyle.flexShrink !== undefined) autoContainerStyle.flexShrink = flattenedStyle.flexShrink;
  if (flattenedStyle.flexBasis !== undefined) autoContainerStyle.flexBasis = flattenedStyle.flexBasis;
  if (flattenedStyle.width !== undefined) autoContainerStyle.width = flattenedStyle.width;
  if (flattenedStyle.margin !== undefined) autoContainerStyle.margin = flattenedStyle.margin;
  if (flattenedStyle.marginBottom !== undefined) autoContainerStyle.marginBottom = flattenedStyle.marginBottom;
  if (flattenedStyle.marginHorizontal !== undefined) autoContainerStyle.marginHorizontal = flattenedStyle.marginHorizontal;
  if (flattenedStyle.position !== undefined) autoContainerStyle.position = flattenedStyle.position;
  if (flattenedStyle.top !== undefined) autoContainerStyle.top = flattenedStyle.top;
  if (flattenedStyle.bottom !== undefined) autoContainerStyle.bottom = flattenedStyle.bottom;
  if (flattenedStyle.left !== undefined) autoContainerStyle.left = flattenedStyle.left;
  if (flattenedStyle.right !== undefined) autoContainerStyle.right = flattenedStyle.right;
  if (flattenedStyle.zIndex !== undefined) autoContainerStyle.zIndex = flattenedStyle.zIndex;


  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[autoContainerStyle, containerStyle]}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

