import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

import DashboardScreen from '../screens/DashboardScreen';
import ScannerScreen from '../screens/ScannerScreen';
import GovernanceScreen from '../screens/GovernanceScreen';
import ApprovalsScreen from '../screens/ApprovalsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Scanner') {
            iconName = focused ? 'server' : 'server-outline';
          } else if (route.name === 'DAO') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'Inbox') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarLabel: ({ focused, color }) => (
          <View style={{ alignItems: 'center', marginBottom: 2 }}>
            <Text style={{ color, fontSize: 10, fontWeight: focused ? '700' : '500' }}>
              {route.name === 'Scanner' ? 'Request' : route.name === 'Inbox' ? 'Approvals' : route.name}
            </Text>
            {focused && (
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 4 }} />
            )}
          </View>
        ),
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 0.5,
          borderTopColor: colors.tabBarBorder,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 55 + Math.max(insets.bottom, 0),
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Scanner" component={ScannerScreen} />
      <Tab.Screen name="DAO" component={GovernanceScreen} />
      <Tab.Screen name="Inbox" component={ApprovalsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
