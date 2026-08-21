/**
 * SuccessCelebrationModal.tsx
 *
 * Micro-interaction celebration overlay for successful approval, voting, or fund requests.
 * Uses spring physics, pulse ring, and scale animation with celebration haptics.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { triggerSuccessHaptic } from '../lib/biometrics';

type SuccessCelebrationModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  autoDismissMs?: number;
};

export default function SuccessCelebrationModal({
  visible,
  title,
  subtitle,
  onDismiss,
  autoDismissMs = 2000,
}: SuccessCelebrationModalProps) {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      triggerSuccessHaptic();

      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous subtle pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.15,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          scale.setValue(0);
          onDismiss();
        });
      }, autoDismissMs);

      return () => clearTimeout(timer);
    } else {
      scale.setValue(0);
      opacity.setValue(0);
    }
  }, [visible, autoDismissMs, onDismiss]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.modalBackdrop }]}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity,
              transform: [{ scale }],
              backgroundColor: isDark ? 'rgba(20, 20, 28, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: colors.border,
            },
          ]}
        >
          {/* Animated Pulse Ring */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseScale }],
                  backgroundColor: colors.successBg,
                  borderColor: colors.successBorder,
                },
              ]}
            />
            <View style={[styles.iconCircle, { backgroundColor: colors.success }]}>
              <Ionicons name="checkmark-sharp" size={36} color="#ffffff" />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
