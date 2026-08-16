/**
 * LoginScreen.tsx
 *
 * Entry screen shown when there is no active session.
 * Branches based on whether a wallet already exists on this device:
 *
 *   hasLocalWallet = true  →  "Welcome back" → Sign In button
 *   hasLocalWallet = false →  "Get started"  → Create Account + Restore options
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, ImageBackground, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../context/AuthContext';
import { getStoredWalletAddress } from '../lib/wallet';


export default function LoginScreen({ navigation }: any) {
  const { login, hasLocalWallet, resetWalletState } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      const walletAddress = await getStoredWalletAddress();
      if (!walletAddress) {
        Alert.alert('Wallet Not Found', 'No wallet was found on this device. Please create or restore an account.');
        return;
      }
      await login(walletAddress);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Sign in failed. Please try again.';
      
      if (msg.includes('cancel') || msg.includes('Cancel')) {
        Alert.alert('Authentication Cancelled', 'Please authenticate to sign in.');
      } else if (err?.response?.status === 404) {
        Alert.alert(
          'Account Not Found',
          'Your local wallet is not registered on the server. This usually happens if the backend database was reset.\n\nWould you like to clear your local wallet to register again?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Clear Wallet', 
              style: 'destructive', 
              onPress: async () => {
                const { clearAll } = require('../lib/secureStorage');
                await clearAll();
                resetWalletState();
              }
            }

          ]
        );
      } else {
        Alert.alert('Sign In Failed', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView 
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      <ImageBackground 
        source={require('../../assets/login_bg.jpg')} 
        style={styles.container}
        resizeMode="cover"
      >
        {/* Floating Blocks Decorator */}
        <Image 
          source={require('../../assets/Blocks.png')}
          style={{ position: 'absolute', top: -60, right: -80, width: 400, height: 400, opacity: 0.8 }}
          resizeMode="contain"
        />
        <LinearGradient 
          colors={['rgba(9,9,11,0.4)', 'rgba(9,9,11,0.8)', '#09090b']} 
          style={StyleSheet.absoluteFillObject} 
        />

        {/* Logo / Icon */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/3D-Chainbudget.png')} 
              style={{ width: 240, height: 240 }} 
              resizeMode="contain" 
            />
          </View>
          
          <Text style={styles.appName}>
            Chain<Text style={{ color: '#00E5FF' }}>Budget</Text>
          </Text>
          
          {hasLocalWallet ? (
            <>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.tagline}>
                Secure, private, and built for your{'\n'}financial freedom.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.welcomeText}>Get started</Text>
              <Text style={styles.tagline}>
                Transparent on-chain budgets for{'\n'}your organization
              </Text>
            </>
          )}
        </View>


        {/* Actions */}
        <View style={styles.actions}>
          {hasLocalWallet ? (
            // ── Returning user ─────────────────────────────────────────────────
            <>
              <TouchableOpacity onPress={handleSignIn} disabled={isLoading} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#1d4ed8', '#00E5FF']}
                  style={styles.primaryBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={20} color="#fff" />
                      <Text style={styles.primaryBtnText}>Sign In</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerWrap}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('RestoreWallet')}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />
                <Text style={styles.secondaryBtnText}>Use a different account</Text>
              </TouchableOpacity>
            </>
          ) : (
            // ── New user ───────────────────────────────────────────────────────
            <>
              <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#1d4ed8', '#00E5FF']}
                  style={styles.primaryBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerWrap}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('RestoreWallet')}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#a855f7" style={{ marginRight: 6 }} />
                <Text style={[styles.secondaryBtnText, { color: '#a855f7' }]}>
                  Restore Existing Account
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footerWrap}>
          <Ionicons name="lock-closed-outline" size={16} color="#00E5FF" style={{ marginBottom: 8 }} />
          <Text style={styles.footer}>
            Your private key never leaves your device.{'\n'}You're always in control.
          </Text>
        </View>
      </ImageBackground>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#09090b' },
  hero: { alignItems: 'center', marginBottom: 36 },
  logoContainer: {
    marginBottom: -10,
    shadowColor: '#00E5FF', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 10 },
  },
  appName: { fontSize: 36, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, marginBottom: 12 },
  welcomeText: { fontSize: 18, fontWeight: '600', color: '#e4e4e7', marginBottom: 8 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(52,211,153,0.06)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100,
    marginBottom: 44,
  },
  secureBadgeText: { fontSize: 12, color: '#34d399', fontWeight: '500' },
  actions: { width: '100%', marginBottom: 40 },
  primaryBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18,
    borderRadius: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  dividerWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, paddingHorizontal: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600', marginHorizontal: 16 },
  secondaryBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  secondaryBtnText: { color: 'rgba(255,255,255,0.85)', fontWeight: '500', fontSize: 15 },
  footerWrap: { alignItems: 'center', position: 'absolute', bottom: 40 },
  footer: { fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 18 },
});
