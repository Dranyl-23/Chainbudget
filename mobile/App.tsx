import React, { useEffect, useState } from 'react';
import 'react-native-get-random-values';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Device from 'expo-device';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';

// Splash Screen
import SplashScreen from './src/screens/SplashScreen';

// Authenticated navigator
import RootStackNavigator from './src/navigation/RootStackNavigator';

// Unauthenticated screens
import WelcomeLandingScreen from './src/screens/WelcomeLandingScreen';
import PublicLedgerScreen from './src/screens/PublicLedgerScreen';
import VerifyTransactionScreen from './src/screens/VerifyTransactionScreen';
import VerificationReportScreen from './src/screens/VerificationReportScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RecoveryPhraseScreen from './src/screens/RecoveryPhraseScreen';
import RestoreWalletScreen from './src/screens/RestoreWalletScreen';

// No-org holding screen
import NoOrganizationScreen from './src/screens/NoOrganizationScreen';

const AuthStack = createNativeStackNavigator();

/** Unauthenticated flow: Login → Register | Restore → RecoveryPhrase */
function AuthNavigator() {
  const { colors, navigationTheme } = useTheme();

  return (
    <NavigationContainer theme={navigationTheme}>
      <AuthStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade_from_bottom',
        }}
      >
        <AuthStack.Screen name="WelcomeLanding" component={WelcomeLandingScreen} />
        <AuthStack.Screen name="PublicLedger" component={PublicLedgerScreen} />
        <AuthStack.Screen name="VerifyTransaction" component={VerifyTransactionScreen} />
        <AuthStack.Screen name="VerificationReport" component={VerificationReportScreen} />
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
        <AuthStack.Screen name="RecoveryPhrase" component={RecoveryPhraseScreen} />
        <AuthStack.Screen name="RestoreWallet" component={RestoreWalletScreen} />
      </AuthStack.Navigator>
      <StatusBar style={colors.statusBarStyle} />
    </NavigationContainer>
  );
}

/** Root navigator — switches between splash, auth (landing), no-org holding, and main app. */
const RootNavigator = () => {
  const { user, isLoading } = useAuth();
  const { colors, navigationTheme } = useTheme();
  const [isSplashComplete, setIsSplashComplete] = useState(false);

  if (!isSplashComplete || isLoading) {
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
    <NavigationContainer theme={navigationTheme}>
      <RootStackNavigator />
      <StatusBar style={colors.statusBarStyle} />
    </NavigationContainer>
  );
};

export default function App() {
  useEffect(() => {
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
      } catch (err) {
        // Ignore detection errors
      }
    }
    checkSecurity();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <RootNavigator />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
