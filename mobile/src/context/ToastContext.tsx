/**
 * ToastContext.tsx
 *
 * Global animated Toast notification system for ChainBudget Mobile.
 * Replaces disruptive Alert.alert popups with sleek, floating status toasts.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';
import { triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastOptions = {
  message: string;
  type?: ToastType;
  duration?: number;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start((result) => {
      if (result.finished) {
        requestAnimationFrame(() => {
          setToast(null);
        });
      }
    });
  }, [translateY, opacity]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      clearTimeout(timerRef.current);
      setToast({ message, type });

      // Trigger corresponding haptic
      if (type === 'success') triggerSuccessHaptic();
      else if (type === 'error') triggerErrorHaptic();
      else triggerLightHaptic();

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: insets.top > 0 ? insets.top + 8 : 24,
          useNativeDriver: true,
          damping: 15,
          stiffness: 150,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [insets.top, translateY, opacity, hideToast]
  );

  const getToastColors = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          bg: colors.successBg,
          border: colors.successBorder,
          text: colors.success,
          icon: 'checkmark-circle' as const,
        };
      case 'error':
        return {
          bg: colors.errorBg,
          border: colors.errorBorder,
          text: colors.error,
          icon: 'alert-circle' as const,
        };
      case 'warning':
        return {
          bg: colors.warningBg,
          border: colors.warningBorder,
          text: colors.warning,
          icon: 'warning' as const,
        };
      default:
        return {
          bg: colors.infoBg,
          border: colors.infoBorder,
          text: colors.accentBlue,
          icon: 'information-circle' as const,
        };
    }
  };

  const styleConfig = toast ? getToastColors(toast.type) : null;

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && styleConfig && (
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
              opacity,
              backgroundColor: isDark ? 'rgba(18, 18, 24, 0.95)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: styleConfig.border,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={hideToast}
            style={styles.content}
          >
            <View style={[styles.iconWrap, { backgroundColor: styleConfig.bg }]}>
              <Ionicons name={styleConfig.icon} size={20} color={styleConfig.text} />
            </View>
            <Text
              style={[styles.message, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {toast.message}
            </Text>
            <TouchableOpacity onPress={hideToast} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginRight: 8,
  },
});
