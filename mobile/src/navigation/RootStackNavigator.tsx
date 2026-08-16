import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabNavigator from './MainTabNavigator';
import HistoryScreen from '../screens/HistoryScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import TransferScreen from '../screens/TransferScreen';
import MembersScreen from '../screens/MembersScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import RecoveryPhraseScreen from '../screens/RecoveryPhraseScreen';

const Stack = createNativeStackNavigator();

export default function RootStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#09090b',
        },
        headerTintColor: '#fff',
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: '#09090b' },
      }}
    >
      {/* The main tab interface is the root screen */}
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />

      {/* Stack screens that cover the full screen (pushed on top of tabs) */}
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Transaction History' }}
      />
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: 'Receipt Details' }}
      />
      <Stack.Screen
        name="Transfer"
        component={TransferScreen}
        options={{ title: 'Send / Transfer' }}
      />
      <Stack.Screen
        name="Members"
        component={MembersScreen}
        options={{ title: 'DAO Members' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="RecoveryPhrase"
        component={RecoveryPhraseScreen}
        options={{ title: 'Recovery Phrase' }}
      />
    </Stack.Navigator>
  );
}
