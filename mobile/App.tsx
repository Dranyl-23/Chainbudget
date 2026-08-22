import React, { useEffect, useRef, useState } from 'react';
import 'react-native-get-random-values';
import { NavigationContainer, NavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OrgProvider } from './src/context/OrgContext';
import { SocketProvider } from './src/context/SocketContext';
import { setupAndroidNotificationChannel } from './src/lib/notifications';

import { ToastProvider } from './src/context/ToastContext';
import OfflineBanner from './src/components/OfflineBanner';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

// Splash Screen
import SplashScreen from './src/screens/SplashScreen';


// Authenticated navigator
import RootStackNavigator from './src/navigation/RootStackNavigator';

// Unauthenticated screens
import WelcomeLandingScreen from './src/screens/WelcomeLandingScreen';
import PublicLedgerScreen from './src/screens/PublicLedgerScreen';
import PublicOrgDetailScreen from './src/screens/PublicOrgDetailScreen';
import VerifyTransactionScreen from './src/screens/VerifyTransactionScreen';
import VerificationReportScreen from './src/screens/VerificationReportScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RecoveryPhraseScreen from './src/screens/RecoveryPhraseScreen';
import RestoreWalletScreen from './src/screens/RestoreWalletScreen';
import HelpFaqScreen from './src/screens/HelpFaqScreen';
import DataPrivacyScreen from './src/screens/DataPrivacyScreen';

// No-org holding screen
import NoOrganizationScreen from './src/screens/NoOrganizationScreen';

const AuthStack = createNativeStackNavigator();

/** Unauthenticated flow: Login → Register | Restore → RecoveryPhrase */
function AuthNavigator() {
  const { colors, navigationTheme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: '#090616' }}>
      <NavigationContainer theme={navigationTheme}>
        <AuthStack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#090616' },
            animation: 'slide_from_right',
          }}
        >
          <AuthStack.Screen name="WelcomeLanding" component={WelcomeLandingScreen} />
          <AuthStack.Screen name="PublicLedger" component={PublicLedgerScreen} />
          <AuthStack.Screen name="PublicOrgDetail" component={PublicOrgDetailScreen} />
          <AuthStack.Screen name="VerifyTransaction" component={VerifyTransactionScreen} />
          <AuthStack.Screen name="VerificationReport" component={VerificationReportScreen} />
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
          <AuthStack.Screen name="RecoveryPhrase" component={RecoveryPhraseScreen} />
          <AuthStack.Screen name="RestoreWallet" component={RestoreWalletScreen} />
          <AuthStack.Screen name="HelpFaq" component={HelpFaqScreen} />
          <AuthStack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
        </AuthStack.Navigator>
        <StatusBar style="light" />
      </NavigationContainer>
    </View>
  );
}

// Deep Linking Configuration
const linking = {
  prefixes: ['chainbudget://', 'https://chainbudget.vercel.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Dashboard: 'dashboard',
          Scanner: 'request-funds',
          DAO: 'governance',
          Inbox: 'approvals',
          Profile: 'profile',
        },
      },
      TransactionDetail: 'tx/:txId',
      Transfer: 'transfer',
      Receive: 'receive',
      Budget: 'budget',
      Members: 'members',
      Notifications: 'notifications',
      Audit: 'audit',
      Reports: 'reports',
      Treasury: 'treasury',
      HelpFaq: 'help',
      DataPrivacy: 'privacy',
    },
  },
};


/** Root navigator — switches between splash, auth (landing), no-org holding, and main app. */
const RootNavigator = ({ navigationRef }: { navigationRef: React.MutableRefObject<NavigationContainerRef<any> | null> }) => {
  const { user, isLoading } = useAuth();
  const { colors, navigationTheme } = useTheme();
  const [isSplashComplete, setIsSplashComplete] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded || !isSplashComplete || isLoading) {
    return <SplashScreen onFinish={() => setIsSplashComplete(true)} />;
  }


  // Not logged in → auth flow (Landing Page)
  if (!user) return <AuthNavigator />;

  // Logged in but no active org memberships yet → holding screen
  const hasActiveMembership = user.memberships?.some((m: any) => m.isActive);
  if (!hasActiveMembership) {
    return (
      <NavigationContainer theme={navigationTheme}>
        <NoOrganizationScreen />
        <StatusBar style={colors.statusBarStyle} />
      </NavigationContainer>
    );
  }

  // Logged in + has org → main app
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer ref={navigationRef as any} theme={navigationTheme} linking={linking as any}>
        <RootStackNavigator />
        <StatusBar style={colors.statusBarStyle} />
      </NavigationContainer>
    </View>
  );
};


export default function App() {
  // NavigationContainer ref used by the push notification tap handler.
  const navigationRef = useRef<NavigationContainerRef<any> | null>(null);

  useEffect(() => {
    // ── Security: Rooted/jailbroken device check ────────────────────────────
    async function checkSecurity() {
      try {
        const isRooted = await Device.isRootedExperimentalAsync();
        if (isRooted) {
          Alert.alert(
            'Security Warning',
            'This device appears to be rooted or jailbroken. Using ChainBudget on a compromised device may put your wallet keys at risk.',
            [{ text: 'I Understand', style: 'destructive' }]
          );
        }
      } catch {
        // Ignore detection errors
      }
    }
    checkSecurity();

    // ── Push Notifications: Android channel setup ───────────────────────────
    // Must be called before any notifications are shown. Safe to call on iOS too.
    setupAndroidNotificationChannel();

    // ── Push Notifications: Tap-to-navigate handler ─────────────────────────
    // When the user taps a push notification, this listener fires with the
    // notification data. We deep-link to the relevant screen.
    // Skipped in Expo Go — push notifications are not supported there since SDK 53.
    const IS_EXPO_GO = Constants.appOwnership === 'expo';
    let subscription: Notifications.EventSubscription | null = null;

    if (!IS_EXPO_GO) {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, any>;

        if (!navigationRef.current) return;

        if (data?.txId) {
          navigationRef.current.dispatch(CommonActions.navigate('TransactionDetail', { txId: data.txId }));
        } else if (data?.screen === 'Approvals') {
          navigationRef.current.dispatch(CommonActions.navigate('MainTabs', { screen: 'Inbox' }));
        } else if (data?.screen === 'DAO') {
          navigationRef.current.dispatch(CommonActions.navigate('MainTabs', { screen: 'DAO' }));
        }
      });
    }

    return () => subscription?.remove();
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#05040F' }}>
      <ThemeProvider>
        <ToastProvider>
          <OfflineBanner />
          <AuthProvider>
            {/* OrgProvider must be inside AuthProvider (uses useAuth) but outside
                SocketProvider and all screens so the shared org state is available
                everywhere. */}
            <OrgProvider>
              <SocketProvider>
                <RootNavigator navigationRef={navigationRef} />
              </SocketProvider>
            </OrgProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}


