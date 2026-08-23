/**
 * BudgetScreen.tsx — FP-2
 * Full budget category management: view utilization, add categories, edit, and delete.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';

const PRESET_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#84CC16',
];

export default function BudgetScreen() {
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activeOrgId } = useOrg();
  const { showToast } = useToast();
  const { colors } = useTheme();

  const orgId: string = route.params?.orgId || activeOrgId;

  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [catName, setCatName] = useState('');
  const [catAmount, setCatAmount] = useState('');
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);

  // Get user role in this org
  const myMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization) === orgId
  );
  const roleLevel = myMembership?.roleLevel || 4;
  const canManage = roleLevel <= 2 || (user as any)?.isSuperAdmin;

  // Android BackHandler for modal
  useEffect(() => {
    const onBackPress = () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [modalVisible]);

  useEffect(() => {
    if (orgId) fetchBudgets();
    else setLoading(false);
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

  const totalAllocated = budgets.reduce(
    (s: number, b: any) => s + (b.allocated ?? b.allocatedAmount ?? 0),
    0
  );
  const totalSpent = budgets.reduce(
    (s: number, b: any) => s + (b.spent ?? b.spentAmount ?? 0),
    0
  );
  const totalRemaining = totalAllocated - totalSpent;

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setCatName('');
    setCatAmount('');
    setCatColor(PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const openEditModal = (budget: any) => {
    if (!canManage) return;
    setIsEditing(true);
    setEditingId(budget._id);
    setCatName(budget.name || '');
    setCatAmount((budget.allocated ?? budget.allocatedAmount ?? 0).toString());
    setCatColor(budget.color || PRESET_COLORS[0]);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!catName.trim() || !catAmount) {
      showToast('Please enter a category name and amount.', 'warning');
      return;
    }
    const allocatedNum = Number(catAmount);
    if (isNaN(allocatedNum) || allocatedNum <= 0) {
      showToast('Please enter a valid positive number.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editingId) {
        await api.put(`/budget/${editingId}`, {
          name: catName.trim(),
          allocated: allocatedNum,
          allocatedAmount: allocatedNum,
          color: catColor,
        });
        showToast('Category updated successfully!', 'success');
      } else {
        await api.post('/budget', {
          organizationId: orgId,
          name: catName.trim(),
          allocated: allocatedNum,
          allocatedAmount: allocatedNum,
          color: catColor,
        });
        showToast('Category created successfully!', 'success');
      }
      setModalVisible(false);
      setCatName('');
      setCatAmount('');
      fetchBudgets();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save category.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (budget: any) => {
    if (!canManage) return;
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${budget.name}"? Past transactions categorized under it will remain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/budget/${budget._id}`);
              showToast('Category deleted successfully', 'info');
              setModalVisible(false);
              fetchBudgets();
            } catch (err: any) {
              showToast(err.response?.data?.error || 'Failed to delete category.', 'error');
            }
          },
        },
      ]
    );
  };


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Allocated', value: totalAllocated, color: colors.primary },
            { label: 'Spent', value: totalSpent, color: colors.error },
            { label: 'Remaining', value: totalRemaining, color: colors.success },
          ].map(({ label, value, color }) => (
            <View
              key={label}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: 12,
              }}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 10,
                  fontWeight: '700',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </Text>
              <Text style={{ color, fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                ₱{value.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        {/* Category List */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 18 }}>
            Categories
          </Text>
          {canManage && budgets.length > 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
              Tap a category to edit
            </Text>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : budgets.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>
              No categories yet
            </Text>
            {canManage && (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                Tap + to add a budget category
              </Text>
            )}
          </View>
        ) : (
          budgets.map((b: any) => {
            const allocated = b.allocated ?? b.allocatedAmount ?? 0;
            const spent = b.spent ?? b.spentAmount ?? 0;
            const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
            const isOver = pct >= 100;
            const isHigh = pct >= 85;
            const barColor = isOver
              ? colors.error
              : isHigh
              ? colors.warning || '#F59E0B'
              : b.color || colors.primary;

            return (
              <TouchableOpacity
                key={b._id}
                activeOpacity={canManage ? 0.7 : 1}
                onPress={() => canManage && openEditModal(b)}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: b.color || colors.primary,
                        marginRight: 8,
                      }}
                    />
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: '700', flex: 1 }}
                      numberOfLines={1}
                    >
                      {b.name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {(isOver || isHigh) && (
                      <View
                        style={{
                          backgroundColor: isOver ? colors.errorBg : '#FEF3C7',
                          borderColor: isOver ? colors.errorBorder : '#FCD34D',
                          borderWidth: 1,
                          borderRadius: 12,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: isOver ? colors.error : '#D97706',
                            fontSize: 9,
                            fontWeight: '800',
                          }}
                        >
                          {isOver ? 'OVER BUDGET' : 'HIGH USAGE'}
                        </Text>
                      </View>
                    )}
                    {canManage && (
                      <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
                    )}
                  </View>
                </View>

                <View
                  style={{
                    height: 8,
                    backgroundColor: colors.cardGlass,
                    borderRadius: 4,
                    overflow: 'hidden',
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      height: '100%',
                      backgroundColor: barColor,
                      borderRadius: 4,
                    }}
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    ₱{spent.toLocaleString()} of ₱{allocated.toLocaleString()}
                  </Text>
                  <Text style={{ color: barColor, fontSize: 11, fontWeight: '700' }}>
                    {pct}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB — Level 1 & 2 only (Option 2 Web3 Indigo/Violet) */}
      {canManage && (
        <TouchableOpacity
          onPress={openCreateModal}
          activeOpacity={0.85}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            width: 58,
            height: 58,
            borderRadius: 29,
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 29,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Create / Edit Category Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
                {isEditing ? 'Edit Category' : 'Add Budget Category'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary, marginBottom: 6, fontWeight: '600' }}>
              Category Name
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
              }}
              placeholder="e.g. Events, Supplies, Transport"
              placeholderTextColor={colors.textMuted}
              value={catName}
              onChangeText={setCatName}
            />

            <Text style={{ color: colors.textSecondary, marginBottom: 6, fontWeight: '600' }}>
              Allocated Amount (PHP)
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
              }}
              placeholder="e.g. 25000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={catAmount}
              onChangeText={setCatAmount}
            />

            <Text style={{ color: colors.textSecondary, marginBottom: 10, fontWeight: '600' }}>
              Color
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCatColor(c)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c,
                    borderWidth: catColor === c ? 3 : 0,
                    borderColor: colors.textPrimary,
                  }}
                />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {isEditing && (
                <TouchableOpacity
                  onPress={() => handleDelete({ _id: editingId, name: catName })}
                  style={{
                    backgroundColor: colors.errorBg,
                    borderColor: colors.errorBorder,
                    borderWidth: 1,
                    padding: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                  }}
                >
                  <Text style={{ color: colors.error, fontWeight: '800', fontSize: 15 }}>
                    Delete
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleSave}
                disabled={submitting}
                activeOpacity={0.85}
                style={{
                  flex: isEditing ? 2 : 1,
                  shadowColor: '#6366F1',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              >
                <LinearGradient
                  colors={['#4F46E5', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                      {isEditing ? 'Save Changes' : 'Create Category'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

