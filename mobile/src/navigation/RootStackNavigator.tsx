import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';

import MainTabNavigator from './MainTabNavigator';
import HistoryScreen from '../screens/HistoryScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import TransferScreen from '../screens/TransferScreen';
import MembersScreen from '../screens/MembersScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import RecoveryPhraseScreen from '../screens/RecoveryPhraseScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import BudgetScreen from '../screens/BudgetScreen';
import AuditScreen from '../screens/AuditScreen';
import ReportsScreen from '../screens/ReportsScreen';
import TreasuryScreen from '../screens/TreasuryScreen';

const Stack = createNativeStackNavigator();

export default function RootStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: '700',
        },
        contentStyle: { backgroundColor: colors.background },
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
        name="Receive"
        component={ReceiveScreen}
        options={{ title: 'Receive Funds / QR' }}
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
      <Stack.Screen
        name="Budget"
        component={BudgetScreen}
        options={{ title: 'Budget Management' }}
      />
      <Stack.Screen
        name="Audit"
        component={AuditScreen}
        options={{ title: 'Audit Trail' }}
      />
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reports & Analytics' }}
      />
      <Stack.Screen
        name="Treasury"
        component={TreasuryScreen}
        options={{ title: 'Treasury Settings' }}
      />
    </Stack.Navigator>
  );
}
