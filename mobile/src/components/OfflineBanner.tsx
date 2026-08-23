/**
 * OfflineBanner.tsx
 *
 * Global network connectivity banner that notifies users when working offline
 * and automatically dismisses when connectivity is restored.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;
  const wasOffline = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const offline = state.isConnected === false || state.isInternetReachable === false;

        if (!isMounted) return;

        if (offline) {
          setIsOffline(true);
          wasOffline.current = true;
          setShowReconnected(false);
          Animated.spring(animValue, {
            toValue: 1,
            useNativeDriver: false,
            tension: 80,
            friction: 10,
          }).start();
        } else {
          setIsOffline(false);
          if (wasOffline.current) {
            wasOffline.current = false;
            setShowReconnected(true);
            // Keep green "Back Online" banner for 2.5 seconds, then hide
            setTimeout(() => {
              if (isMounted) {
                Animated.timing(animValue, {
                  toValue: 0,
                  duration: 350,
                  useNativeDriver: false,
                }).start(() => {
                  if (isMounted) setShowReconnected(false);
                });
              }
            }, 2500);
          } else {
            animValue.setValue(0);
          }
        }
      } catch {}
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  const height = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 36],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const isGreen = showReconnected && !isOffline;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top,
          height,
          opacity,
          backgroundColor: isGreen ? '#059669' : '#DC2626',
        },
      ]}
    >
      <Ionicons
        name={isGreen ? 'cloud-done-outline' : 'cloud-offline-outline'}
        size={14}
        color="#FFFFFF"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.text}>
        {isGreen ? 'Back Online • Connected to Network' : 'Offline Mode • Showing Cached Data'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
