/**
 * OfflineBanner.tsx
 *
 * Real-time network status monitor and offline banner.
 * Displays a subtle warning banner when the device loses network connectivity,
 * informing the user that cached data is being displayed.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkNetwork() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (isMounted) {
          const offline = !state.isConnected || state.isInternetReachable === false;
          setIsOffline(offline);
        }
      } catch {
        // Fallback
      }
    }

    checkNetwork();
    const interval = setInterval(checkNetwork, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 8) + 4,
          backgroundColor: colors.warningBg || '#FEF3C7',
          borderBottomColor: colors.warningBorder || '#FCD34D',
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={16} color={colors.warning || '#D97706'} style={{ marginRight: 6 }} />
        <Text style={[styles.text, { color: colors.warning || '#D97706' }]}>
          You are offline. Showing cached data.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 999,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
