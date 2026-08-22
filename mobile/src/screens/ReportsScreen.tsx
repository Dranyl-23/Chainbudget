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
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import ScaleButton from '../components/ScaleButton';

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
  const orgId: string = route.params?.orgId;

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
      const [summaryRes, txRes] = await Promise.all([
        api.get(`/reports/summary?orgId=${orgId}`),
        api.get(`/transactions?orgId=${orgId}&limit=200`),
      ]);
      setSummary(summaryRes.data || {});
      const txData = txRes.data?.data || txRes.data || [];
      setTransactions(Array.isArray(txData) ? txData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
          <>
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
                    <>
                      {/* Health Badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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

                      {/* Forecast Summary Body */}
                      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 14 }}>
                        {forecast.forecast || forecast.summary || forecast.advice}
                      </Text>

                      {/* Actionable Insights */}
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
                        Actionable Insights & Recommendations:
                      </Text>
                      {(forecast.insights || forecast.recommendations || []).map((insight: string, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                          <Ionicons name="bulb" size={15} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                          <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 }}>
                            {insight}
                          </Text>
                        </View>
                      ))}
                    </>
                  ) : forecastError ? (
                    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                      <Ionicons name="information-circle-outline" size={24} color={colors.warning || '#F59E0B'} style={{ marginBottom: 6 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 12, paddingHorizontal: 12 }}>
                        {forecastError}
                      </Text>
                      <ScaleButton
                        onPress={() => fetchForecast(true)}
                        style={{
                          backgroundColor: colors.primaryMuted,
                          borderColor: colors.primary,
                          borderWidth: 1,
                          paddingHorizontal: 18,
                          paddingVertical: 8,
                          borderRadius: 12,
                        }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Retry Forecast</Text>
                      </ScaleButton>
                    </View>
                  ) : (
                    <ScaleButton
                      onPress={() => fetchForecast(true)}
                      style={{
                        backgroundColor: colors.primary,
                        paddingVertical: 12,
                        borderRadius: 14,
                        alignItems: 'center',
                        marginTop: 8,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Generate AI Forecast</Text>
                    </ScaleButton>
                  )}
                </View>
              )}
            </View>


            {/* Filtered Range Transactions */}
            <Text maxFontSizeMultiplier={1.3} style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>
              Transactions in Range ({filtered.length})
            </Text>
            {filtered.slice(0, 20).map((tx: any) => (
              <View
                key={tx._id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text maxFontSizeMultiplier={1.3} style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                    {tx.category || tx.budgetCategory || 'General'} · {new Date(tx.createdAt).toLocaleDateString()}
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
          </>
        )}
      </ScrollView>
    </View>
  );
}
