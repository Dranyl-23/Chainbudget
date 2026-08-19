/**
 * SkeletonLoader.tsx
 *
 * Animated shimmer placeholder components for loading states across ChainBudget Mobile.
 * Uses Animated pulse for fluid, high-frame-rate rendering with full theme support.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function SkeletonBox({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: colors.skeletonFrom,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton placeholder for the Dashboard Treasury/Personal balance card
 */
export function SkeletonBalanceCard() {
  const { colors } = useTheme();

  return (
    <View 
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      className="p-6 rounded-3xl mb-6 border shadow-sm"
    >
      <View className="flex-row justify-between items-center mb-6">
        <SkeletonBox width={120} height={32} borderRadius={10} />
        <SkeletonBox width={32} height={32} borderRadius={8} />
      </View>
      <SkeletonBox width={100} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
      <SkeletonBox width={180} height={42} borderRadius={8} style={{ marginBottom: 16 }} />
      <SkeletonBox width={90} height={24} borderRadius={12} style={{ marginBottom: 16 }} />
      <View 
        style={{ borderTopColor: colors.borderSubtle }}
        className="flex-row justify-between border-t pt-4 mt-2"
      >
        <SkeletonBox width="45%" height={30} borderRadius={8} />
        <SkeletonBox width="45%" height={30} borderRadius={8} />
      </View>
    </View>
  );
}

/**
 * Skeleton placeholder for budget progress bars
 */
export function SkeletonBudgetList() {
  const { colors } = useTheme();

  return (
    <View className="space-y-3 mb-6">
      {[1, 2].map((key) => (
        <View 
          key={key}
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="p-4 rounded-2xl border mb-3 shadow-sm"
        >
          <View className="flex-row justify-between items-center mb-3">
            <SkeletonBox width={100} height={16} borderRadius={4} />
            <SkeletonBox width={70} height={16} borderRadius={4} />
          </View>
          <SkeletonBox width="100%" height={8} borderRadius={4} style={{ marginBottom: 8 }} />
          <View className="flex-row justify-between">
            <SkeletonBox width={80} height={12} borderRadius={4} />
            <SkeletonBox width={50} height={12} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton placeholder for transaction and approval list items
 */
export function SkeletonTransactionList({ count = 3 }: { count?: number }) {
  const { colors } = useTheme();

  return (
    <View>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          className="flex-row items-center p-4 rounded-2xl border mb-3 shadow-sm"
        >
          <SkeletonBox width={44} height={44} borderRadius={22} style={{ marginRight: 14 }} />
          <View className="flex-1 mr-4">
            <SkeletonBox width="70%" height={16} borderRadius={4} style={{ marginBottom: 6 }} />
            <SkeletonBox width="40%" height={12} borderRadius={4} />
          </View>
          <SkeletonBox width={60} height={18} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}
