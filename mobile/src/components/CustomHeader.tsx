/**
 * CustomHeader.tsx
 *
 * Polished, theme-aware custom stack header for all pushed navigation screens.
 * Replaces bulky native OS navigation bars with a sleek, minimalist bar featuring
 * frosted glass styling, custom haptic back button, and clean typography.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';

export default function CustomHeader({ navigation, route, options, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const title = options.title || route.name;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12) + 4,
          backgroundColor: colors.headerBackground,
          borderBottomColor: colors.borderSubtle,
        },
      ]}
    >
      <View style={styles.content}>
        {back ? (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.goBack();
            }}
            style={[
              styles.backButton,
              {
                backgroundColor: colors.cardGlass,
                borderColor: colors.borderSubtle,
              },
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}

        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, { color: colors.headerText }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  spacer: {
    width: 38,
  },
});
