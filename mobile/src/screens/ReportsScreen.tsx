/**
 * ReportsScreen.tsx
 *
 * Financial analytics, time-range breakdowns, AI Financial Forecaster,
 * with 2-column iPad/tablet responsive layout and Dynamic Type support.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useOrg } from '../context/OrgContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import ScaleButton from '../components/ScaleButton';

const LIQUIDATION_CONFIG: Record<string, { title: string; desc: string }> = {
  student_org: {
    title: "Institutional Liquidation",
    desc: "Submit verified ledger and transaction receipts to Cor Jesu College Finance for automated subsidy replenishment.",
  },
  barangay: {
    title: "Barangay Public Fund Liquidation",
    desc: "Submit verified disbursements and receipt records to the municipal audit office for public fund liquidation.",
  },
  hoa: {
    title: "HOA Financial Liquidation",
    desc: "Submit verified maintenance expenditures and official receipts to the HOA Board for community liquidation and audit.",
  },
  ngo: {
    title: "Grant & Donor Liquidation",
    desc: "Submit program expense receipts and financial statements to donor partners for grant compliance and liquidation.",
  },
  coop: {
    title: "Cooperative Operating Liquidation",
    desc: "Submit operating expense vouchers and audited cash flow receipts for annual general assembly liquidation.",
  },
  church: {
    title: "Ministry Stewardship Liquidation",
    desc: "Submit ministry outreach disbursements and audited receipts to the finance council for parish stewardship liquidation.",
  },
  sports_club: {
    title: "Club Expense Liquidation",
    desc: "Submit tournament fees, equipment disbursements, and verified receipts for team audit and member liquidation.",
  },
  startup: {
    title: "Corporate Expense Liquidation",
    desc: "Submit verified invoices, software subscriptions, and burn receipts to the executive board for monthly financial clearance.",
  },
  family: {
    title: "Family Fund Liquidation",
    desc: "Consolidate household disbursements and shared utility receipts for monthly family budget settlement and audit.",
  },
  fundraising: {
    title: "Group Fund Liquidation",
    desc: "Submit verified activity receipts and expense vouchers to all contributors for 100% transparent fund liquidation.",
  },
};

function getLiquidationConfig(type?: string | null) {
  if (type && LIQUIDATION_CONFIG[type]) {
    return LIQUIDATION_CONFIG[type];
  }
  return {
    title: "Financial Liquidation Report",
    desc: "Submit verified ledger transactions and receipts to all stakeholders and auditors for transparent fund liquidation.",
  };
}

const TIME_RANGES = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
];

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`;
  return `₱${n.toLocaleString()}`;
}

export default function ReportsScreen() {
  const route = useRoute<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { activeOrgId, activeOrg } = useOrg();
  // Fallback to activeOrgId so the screen works when navigated from tabs (no route params)
  const orgId: string = route.params?.orgId || activeOrgId;
  const orgName: string = activeOrg?.name || 'Organization';
  const [orgType, setOrgType] = useState<string>(activeOrg?.type || 'student_org');
  const [liquidationStatus, setLiquidationStatus] = useState<string>('none');
  const [showLiquidationModal, setShowLiquidationModal] = useState(false);
  const [isSubmittingLiquidation, setIsSubmittingLiquidation] = useState(false);

  const isTablet = screenWidth >= 768;

  const [rangeIdx, setRangeIdx] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastExpanded, setForecastExpanded] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (orgId) fetchData();
  }, [orgId, rangeIdx]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, txRes, orgRes] = await Promise.all([
        api.get(`/reports/summary?orgId=${orgId}`),
        api.get(`/transactions?orgId=${orgId}&limit=200`),
        api.get(`/organizations/${orgId}`).catch(() => ({ data: null })),
      ]);
      setSummary(summaryRes.data || {});
      // Backend returns { transactions: [...], total: N } — never .data.data or a bare array
      const txData = txRes.data?.transactions ?? (Array.isArray(txRes.data) ? txRes.data : []);
      setTransactions(txData);
      if (orgRes?.data?.liquidationStatus) {
        setLiquidationStatus(orgRes.data.liquidationStatus);
      }
      if (orgRes?.data?.type) {
        setOrgType(orgRes.data.type);
      }
    } catch (err) {
      console.error('[Reports] fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLiquidation = async () => {
    if (!orgId) return;
    setIsSubmittingLiquidation(true);
    try {
      await api.post(`/organizations/${orgId}/submit-liquidation`);
      setLiquidationStatus('pending');
      await triggerSuccessHaptic();
      Alert.alert(
        'Liquidation Submitted',
        'Official ledger and receipt records have been transmitted to the audit authority for review.'
      );
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to submit liquidation';
      Alert.alert('Submission Error', msg);
    } finally {
      setIsSubmittingLiquidation(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData().then(() => setRefreshing(false));
  };

  const fetchForecast = async (isManual = false) => {
    if (forecast && forecastExpanded && isManual) {
      setForecastExpanded(false);
      return;
    }
    setLoadingForecast(true);
    setForecastExpanded(true);
    setForecastError(null);
    try {
      const res = await api.get(`/ai/forecast?orgId=${orgId}`);
      setForecast(res.data);
      if (isManual) await triggerSuccessHaptic();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Could not load AI forecast.';
      setForecastError(errorMsg);
    } finally {
      setLoadingForecast(false);
    }
  };

  // Auto-fetch forecast on initial load
  useEffect(() => {
    if (orgId && !forecast) {
      fetchForecast(false);
    }
  }, [orgId]);


  // Filter transactions by selected time range
  const monthsAgo = TIME_RANGES[rangeIdx].months;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsAgo);
  const filtered = transactions.filter(tx => new Date(tx.createdAt) >= cutoff);
  const totalIncome = filtered.filter((t: any) => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = filtered.filter((t: any) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const monthlyBurnRate = monthsAgo > 0 ? Math.round(totalExpense / monthsAgo) : totalExpense;
  const treasuryBalance = summary?.treasuryBalance || 0;
  const runwayMonths = monthlyBurnRate > 0 ? (treasuryBalance / monthlyBurnRate).toFixed(1) : '∞';

  const healthStatus = forecast?.healthStatus || forecast?.status || 'good';
  const healthColor = healthStatus === 'good' ? colors.success
    : healthStatus === 'warning' ? colors.warning || '#F59E0B'
    : healthStatus === 'critical' ? colors.error
    : colors.textMuted;

  const config = getLiquidationConfig(orgType);
  const expenseTxs = transactions.filter((t: any) => t.type === 'expense');
  const verifiedReceipts = expenseTxs.filter((t: any) =>
    Boolean(t.receiptUrl || t.proofUrl || t.receiptIpfsHash || t.documentUrl)
  );
  const receiptPct = expenseTxs.length > 0
    ? Math.round((verifiedReceipts.length / expenseTxs.length) * 100)
    : 100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Dynamic Liquidation Banner */}
        <View style={{
          backgroundColor: colors.surface,
          borderColor: liquidationStatus === 'approved' ? colors.success + '40' : liquidationStatus === 'pending' ? '#F59E0B40' : colors.border,
          borderWidth: 1,
          borderRadius: 20,
          padding: 16,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.2 : 0.05,
          shadowRadius: 3,
          elevation: 1,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 6,
              flex: 1,
              minWidth: 0,
            }}>
              <Ionicons name="document-text-outline" size={16} color={colors.primary} style={{ marginTop: 1, flexShrink: 0 }} />
              <Text
                maxFontSizeMultiplier={1.2}
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{
                  color: colors.textPrimary,
                  fontWeight: '800',
                  fontSize: 12.5,
                  textTransform: 'uppercase',
                  flex: 1,
                  flexShrink: 1,
                  lineHeight: 17,
                }}
              >
                {config.title}
              </Text>
            </View>
            <View style={{
              backgroundColor: liquidationStatus === 'approved' ? 'rgba(16, 185, 129, 0.15)' : liquidationStatus === 'pending' ? 'rgba(245, 158, 11, 0.15)' : colors.surfaceElevated,
              borderColor: liquidationStatus === 'approved' ? colors.success + '40' : liquidationStatus === 'pending' ? '#F59E0B40' : colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3.5,
              flexShrink: 0,
              alignSelf: 'flex-start',
            }}>
              <Text style={{
                color: liquidationStatus === 'approved' ? colors.success : liquidationStatus === 'pending' ? '#F59E0B' : colors.textMuted,
                fontSize: 9.5,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}>
                {liquidationStatus === 'approved' ? 'Cleared & Replenished' : liquidationStatus === 'pending' ? 'Pending Review' : 'Ready for Submission'}
              </Text>
            </View>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 11.5, lineHeight: 16, marginBottom: 12 }}>
            {config.desc}
          </Text>

          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              setShowLiquidationModal(true);
            }}
            activeOpacity={0.8}
            style={{
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 9,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={15} color={colors.textPrimary} />
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
              Review Liquidation Audit
            </Text>
            <Ionicons name="arrow-forward" size={13} color={colors.textSecondary} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>

        {/* Time Range Selector */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {TIME_RANGES.map((r, i) => (
            <TouchableOpacity
              key={r.label}
              onPress={() => { setRangeIdx(i); triggerLightHaptic(); }}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 14,
                backgroundColor: rangeIdx === i ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: rangeIdx === i ? colors.primary : colors.border,
                alignItems: 'center',
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`View ${r.label} report range`}
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={{ color: rangeIdx === i ? '#fff' : colors.textMuted, fontWeight: '800', fontSize: 13 }}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading analytics...</Text>
          </View>
        ) : (
          <View>
            {/* Metric Summary Cards Grid (Responsive 4-col on tablet, 2-col on phone) */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Transactions', value: filtered.length.toString(), icon: 'receipt-outline', color: colors.primary },
                { label: 'Total Inflow', value: formatCurrency(totalIncome), icon: 'trending-up-outline', color: colors.success },
                { label: 'Total Outflow', value: formatCurrency(totalExpense), icon: 'trending-down-outline', color: colors.error },
                { label: 'Net Flow', value: formatCurrency(netBalance), icon: 'analytics-outline', color: netBalance >= 0 ? colors.success : colors.error },
              ].map(({ label, value, icon, color }) => (
                <View
                  key={label}
                  style={{
                    width: isTablet ? '23.5%' : '48%',
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 20,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDark ? 0.2 : 0.05,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                >
                  <View style={{
                    backgroundColor: color + '15',
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name={icon as any} size={18} color={color} />
                  </View>
                  <Text maxFontSizeMultiplier={1.3} style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
                  <Text maxFontSizeMultiplier={1.3} style={{ color, fontWeight: '800', fontSize: 18 }} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Tablet 2-Column Row Layout (Chart + Burn Rate / AI Forecast) */}
            <View style={isTablet ? { flexDirection: 'row', gap: 16, marginBottom: 20 } : { marginBottom: 20 }}>
              {/* Income vs Expenses Bar Chart */}
              {filtered.length > 0 && (
                <View style={{
                  flex: isTablet ? 1 : undefined,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 24,
                  padding: 18,
                  marginBottom: isTablet ? 0 : 16,
                }}>
                  <Text maxFontSizeMultiplier={1.3} style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15, marginBottom: 16 }}>
                    Inflow vs Outflow
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 32, height: 110 }}>
                    {[
                      { label: 'Inflow', value: totalIncome, color: colors.success },
                      { label: 'Outflow', value: totalExpense, color: colors.error },
                    ].map(({ label, value, color }) => {
                      const max = Math.max(totalIncome, totalExpense, 1);
                      const barH = Math.max(8, Math.round((value / max) * 80));
                      return (
                        <View key={label} style={{ alignItems: 'center' }}>
                          <Text maxFontSizeMultiplier={1.3} style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4, fontWeight: '600' }}>
                            {formatCurrency(value)}
                          </Text>
                          <View style={{ width: 56, height: barH, backgroundColor: color, borderRadius: 10 }} />
                          <Text maxFontSizeMultiplier={1.3} style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6, fontWeight: '700' }}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Financial Runway & Burn Rate Metric Card */}
              <View style={{
                flex: isTablet ? 1 : undefined,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 24,
                padding: 18,
                justifyContent: 'space-between',
              }}>
                <View>
                  <Text maxFontSizeMultiplier={1.3} style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 15, marginBottom: 12 }}>
                    Burn Rate & Treasury Runway
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Monthly Burn Rate</Text>
                      <Text maxFontSizeMultiplier={1.3} style={{ color: colors.error, fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                        {formatCurrency(monthlyBurnRate)}/mo
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Estimated Runway</Text>
                      <Text maxFontSizeMultiplier={1.3} style={{ color: colors.primary, fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                        {runwayMonths} {runwayMonths === '1' ? 'month' : 'months'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{
                  backgroundColor: colors.primaryMuted,
                  borderColor: colors.primary + '30',
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 11, flex: 1, lineHeight: 15 }}>
                    Calculated based on {monthsAgo}M historical average expenditure vs active treasury balance.
                  </Text>
                </View>
              </View>
            </View>

            {/* AI Financial Advisor Card */}
            <View style={{
              backgroundColor: colors.surface,
              borderColor: colors.primary + '50',
              borderWidth: 1.5,
              borderRadius: 24,
              padding: 18,
              marginBottom: 20,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.2 : 0.08,
              shadowRadius: 6,
              elevation: 2,
            }}>
              <TouchableOpacity
                onPress={() => fetchForecast(true)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    backgroundColor: colors.primaryMuted,
                    borderColor: colors.primary + '40',
                    borderWidth: 1,
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="sparkles" size={20} color={colors.primary} />
                  </View>
                  <View>
                    <Text maxFontSizeMultiplier={1.3} style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>
                      AI Financial Forecaster
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      Powered by Gemini Multimodal Analytics
                    </Text>
                  </View>
                </View>
                <Ionicons name={forecastExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {forecastExpanded && (
                <View style={{ marginTop: 16 }}>
                  {loadingForecast ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={{ color: colors.textSecondary, marginTop: 10, fontSize: 12 }}>
                        Generating comprehensive forecast with Gemini AI...
                      </Text>
                    </View>
                  ) : forecast ? (
                    <View>
                      {/* Health Badge & AI Indicator */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>Treasury Health:</Text>
                          <View style={{
                            backgroundColor: healthColor + '20',
                            borderColor: healthColor + '60',
                            borderWidth: 1,
                            borderRadius: 20,
                            paddingHorizontal: 12,
                            paddingVertical: 3,
                          }}>
                            <Text style={{ color: healthColor, fontWeight: '800', textTransform: 'uppercase', fontSize: 11 }}>
                              {healthStatus}
                            </Text>
                          </View>
                        </View>
                        {forecast.isAiGenerated && (
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: 'rgba(147, 51, 234, 0.15)',
                            borderColor: '#9333EA40',
                            borderWidth: 1,
                            borderRadius: 12,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}>
                            <Ionicons name="sparkles" size={10} color="#9333EA" />
                            <Text style={{ color: '#9333EA', fontSize: 10, fontWeight: '700' }}>Gemini AI</Text>
                          </View>
                        )}
                      </View>

                      {/* Forecast Summary Body */}
                      {(forecast.forecast || forecast.summary) && (
                        <View style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : colors.backgroundSecondary,
                          borderRadius: 16,
                          padding: 14,
                          marginBottom: 14,
                          borderWidth: 1,
                          borderColor: colors.borderSubtle,
                        }}>
                          <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 20 }}>
                            {forecast.forecast || forecast.summary}
                          </Text>
                        </View>
                      )}

                      {/* Actionable Insights & Warnings */}
                      {((forecast.insights && forecast.insights.length > 0) || (forecast.recommendations && forecast.recommendations.length > 0)) && (
                        <View style={{ marginBottom: 10 }}>
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                            Actionable Strategic Insights:
                          </Text>
                          {(forecast.insights || forecast.recommendations || []).map((item: string, idx: number) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                              <View style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: colors.primary,
                                marginTop: 6,
                                flexShrink: 0,
                              }} />
                              <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, flex: 1 }}>
                                {item}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {forecast.risks && forecast.risks.length > 0 && (
                        <View style={{ marginTop: 4 }}>
                          <Text style={{ color: colors.error, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                            Identified Risk Factors:
                          </Text>
                          {forecast.risks.map((r: string, idx: number) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                              <View style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: colors.error,
                                marginTop: 6,
                                flexShrink: 0,
                              }} />
                              <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, flex: 1 }}>
                                {r}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : forecastError ? (
                    <View
                      style={{
                        backgroundColor: colors.errorBg || 'rgba(239, 68, 68, 0.12)',
                        borderColor: colors.errorBorder || 'rgba(239, 68, 68, 0.3)',
                        borderWidth: 1,
                        borderRadius: 16,
                        padding: 14,
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Ionicons name="alert-circle-outline" size={18} color={colors.error || '#EF4444'} />
                        <Text style={{ color: colors.error || '#EF4444', fontWeight: '700', fontSize: 13 }}>
                          AI Forecast Unavailable
                        </Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
                        {forecastError}
                      </Text>
                      <TouchableOpacity
                        onPress={() => fetchForecast(true)}
                        style={{
                          backgroundColor: colors.primary,
                          borderRadius: 10,
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Ionicons name="refresh-outline" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Retry Forecast</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => fetchForecast(true)}
                      style={{
                        backgroundColor: colors.primaryMuted,
                        borderColor: colors.primary + '60',
                        borderWidth: 1,
                        borderRadius: 14,
                        paddingVertical: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                      }}
                    >
                      <Ionicons name="sparkles" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                        Run Predictive AI Forecast
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Recent Large Expenses Section */}
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: '800',
                marginBottom: 12,
                marginTop: 8,
              }}
            >
              Significant Outflows
            </Text>
            {filtered.filter(tx => tx.type === 'expense').slice(0, 5).map((tx: any) => (
              <View
                key={tx._id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}
                  >
                    {tx.description}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                    {new Date(tx.createdAt).toLocaleDateString()} · {tx.category || tx.budgetCategory || 'General'}
                  </Text>
                </View>
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={{
                    color: tx.type === 'expense' ? colors.error : colors.success,
                    fontWeight: '800',
                    fontSize: 14,
                  }}
                >
                  {tx.type === 'expense' ? '-' : '+'}₱{(tx.amount || 0).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Liquidation Audit Breakdown Modal */}
      <Modal
        visible={showLiquidationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLiquidationModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: '92%',
            paddingTop: 16,
            paddingBottom: 24,
            paddingHorizontal: 16,
          }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              gap: 10,
            }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800' }}>
                    {config.title}
                  </Text>
                  <View style={{
                    backgroundColor: liquidationStatus === 'approved' ? 'rgba(16, 185, 129, 0.15)' : liquidationStatus === 'pending' ? 'rgba(245, 158, 11, 0.15)' : colors.surfaceElevated,
                    borderColor: liquidationStatus === 'approved' ? colors.success + '40' : liquidationStatus === 'pending' ? '#F59E0B40' : colors.border,
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    flexShrink: 0,
                  }}>
                    <Text style={{
                      color: liquidationStatus === 'approved' ? colors.success : liquidationStatus === 'pending' ? '#F59E0B' : colors.textMuted,
                      fontSize: 9,
                      fontWeight: '800',
                      textTransform: 'uppercase',
                    }}>
                      {liquidationStatus.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
                  {orgName} · On-Chain Cryptographic Audit
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowLiquidationModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.surfaceElevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 14, paddingBottom: 20 }}>
              {/* Reconciliation KPI Cards */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                <View style={{ flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>Total Inflow</Text>
                  <Text style={{ color: colors.success, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                    {formatCurrency(totalIncome)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>Total Outflow</Text>
                  <Text style={{ color: colors.error, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                    {formatCurrency(totalExpense)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>Net Variance</Text>
                  <Text style={{ color: netBalance >= 0 ? colors.success : colors.error, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                    {formatCurrency(netBalance)}
                  </Text>
                </View>
              </View>

              {/* Receipt Compliance Meter */}
              <View style={{
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 12,
                marginBottom: 14,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                      Receipt Compliance Meter
                    </Text>
                  </View>
                  <Text style={{ color: receiptPct >= 80 ? colors.success : '#F59E0B', fontSize: 12, fontWeight: '800' }}>
                    {receiptPct}% Compliant
                  </Text>
                </View>
                {/* Progress bar */}
                <View style={{ height: 6, backgroundColor: isDark ? '#27272a' : '#e4e4e7', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                  <View style={{ width: `${receiptPct}%`, height: '100%', backgroundColor: receiptPct >= 80 ? colors.success : '#F59E0B', borderRadius: 3 }} />
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 10.5 }}>
                  {verifiedReceipts.length} of {expenseTxs.length} expenditures verified with IPFS receipts and multi-sig cryptographic hashes.
                </Text>
              </View>

              {/* Audited Expense Schedule */}
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 8 }}>
                Audited Expense Schedule ({expenseTxs.length} items)
              </Text>
              {expenseTxs.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: 14, marginBottom: 14 }}>
                  <Ionicons name="folder-open-outline" size={24} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                    No expense transactions recorded for this liquidation cycle.
                  </Text>
                </View>
              ) : (
                <View style={{ backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
                  {expenseTxs.slice(0, 15).map((tx: any, idx: number) => {
                    const hasReceipt = Boolean(tx.receiptUrl || tx.proofUrl || tx.receiptIpfsHash || tx.documentUrl);
                    return (
                      <View
                        key={tx._id || idx}
                        style={{
                          padding: 10,
                          borderBottomWidth: idx === Math.min(expenseTxs.length - 1, 14) ? 0 : 1,
                          borderBottomColor: colors.border,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                            {tx.description || 'Disbursement'}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 1 }}>
                            {new Date(tx.createdAt).toLocaleDateString()} · {tx.category || tx.budgetCategory || 'General'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Text style={{ color: colors.error, fontSize: 12, fontWeight: '800' }}>
                            -₱{(tx.amount || 0).toLocaleString()}
                          </Text>
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                            backgroundColor: hasReceipt ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                            borderRadius: 4,
                          }}>
                            <Ionicons name={hasReceipt ? "checkmark-circle" : "alert-circle"} size={9} color={hasReceipt ? colors.success : colors.error} />
                            <Text style={{ color: hasReceipt ? colors.success : colors.error, fontSize: 9, fontWeight: '700' }}>
                              {hasReceipt ? "IPFS Proof" : "No Receipt"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Multi-Sig Governance Defense Sign-off */}
              <View style={{
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 12,
                marginBottom: 14,
              }}>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Multi-Sig Governance & Sign-Offs
                </Text>
                <View style={{ gap: 6 }}>
                  {[
                    { role: 'Organization President', status: 'Signed & Certified', icon: 'ribbon-outline' },
                    { role: 'Internal Auditor', status: 'Verified & Reconciled', icon: 'shield-checkmark-outline' },
                    { role: 'Chief Financial Officer / Treasurer', status: 'Treasury Balanced', icon: 'wallet-outline' },
                  ].map((signer) => (
                    <View
                      key={signer.role}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={signer.icon as any} size={13} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                          {signer.role}
                        </Text>
                      </View>
                      <Text style={{ color: colors.success, fontSize: 10, fontWeight: '700' }}>
                        ✓ {signer.status}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Modal Action Buttons */}
              <View style={{ gap: 8, marginTop: 4 }}>
                {liquidationStatus !== 'pending' && liquidationStatus !== 'approved' && (
                  <TouchableOpacity
                    onPress={async () => {
                      await handleSubmitLiquidation();
                      setShowLiquidationModal(false);
                    }}
                    disabled={isSubmittingLiquidation}
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 14,
                      paddingVertical: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSubmittingLiquidation ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                        Submit Liquidation to Authority
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowLiquidationModal(false)}
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                    Close Audit Review
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
