/**
 * BudgetScreen.tsx — FP-2
 * Full budget category management: view utilization, add categories.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { triggerSuccessHaptic, triggerErrorHaptic } from '../lib/biometrics';

const PRESET_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
];

export default function BudgetScreen() {
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();

  const orgId: string = route.params?.orgId;

  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [catName, setCatName] = useState('');
  const [catAmount, setCatAmount] = useState('');
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);

  // Get user role in this org
  const myMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === orgId
  );
  const roleLevel = myMembership?.roleLevel || 4;
  const canManage = roleLevel <= 2;

  useEffect(() => {
    if (orgId) fetchBudgets();
  }, [orgId]);

  const fetchBudgets = async () => {
    try {
      const res = await api.get(`/budget?orgId=${orgId}`);
      setBudgets(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBudgets().then(() => setRefreshing(false));
  };

  const totalAllocated = budgets.reduce((s: number, b: any) => s + (b.allocatedAmount || 0), 0);
  const totalSpent = budgets.reduce((s: number, b: any) => s + (b.spentAmount || 0), 0);
  const totalRemaining = totalAllocated - totalSpent;

  const handleCreate = async () => {
    if (!catName.trim() || !catAmount) {
      Alert.alert('Missing Fields', 'Please enter a category name and amount.');
      return;
    }
    setCreating(true);
    try {
      await api.post('/budget', {
        organizationId: orgId,
        name: catName.trim(),
        allocatedAmount: Number(catAmount),
        color: catColor,
      });
      await triggerSuccessHaptic();
      setModalVisible(false);
      setCatName(''); setCatAmount(''); setCatColor(PRESET_COLORS[0]);
      fetchBudgets();
    } catch (err: any) {
      await triggerErrorHaptic();
      Alert.alert('Error', err.response?.data?.error || 'Failed to create category.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Allocated', value: totalAllocated, color: colors.primary },
            { label: 'Spent', value: totalSpent, color: colors.error },
            { label: 'Remaining', value: totalRemaining, color: colors.success },
          ].map(({ label, value, color }) => (
            <View key={label} style={{
              flex: 1, backgroundColor: colors.surface, borderColor: colors.border,
              borderWidth: 1, borderRadius: 16, padding: 12,
            }}>
              <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' }}>{label}</Text>
              <Text style={{ color, fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                ₱{value.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {/* Category List */}
        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
          Categories
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : budgets.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>No categories yet</Text>
            {canManage && (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Tap + to add a budget category</Text>
            )}
          </View>
        ) : (
          budgets.map((b: any) => {
            const pct = b.allocatedAmount > 0
              ? Math.round((b.spentAmount / b.allocatedAmount) * 100)
              : 0;
            const isOver = pct >= 100;
            const isHigh = pct >= 85;
            const barColor = isOver ? colors.error : isHigh ? colors.warning || '#F59E0B' : b.color || colors.primary;

            return (
              <View key={b._id} style={{
                backgroundColor: colors.surface, borderColor: colors.border,
                borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: b.color || colors.primary, marginRight: 8 }} />
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', flex: 1 }} numberOfLines={1}>{b.name}</Text>
                  </View>
                  {(isOver || isHigh) && (
                    <View style={{
                      backgroundColor: isOver ? colors.errorBg : '#FEF3C7',
                      borderColor: isOver ? colors.errorBorder : '#FCD34D',
                      borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2,
                    }}>
                      <Text style={{ color: isOver ? colors.error : '#D97706', fontSize: 9, fontWeight: '800' }}>
                        {isOver ? 'OVER BUDGET' : 'HIGH USAGE'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ height: 8, backgroundColor: colors.cardGlass, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <View style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: barColor, borderRadius: 4 }} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    ₱{(b.spentAmount || 0).toLocaleString()} of ₱{(b.allocatedAmount || 0).toLocaleString()}
                  </Text>
                  <Text style={{ color: barColor, fontSize: 11, fontWeight: '700' }}>{pct}%</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB — Level 1 & 2 only */}
      {canManage && (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            position: 'absolute', bottom: 24, right: 24,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.primary,
            justifyContent: 'center', alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
          }}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add Category Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>Add Budget Category</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary, marginBottom: 6, fontWeight: '600' }}>Category Name</Text>
            <TextInput
              style={{
                backgroundColor: colors.background, color: colors.textPrimary,
                borderColor: colors.border, borderWidth: 1, borderRadius: 10,
                padding: 12, marginBottom: 16,
              }}
              placeholder="e.g. Events, Supplies, Transport"
              placeholderTextColor={colors.textMuted}
              value={catName}
              onChangeText={setCatName}
            />

            <Text style={{ color: colors.textSecondary, marginBottom: 6, fontWeight: '600' }}>Allocated Amount (PHP)</Text>
            <TextInput
              style={{
                backgroundColor: colors.background, color: colors.textPrimary,
                borderColor: colors.border, borderWidth: 1, borderRadius: 10,
                padding: 12, marginBottom: 16,
              }}
              placeholder="e.g. 25000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={catAmount}
              onChangeText={setCatAmount}
            />

            <Text style={{ color: colors.textSecondary, marginBottom: 10, fontWeight: '600' }}>Color</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCatColor(c)}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: c,
                    borderWidth: catColor === c ? 3 : 0,
                    borderColor: colors.textPrimary,
                  }}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating}
              style={{ backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: 'center' }}
            >
              {creating
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Create Category</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
