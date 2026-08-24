/**
 * PublicOrgDetailScreen.tsx
 *
 * Dedicated Full-Page Public Organization Profile & Transparency Ledger.
 * Displays smart contract verification, transparency rating, and on-chain transaction history.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Share,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';

const ORG_TYPE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  student_org: { label: 'Student Org', icon: 'school-outline', color: '#C084FC' },
  barangay: { label: 'Barangay LGU', icon: 'business-outline', color: '#38BDF8' },
  homeowners_association: { label: 'Homeowners (HOA)', icon: 'key-outline', color: '#F59E0B' },
  ngo: { label: 'Non-Profit / NGO', icon: 'heart-outline', color: '#F43F5E' },
  cooperative: { label: 'Cooperative', icon: 'people-outline', color: '#10B981' },
  church: { label: 'Church / Religious', icon: 'home-outline', color: '#818CF8' },
  sports_club: { label: 'Sports & Club', icon: 'trophy-outline', color: '#E11D48' },
  startup: { label: 'Startup & Company', icon: 'rocket-outline', color: '#06B6D4' },
  family: { label: 'Family / Estate', icon: 'people-circle-outline', color: '#84CC16' },
  fundraising: { label: 'Fundraising Campaign', icon: 'gift-outline', color: '#EC4899' },
};

function getOrgTypeInfo(type?: string) {
  if (!type) return { label: 'Organization', icon: 'business-outline' as const, color: '#A855F7' };
  return ORG_TYPE_MAP[type] || { label: type.replace('_', ' '), icon: 'business-outline' as const, color: '#A855F7' };
}

const BACKEND_BASE = 'https://chainbudget-api.fly.dev';

function formatMobileAvatarUrl(uri?: string) {
  if (!uri || typeof uri !== 'string') return undefined;
  if (uri.startsWith('data:image/') || uri.startsWith('blob:')) {
    return uri;
  }
  if (uri.startsWith('/uploads')) {
    return `${BACKEND_BASE}${uri}`;
  }
  if (uri.includes('localhost:5001') || uri.includes('127.0.0.1:5001')) {
    return uri.replace(/http:\/\/(localhost|127\.0\.0\.1):5001/, BACKEND_BASE);
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }
  return undefined;
}

function timeAgo(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
  } catch (e) {
    return dateString;
  }
}

export default function PublicOrgDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();

  const orgId = route.params?.orgId || route.params?.org?._id;
  const initialOrg = route.params?.org;

  const [org, setOrg] = useState<any>(initialOrg || null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(!initialOrg);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (orgId) {
      fetchOrgDetails();
    }
  }, [orgId]);

  const fetchOrgDetails = async () => {
    try {
      const [orgRes, txRes, budgetRes] = await Promise.all([
        api.get(`/public/organizations/${orgId}`),
        api.get(`/public/organizations/${orgId}/transactions`).catch(() => ({ data: [] })),
        api.get(`/public/organizations/${orgId}/budget`).catch(() => ({ data: null })),
      ]);

      setOrg(orgRes.data?.organization || orgRes.data);
      setTransactions(txRes.data?.transactions || (Array.isArray(txRes.data) ? txRes.data : []));
      setBudget(budgetRes.data?.budget || budgetRes.data);
    } catch (err) {
      console.error('[PublicOrgDetail] Failed to load:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrgDetails();
  };

  const handleCopyContract = async (address: string) => {
    await Clipboard.setStringAsync(address);
    await triggerSuccessHaptic();
    showToast('Smart contract address copied to clipboard!', 'info');
  };

  const handleOpenPolygonscan = (hashOrAddress: string, isTx = false) => {
    triggerLightHaptic();
    const url = isTx
      ? `https://amoy.polygonscan.com/tx/${hashOrAddress}`
      : `https://amoy.polygonscan.com/address/${hashOrAddress}`;
    Linking.openURL(url).catch(() => {
      showToast('Could not open PolygonScan explorer.', 'error');
    });
  };

  const handleShare = async () => {
    triggerLightHaptic();
    if (!org) return;
    try {
      await Share.share({
        title: `${org.name} - Public Ledger`,
        message: `View the verified public on-chain ledger and treasury for ${org.name} on ChainBudget.\nContract: ${org.contractAddress || 'Polygon Amoy'}`,
      });
    } catch (e) {}
  };

  const typeInfo = getOrgTypeInfo(org?.type);
  const score = org?.transparencyScore ?? (org?.contractAddress ? 100 : 50);
  const scoreColor = score >= 80 ? colors.success : colors.warning;

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      {/* ── Top Header Bar ── */}
      <View
        style={{
          paddingTop: (insets.top || 0) + 8,
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderSubtle,
        }}
        className="border-b px-4 pb-3 shadow-sm"
      >
        <View className="flex-row items-center justify-between h-12">
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              navigation.goBack();
            }}
            className="w-10 h-10 items-center justify-center -ml-2 rounded-full"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <Text style={{ color: colors.textPrimary }} className="font-extrabold text-lg">
            Organization Ledger
          </Text>

          <TouchableOpacity
            onPress={handleShare}
            className="w-10 h-10 items-center justify-center -mr-2 rounded-full"
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 12 }}>
              Loading public ledger...
            </Text>
          </View>
        ) : (
          <View>
            {/* ── Organization Hero Profile Card ── */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 24,
                padding: 20,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.2 : 0.05,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center gap-3.5 mb-3">
                {/* Org Avatar */}
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 18,
                    backgroundColor: typeInfo.color + '20',
                    borderColor: typeInfo.color + '50',
                    borderWidth: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {formatMobileAvatarUrl(org?.logoUrl) ? (
                    <Image
                      source={{ uri: formatMobileAvatarUrl(org?.logoUrl) }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name={typeInfo.icon} size={28} color={typeInfo.color} />
                  )}
                </View>

                <View className="flex-1">
                  <Text
                    style={{ color: colors.textPrimary }}
                    className="text-lg font-black leading-tight"
                    numberOfLines={2}
                  >
                    {org?.name || 'Organization'}
                  </Text>
                  
                  {/* Category & Private Tags */}
                  <View className="flex-row items-center gap-2 mt-1">
                    <View
                      style={{
                        backgroundColor: typeInfo.color + '15',
                        borderColor: typeInfo.color + '30',
                        borderWidth: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 2.5,
                        borderRadius: 10,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <Text style={{ color: typeInfo.color, fontSize: 10.5, fontWeight: '700' }}>
                        {typeInfo.label}
                      </Text>
                    </View>

                    {org?.isPrivate && (
                      <View
                        style={{
                          backgroundColor: 'rgba(192, 132, 252, 0.15)',
                          borderColor: 'rgba(192, 132, 252, 0.35)',
                          borderWidth: 1,
                          paddingHorizontal: 8,
                          paddingVertical: 2.5,
                          borderRadius: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Ionicons name="lock-closed" size={11} color="#C084FC" />
                        <Text style={{ color: '#C084FC', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                          Private
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Description */}
              {org?.description ? (
                <Text style={{ color: colors.textSecondary }} className="text-xs leading-5 mb-4">
                  {org.description}
                </Text>
              ) : (
                <Text style={{ color: colors.textMuted }} className="text-xs italic mb-4">
                  {org?.isPrivate ? 'Confidential organization on ChainBudget.' : 'Public decentralized autonomous organization on ChainBudget.'}
                </Text>
              )}

              {/* Metrics Grid */}
              <View className="flex-row gap-3">
                {/* Transparency Metric */}
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : colors.backgroundSecondary,
                    borderColor: colors.borderSubtle,
                    borderWidth: 1,
                  }}
                  className="flex-1 p-3.5 rounded-2xl items-center"
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 9.5,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    Transparency
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <Ionicons name="shield-checkmark" size={16} color={scoreColor} />
                    <Text style={{ color: scoreColor, fontWeight: '900', fontSize: 18 }}>
                      {score}%
                    </Text>
                  </View>
                </View>

                {/* Network Metric */}
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : colors.backgroundSecondary,
                    borderColor: colors.borderSubtle,
                    borderWidth: 1,
                  }}
                  className="flex-1 p-3.5 rounded-2xl items-center"
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 9.5,
                      fontWeight: '700',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    Network
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <Ionicons name="globe-outline" size={16} color={colors.accentCyan} />
                    <Text style={{ color: colors.accentCyan, fontWeight: '800', fontSize: 13 }}>
                      Polygon Amoy
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── If Private: Show Confidential Organization Lock Card ── */}
            {org?.isPrivate ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 24,
                  padding: 24,
                  alignItems: 'center',
                  marginTop: 4,
                  marginBottom: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.2 : 0.05,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 20,
                    backgroundColor: 'rgba(192, 132, 252, 0.15)',
                    borderColor: 'rgba(192, 132, 252, 0.35)',
                    borderWidth: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Ionicons name="lock-closed" size={28} color="#C084FC" />
                </View>

                <Text
                  style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 17, textAlign: 'center', marginBottom: 8 }}
                >
                  Confidential / Private Organization
                </Text>

                <Text
                  style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 20, textAlign: 'center', marginBottom: 18 }}
                >
                  This organization has restricted public ledger visibility. Transactions, budgets, and operational expenditures are strictly confidential and visible only to authenticated, authorized members.
                </Text>

                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.backgroundSecondary,
                    borderColor: colors.borderSubtle,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="shield-checkmark" size={14} color="#38BDF8" />
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                    Member Access Only
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {/* ── Smart Contract Explorer Card ── */}
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 22,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <View className="flex-row justify-between items-center mb-2">
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 10.5,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}
                    >
                      Smart Contract Ledger
                    </Text>
                    {org?.contractAddress && (
                      <TouchableOpacity
                        onPress={() => handleCopyContract(org.contractAddress)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                          Copy
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {org?.contractAddress ? (
                    <>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: 'monospace',
                          fontSize: 12,
                          lineHeight: 18,
                        }}
                      >
                        {org.contractAddress}
                      </Text>

                      <TouchableOpacity
                        onPress={() => handleOpenPolygonscan(org.contractAddress, false)}
                        activeOpacity={0.8}
                        style={{
                          backgroundColor: colors.primaryMuted,
                          borderColor: colors.primary + '40',
                          borderWidth: 1,
                        }}
                        className="flex-row items-center justify-center py-2.5 rounded-xl mt-3 gap-1.5"
                      >
                        <Ionicons name="open-outline" size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                          Verify on PolygonScan Explorer
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Smart contract not yet linked to this organization.
                    </Text>
                  )}
                </View>

                {/* ── Public Transactions Section ── */}
                <View className="flex-row justify-between items-center mb-3 px-1">
                  <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>
                    Public Transactions
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                    {transactions.length} record{transactions.length === 1 ? '' : 's'}
                  </Text>
                </View>

                {transactions.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 20,
                      padding: 24,
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
                    <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13, marginTop: 10 }}>
                      No public transactions yet
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                      Approved transactions from this organization will be listed here.
                    </Text>
                  </View>
                ) : (
                  transactions.map((tx: any, idx) => {
                    const isExpense = tx.type === 'expense';

                    return (
                      <View
                        key={tx._id || idx}
                        style={{
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderRadius: 18,
                          padding: 14,
                          marginBottom: 10,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isDark ? 0.15 : 0.04,
                          shadowRadius: 3,
                          elevation: 1,
                        }}
                      >
                        <View className="flex-row justify-between items-start mb-1.5">
                          <View className="flex-row items-center flex-1 mr-2">
                            <View
                              style={{
                                backgroundColor: isExpense ? colors.errorBg : colors.successBg,
                                borderColor: isExpense ? colors.errorBorder : colors.successBorder,
                                borderWidth: 1,
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 10,
                              }}
                            >
                              <Ionicons
                                name={isExpense ? 'arrow-up' : 'arrow-down'}
                                size={16}
                                color={isExpense ? colors.error : colors.success}
                              />
                            </View>
                            <View className="flex-1">
                              <Text
                                style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}
                                numberOfLines={1}
                              >
                                {tx.description || 'Disbursement'}
                              </Text>
                              <Text style={{ color: colors.textMuted, fontSize: 10.5, marginTop: 1 }}>
                                {timeAgo(tx.createdAt)}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={{
                              color: isExpense ? colors.textPrimary : colors.success,
                              fontWeight: '800',
                              fontSize: 14,
                            }}
                          >
                            {isExpense ? '-' : '+'}₱{tx.amount?.toLocaleString() || '0'}
                          </Text>
                        </View>

                        {/* Blockchain Proof Link */}
                        {tx.blockchainTxHash && (
                          <TouchableOpacity
                            onPress={() => handleOpenPolygonscan(tx.blockchainTxHash, true)}
                            activeOpacity={0.7}
                            style={{
                              backgroundColor: colors.infoBg,
                              borderColor: colors.infoBorder,
                              borderWidth: 1,
                              alignSelf: 'flex-start',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                              marginTop: 6,
                            }}
                          >
                            <Ionicons
                              name="checkmark-circle"
                              size={11}
                              color={colors.accentBlue}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={{
                                color: colors.accentBlue,
                                fontSize: 10,
                                fontFamily: 'monospace',
                                fontWeight: '700',
                              }}
                            >
                              On-Chain: {tx.blockchainTxHash.substring(0, 8)}...
                              {tx.blockchainTxHash.substring(tx.blockchainTxHash.length - 4)}
                            </Text>
                            <Ionicons
                              name="open-outline"
                              size={10}
                              color={colors.accentBlue}
                              style={{ marginLeft: 4 }}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
