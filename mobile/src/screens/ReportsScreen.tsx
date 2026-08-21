/**
 * ReportsScreen.tsx — FP-5 + FP-7
 * Financial summary, time-range charts, AI Financial Advisor (forecast).
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';

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
  const { colors } = useTheme();
  const orgId: string = route.params?.orgId;

  const [rangeIdx, setRangeIdx] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastExpanded, setForecastExpanded] = useState(false);
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

  const fetchForecast = async () => {
    if (forecast) {
      setForecastExpanded(!forecastExpanded);
      return;
    }
    setLoadingForecast(true);
    setForecastExpanded(true);
    try {
      const res = await api.get(`/ai/forecast?orgId=${orgId}`);
      setForecast(res.data);
    } catch (err: any) {
      Alert.alert('AI Error', err.response?.data?.error || 'Could not load AI forecast.');
      setForecastExpanded(false);
    } finally {
      setLoadingForecast(false);
    }
  };

  // Filter transactions by selected time range
  const monthsAgo = TIME_RANGES[rangeIdx].months;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsAgo);
  const filtered = transactions.filter(tx => new Date(tx.createdAt) >= cutoff);
  const totalIncome = filtered.filter((t: any) => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = filtered.filter((t: any) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  const healthColor = forecast?.status === 'good' ? colors.success
    : forecast?.status === 'warning' ? colors.warning || '#F59E0B'
    : forecast?.status === 'critical' ? colors.error
    : colors.textMuted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Time Range Selector */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {TIME_RANGES.map((r, i) => (
            <TouchableOpacity
              key={r.label}
              onPress={() => { setRangeIdx(i); triggerLightHaptic(); }}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 12,
                backgroundColor: rangeIdx === i ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: rangeIdx === i ? colors.primary : colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: rangeIdx === i ? '#fff' : colors.textMuted, fontWeight: '700', fontSize: 13 }}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Summary Cards */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Transactions', value: filtered.length.toString(), icon: 'receipt-outline', color: colors.primary },
                { label: 'Income', value: formatCurrency(totalIncome), icon: 'trending-up-outline', color: colors.success },
                { label: 'Expenses', value: formatCurrency(totalExpense), icon: 'trending-down-outline', color: colors.error },
                { label: 'Net Balance', value: formatCurrency(netBalance), icon: 'analytics-outline', color: netBalance >= 0 ? colors.success : colors.error },
              ].map(({ label, value, icon, color }) => (
                <View key={label} style={{
                  width: '47%', backgroundColor: colors.surface, borderColor: colors.border,
                  borderWidth: 1, borderRadius: 18, padding: 14,
                }}>
                  <Ionicons name={icon as any} size={20} color={color} style={{ marginBottom: 6 }} />
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
                  <Text style={{ color, fontWeight: '800', fontSize: 18 }}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Simple Bar Visualization */}
            {filtered.length > 0 && (
              <View style={{
                backgroundColor: colors.surface, borderColor: colors.border,
                borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 20,
              }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: 16 }}>Income vs Expenses</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 24, height: 100 }}>
                  {[
                    { label: 'Income', value: totalIncome, color: colors.success },
                    { label: 'Expenses', value: totalExpense, color: colors.error },
                  ].map(({ label, value, color }) => {
                    const max = Math.max(totalIncome, totalExpense, 1);
                    const barH = Math.round((value / max) * 80);
                    return (
                      <View key={label} style={{ alignItems: 'center' }}>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>
                          {formatCurrency(value)}
                        </Text>
                        <View style={{ width: 48, height: barH, backgroundColor: color, borderRadius: 8 }} />
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* AI Financial Advisor — FP-7 */}
            <TouchableOpacity
              onPress={fetchForecast}
              style={{
                backgroundColor: colors.surface, borderColor: colors.primary + '60',
                borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>AI Financial Advisor</Text>
                </View>
                <Ionicons name={forecastExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </View>

              {forecastExpanded && (
                <View style={{ marginTop: 16 }}>
                  {loadingForecast ? (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Analyzing finances...</Text>
                    </View>
                  ) : forecast ? (
                    <>
                      {/* Health Badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{
                          backgroundColor: healthColor + '20', borderColor: healthColor + '60',
                          borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
                        }}>
                          <Text style={{ color: healthColor, fontWeight: '800', textTransform: 'uppercase', fontSize: 11 }}>
                            {forecast.status || 'Unknown'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
                        {forecast.summary || forecast.advice}
                      </Text>

                      {(forecast.insights || forecast.recommendations || []).map((insight: string, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                          <Ionicons name="bulb-outline" size={14} color={colors.primary} style={{ marginRight: 6, marginTop: 2 }} />
                          <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 }}>{insight}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>

            {/* Recent Transactions in Range */}
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>
              Transactions ({filtered.length})
            </Text>
            {filtered.slice(0, 20).map((tx: any) => (
              <View key={tx._id} style={{
                backgroundColor: colors.surface, borderColor: colors.border,
                borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {tx.category || tx.budgetCategory || 'Uncategorized'} · {new Date(tx.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{
                  color: tx.type === 'expense' ? colors.error : colors.success,
                  fontWeight: '700', fontSize: 14,
                }}>
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
