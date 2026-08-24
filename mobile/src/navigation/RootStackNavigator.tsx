import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import CustomHeader from '../components/CustomHeader';

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
import HelpFaqScreen from '../screens/HelpFaqScreen';
import DataPrivacyScreen from '../screens/DataPrivacyScreen';
import NotificationDetailScreen from '../screens/NotificationDetailScreen';
import PublicOrgDetailScreen from '../screens/PublicOrgDetailScreen';
import PublicLedgerScreen from '../screens/PublicLedgerScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import AboutScreen from '../screens/AboutScreen';
import NetworkStatusScreen from '../screens/NetworkStatusScreen';
import SecurityKeysScreen from '../screens/SecurityKeysScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreateOrganizationScreen from '../screens/CreateOrganizationScreen';
import OrgChatScreen from '../screens/OrgChatScreen';
import OrgChatInfoScreen from '../screens/OrgChatInfoScreen';

const Stack = createNativeStackNavigator();

export default function RootStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        header: (props) => <CustomHeader {...props} />,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
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
        options={{ title: 'Transaction Details' }}
      />
      <Stack.Screen
        name="Transfer"
        component={TransferScreen}
        options={{ title: 'Fund Request' }}
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
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{ title: 'Notification Details' }}
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
      <Stack.Screen
        name="HelpFaq"
        component={HelpFaqScreen}
        options={{ title: 'Help & FAQs' }}
      />
      <Stack.Screen
        name="DataPrivacy"
        component={DataPrivacyScreen}
        options={{ title: 'Data Privacy & Security' }}
      />
      <Stack.Screen
        name="PublicLedger"
        component={PublicLedgerScreen}
        options={{ title: 'Public Ledger' }}
      />
      <Stack.Screen
        name="PublicOrgDetail"
        component={PublicOrgDetailScreen}
        options={{ title: 'Organization Ledger' }}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ title: 'Feedback & Reports' }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: 'About ChainBudget' }}
      />
      <Stack.Screen
        name="NetworkStatus"
        component={NetworkStatusScreen}
        options={{ title: 'Network & Protocol' }}
      />
      <Stack.Screen
        name="SecurityKeys"
        component={SecurityKeysScreen}
        options={{ title: 'Web3 Security & Keys' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings & Security' }}
      />
      <Stack.Screen
        name="CreateOrganization"
        component={CreateOrganizationScreen}
        options={{ title: 'Create Organization' }}
      />
      <Stack.Screen
        name="OrgChat"
        component={OrgChatScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OrgChatInfo"
        component={OrgChatInfoScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}


