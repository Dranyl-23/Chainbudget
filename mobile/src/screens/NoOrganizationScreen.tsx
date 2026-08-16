/**
 * NoOrganizationScreen.tsx
 *
 * Shown when a user is authenticated (has a wallet + JWT) but has no active
 * organization memberships yet.
 *
 * This happens in two cases:
 *  1. User registered on mobile BEFORE being invited by an admin.
 *  2. User was removed from all organizations.
 *
 * Provides two paths forward:
 *  A. Display their email so they can tell the admin to invite them.
 *  B. Enter an invite code (future Path B flow).
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, RefreshControl, ScrollView, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';

export default function NoOrganizationScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const identifier = user?.email || user?.walletAddress || '';
  const identifierLabel = user?.email ? 'Email' : 'Wallet Address';

  const copyIdentifier = async () => {
    await Clipboard.setStringAsync(identifier);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshUser]);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <LinearGradient colors={['#09090b', '#0d0d12', '#09090b']} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#a855f7"
          />
        }
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="business-outline" size={48} color="#a855f7" />
        </View>

        {/* Heading */}
        <Text style={styles.title}>Not in any organization yet</Text>
        <Text style={styles.subtitle}>
          You need to be invited by an organization admin before you can access ChainBudget features.
        </Text>

        {/* Step 1 — share identifier */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.cardTitle}>Share your {identifierLabel}</Text>
          </View>
          <Text style={styles.cardBody}>
            Give this to your organization admin so they can add you:
          </Text>
          <TouchableOpacity style={styles.identifierBox} onPress={copyIdentifier} activeOpacity={0.7}>
            <Text style={styles.identifierText} numberOfLines={1} ellipsizeMode="middle">
              {identifier}
            </Text>
            <Ionicons
              name={isCopied ? 'checkmark' : 'copy-outline'}
              size={18}
              color={isCopied ? '#34d399' : '#a855f7'}
            />
          </TouchableOpacity>
          {isCopied && (
            <Text style={styles.copiedHint}>Copied to clipboard!</Text>
          )}
        </View>

        {/* Step 2 — wait */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.cardTitle}>Wait for your invite</Text>
          </View>
          <Text style={styles.cardBody}>
            Once the admin adds you, pull down to refresh and your organization dashboard will appear automatically.
          </Text>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isRefreshing}
            activeOpacity={0.8}
          >
            {isRefreshing ? (
              <ActivityIndicator color="#a855f7" size="small" />
            ) : (
              <>
                <Ionicons name="refresh" size={16} color="#a855f7" />
                <Text style={styles.refreshBtnText}>Check for membership</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <Ionicons name="shield-checkmark" size={14} color="#34d399" />
          <Text style={styles.infoNoteText}>
            Your wallet is secured on this device. Your membership will be linked automatically once the admin invites you.
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.3)" />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1, alignItems: 'center',
    paddingTop: 80, paddingBottom: 48, paddingHorizontal: 28,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: '#fff',
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', lineHeight: 22, marginBottom: 36,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18, padding: 20, marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum: { color: '#a855f7', fontWeight: '800', fontSize: 13 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardBody: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginBottom: 14 },
  identifierBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  identifierText: {
    flex: 1, color: '#e879f9', fontFamily: 'monospace',
    fontSize: 13, marginRight: 10,
  },
  copiedHint: { color: '#34d399', fontSize: 12, marginTop: 6, textAlign: 'center' },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.35)',
    borderRadius: 12, paddingVertical: 12,
    backgroundColor: 'rgba(168,85,247,0.07)',
  },
  refreshBtnText: { color: '#a855f7', fontWeight: '700', fontSize: 14 },
  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(52,211,153,0.06)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)',
    borderRadius: 14, padding: 14, marginBottom: 32, width: '100%',
  },
  infoNoteText: { flex: 1, fontSize: 13, color: 'rgba(52,211,153,0.8)', lineHeight: 20 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8,
  },
  logoutText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
});
