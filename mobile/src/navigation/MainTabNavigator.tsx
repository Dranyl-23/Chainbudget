import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';

import DashboardScreen from '../screens/DashboardScreen';
import ScannerScreen from '../screens/ScannerScreen';
import GovernanceScreen from '../screens/GovernanceScreen';
import ApprovalsScreen from '../screens/ApprovalsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

interface TabConfig {
  label: string;
  renderIcon: (focused: boolean, color: string, size: number) => React.ReactNode;
  isCTA?: boolean;
}

const TAB_CONFIGS: Record<string, TabConfig> = {
  Dashboard: {
    label: 'Home',
    renderIcon: (focused, color, size) => (
      <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
    ),
  },
  DAO: {
    label: 'DAO',
    renderIcon: (focused, color, size) => (
      <Ionicons name={focused ? 'library' : 'library-outline'} size={size} color={color} />
    ),
  },
  Scanner: {
    label: 'Scan',
    isCTA: true,
    renderIcon: (_focused, _color, size) => (
      <MaterialCommunityIcons name="line-scan" size={size + 2} color="#FFFFFF" />
    ),
  },
  Inbox: {
    label: 'Approvals',
    renderIcon: (focused, color, size) => (
      <MaterialCommunityIcons
        name={focused ? 'email' : 'email-outline'}
        size={size + 1}
        color={color}
      />
    ),
  },
  Profile: {
    label: 'Profile',
    renderIcon: (focused, color, size) => (
      <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
    ),
  },
};

function CircleCTAButton({
  onPress,
  isDark,
}: {
  onPress: () => void;
  isDark: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    triggerLightHaptic();
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.84,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3.5,
          tension: 130,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 110,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    onPress();
  };

  const tilt = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-14deg'],
  });

  return (
    <View style={styles.ctaWrapper}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: tilt }] }}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Quick Scan QR Action"
          style={[
            styles.ctaCircle,
            {
              backgroundColor: isDark ? '#7C3AED' : '#0F172A',
              borderColor: isDark ? '#1E1B4B' : '#FFFFFF',
            },
          ]}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function StandardTabButton({
  route,
  isFocused,
  onPress,
  onLongPress,
  activeColor,
  inactiveColor,
}: {
  route: any;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  activeColor: string;
  inactiveColor: string;
}) {
  const iconScaleAnim = useRef(new Animated.Value(isFocused ? 1.14 : 1)).current;
  const iconTranslateYAnim = useRef(new Animated.Value(isFocused ? -2 : 0)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.parallel([
        Animated.spring(iconScaleAnim, {
          toValue: 1.14,
          friction: 4.5,
          tension: 95,
          useNativeDriver: true,
        }),
        Animated.spring(iconTranslateYAnim, {
          toValue: -2.5,
          friction: 4.5,
          tension: 95,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(iconScaleAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(iconTranslateYAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isFocused]);

  const config = TAB_CONFIGS[route.name] || {
    label: route.name,
    renderIcon: (_f: boolean, c: string, s: number) => <Ionicons name="help" size={s} color={c} />,
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      style={styles.standardTabButton}
    >
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { scale: iconScaleAnim },
              { translateY: iconTranslateYAnim },
            ],
          },
        ]}
      >
        {config.renderIcon(isFocused, isFocused ? activeColor : inactiveColor, 22)}
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          {
            color: isFocused ? activeColor : inactiveColor,
            fontWeight: isFocused ? '700' : '500',
          },
        ]}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </TouchableOpacity>
  );
}

const INDICATOR_WIDTH = 28;

function SlidingNavbar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const activeColor = isDark ? colors.primary : '#0F172A';
  const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.45)' : '#94A3B8';

  // Calculate dynamic tab width
  const totalNavWidth = width - 16;
  const tabWidth = totalNavWidth / 5;

  const slideAnim = useRef(new Animated.Value(state.index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2)).current;
  const indicatorScaleX = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const targetX = state.index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2;

    // Fluid stretch and glide physics
    Animated.parallel([
      // Stretch slightly during slide, then spring settle
      Animated.sequence([
        Animated.timing(indicatorScaleX, {
          toValue: 1.45,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(indicatorScaleX, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]),
      // Spring glide to new tab position
      Animated.spring(slideAnim, {
        toValue: targetX,
        friction: 5.5,
        tension: 110,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state.index, tabWidth]);

  return (
    <View
      style={[
        styles.dockContainer,
        {
          backgroundColor: colors.tabBarBackground || (isDark ? colors.surface : '#FFFFFF'),
          borderTopColor: colors.tabBarBorder || (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0'),
          paddingBottom: Math.max(insets.bottom, 12),
          height: 68 + Math.max(insets.bottom, 0),
        },
      ]}
    >
      {/* Sliding Fluid Indicator Pill (Glides horizontally under the active tab) */}
      {state.index !== 2 && (
        <Animated.View
          style={[
            styles.slidingIndicator,
            {
              backgroundColor: activeColor,
              shadowColor: activeColor,
              transform: [
                { translateX: slideAnim },
                { scaleX: indicatorScaleX },
              ],
            },
          ]}
        />
      )}

      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const isCTA = TAB_CONFIGS[route.name]?.isCTA;

        const onPress = () => {
          triggerLightHaptic();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        if (isCTA) {
          return (
            <CircleCTAButton
              key={route.key}
              onPress={onPress}
              isDark={isDark}
            />
          );
        }

        return (
          <StandardTabButton
            key={route.key}
            route={route}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
          />
        );
      })}
    </View>
  );
}

export default function MainTabNavigator() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <SlidingNavbar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="DAO" component={GovernanceScreen} />
      <Tab.Screen name="Scanner" component={ScannerScreen} />
      <Tab.Screen name="Inbox" component={ApprovalsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 8,
    position: 'relative',
  },
  slidingIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: INDICATOR_WIDTH,
    height: 3.5,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 10,
  },
  standardTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 3,
    letterSpacing: -0.2,
  },
  ctaWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    zIndex: 30,
  },
  ctaCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
  },
});
