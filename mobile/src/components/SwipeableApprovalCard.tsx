/**
 * SwipeableApprovalCard.tsx
 *
 * Micro-interaction wrapper providing horizontal swipe gestures for transaction cards.
 * Swipe Right → Trigger Approve confirmation
 * Swipe Left → Trigger Reject confirmation
 */

import React, { useRef } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';

type SwipeableApprovalCardProps = {
  children: React.ReactNode;
  onSwipeApprove: () => void;
  onSwipeReject: () => void;
  disabled?: boolean;
};

const SWIPE_THRESHOLD = 90;

function SwipeableApprovalCard({
  children,
  onSwipeApprove,
  onSwipeReject,
  disabled = false,
}: SwipeableApprovalCardProps) {
  const { colors } = useTheme();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (disabled) return false;
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 15;
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: 0 });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          triggerLightHaptic();
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
          onSwipeApprove();
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          triggerLightHaptic();
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
          onSwipeReject();
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const approveOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const rejectOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Background Left / Right Action Indicators */}
      <Animated.View
        style={[
          styles.actionBackground,
          styles.leftAction,
          {
            backgroundColor: colors.successBg,
            borderColor: colors.successBorder,
            opacity: approveOpacity,
          },
        ]}
      >
        <View style={styles.iconRow}>
          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
          <Text style={[styles.actionText, { color: colors.success }]}>Approve</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.actionBackground,
          styles.rightAction,
          {
            backgroundColor: colors.errorBg,
            borderColor: colors.errorBorder,
            opacity: rejectOpacity,
          },
        ]}
      >
        <View style={styles.iconRow}>
          <Text style={[styles.actionText, { color: colors.error }]}>Reject</Text>
          <Ionicons name="close-circle" size={26} color={colors.error} />
        </View>
      </Animated.View>

      {/* Foreground Swipeable Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX: pan.x }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default React.memo(SwipeableApprovalCard);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 4,
  },
  actionBackground: {
    position: 'absolute',
    top: 0,
    bottom: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  leftAction: {
    left: 0,
    right: '50%',
    paddingLeft: 20,
    alignItems: 'flex-start',
  },
  rightAction: {
    left: '50%',
    right: 0,
    paddingRight: 20,
    alignItems: 'flex-end',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});

