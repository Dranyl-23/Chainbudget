import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { authenticateWithBiometrics, triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';
import ScaleButton from '../components/ScaleButton';
import SuccessCelebrationModal from '../components/SuccessCelebrationModal';

export default function TransferScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { activeOrgId } = useOrg();
  const { showToast } = useToast();
  const orgId = route.params?.orgId || activeOrgId;

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);

  // Celebration state
  const [celebration, setCelebration] = useState<{ visible: boolean; title: string; subtitle?: string }>({
    visible: false,
    title: '',
  });

  useEffect(() => {
    if (orgId) {
      fetchCategories(orgId);
    }
  }, [orgId]);

  const fetchCategories = async (targetOrgId: string) => {
    try {
      const res = await api.get(`/budget?orgId=${targetOrgId}`);
      const cats = res.data || [];
      setCategories(cats);
      if (cats.length > 0 && !category) {
        setCategory(cats[0].name);
      }
    } catch {
      // Fallback
    }
  };

  const handleRequest = async () => {
    if (!amount || !description || !orgId) {
      showToast("Please fill in amount and description.", 'warning');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("Please enter a valid positive amount.", 'warning');
      return;
    }

    const MAX_AMOUNT = 10_000_000;
    if (numAmount > MAX_AMOUNT) {
      showToast(`Amount cannot exceed ₱${MAX_AMOUNT.toLocaleString()}.`, 'warning');
      return;
    }

    if (destination && destination.trim()) {
      const ethAddressRegex = /^0x[0-9a-fA-F]{40}$/;
      if (!ethAddressRegex.test(destination.trim())) {
        showToast("Please enter a valid Ethereum wallet address (0x...)", 'warning');
        return;
      }
    }

    // Require biometric confirmation before submitting the fund request
    const authResult = await authenticateWithBiometrics(
      `Confirm fund request for ₱${numAmount.toLocaleString()}`
    );

    if (!authResult.success) {
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/transactions', {
        organizationId: orgId,
        type: 'expense',
        amount: numAmount,
        description: description.trim(),
        category: category || 'General',
        notes: destination ? `Destination Address: ${destination}` : undefined,
      });

      setCelebration({
        visible: true,
        title: 'Request Submitted!',
        subtitle: `Expense request for ₱${numAmount.toLocaleString()} sent for executive approval`,
      });
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || err.message || "Failed to submit request.", 'error');
    } finally {
      setLoading(false);
    }
  };



  const isFormValid = Boolean(amount && description && orgId);

  return (
    <KeyboardAwareScrollView 
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6 pt-1">
        <Text style={{ color: colors.textPrimary }} className="text-2xl font-extrabold">Request Funds</Text>
        <Text style={{ color: colors.textSecondary }} className="mt-1 text-sm">
          Submit an expense request to the DAO for executive review & approval.
        </Text>
      </View>

      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="p-5 rounded-3xl border mb-6 shadow-sm"
      >
        <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Requested Amount (PHP)</Text>
        <TextInput
          style={{ 
            color: colors.textPrimary, 
            borderBottomColor: colors.borderSubtle 
          }}
          className="text-4xl font-extrabold pb-2 border-b mb-4"
          placeholder="0.00"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Description</Text>
        <View 
          style={{ 
            backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="flex-row items-center rounded-xl px-4 py-3 mb-4 border"
        >
          <TextInput
            style={{ color: colors.textPrimary }}
            className="flex-1 text-sm"
            placeholder="e.g. Project Supplies, Catering, Travel"
            placeholderTextColor={colors.inputPlaceholder}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Budget Category</Text>
        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1 mb-4">
            {categories.map((cat) => {
              const isSelected = category === cat.name;
              return (
                <TouchableOpacity
                  key={cat._id}
                  onPress={() => {
                    triggerLightHaptic();
                    setCategory(cat.name);
                  }}
                  style={{
                    backgroundColor: isSelected ? colors.primaryMuted : colors.cardGlass,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: 1.5,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    marginRight: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: cat.color || colors.primary,
                      marginRight: 6,
                    }}
                  />
                  <Text
                    style={{
                      color: isSelected ? colors.primary : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                      fontSize: 13,
                    }}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View 
            style={{ 
              backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
              borderColor: colors.border,
            }}
            className="flex-row items-center rounded-xl px-4 py-3 mb-4 border"
          >
            <TextInput
              style={{ color: colors.textPrimary }}
              className="flex-1 text-sm"
              placeholder="e.g. Marketing, Operations"
              placeholderTextColor={colors.inputPlaceholder}
              value={category}
              onChangeText={setCategory}
            />
          </View>
        )}

        <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Destination Address (Optional)</Text>
        <View 
          style={{ 
            backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="flex-row items-center rounded-xl px-4 py-3 border"
        >
          <Ionicons name="wallet-outline" size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={{ color: colors.textPrimary }}
            className="flex-1 text-sm font-mono"
            placeholder="0x... (leave empty for personal wallet)"
            placeholderTextColor={colors.inputPlaceholder}
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="none"
          />
        </View>
      </View>

      <ScaleButton 
        style={{
          backgroundColor: isFormValid ? colors.primary : colors.borderStrong,
          opacity: loading ? 0.7 : 1,
        }}
        className="py-4 rounded-2xl items-center mb-10 shadow-lg"
        onPress={handleRequest}
        disabled={loading || !isFormValid}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Submit fund request for review"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-extrabold text-base">Submit Fund Request</Text>
        )}
      </ScaleButton>

      {/* Celebration Modal */}
      <SuccessCelebrationModal
        visible={celebration.visible}
        title={celebration.title}
        subtitle={celebration.subtitle}
        onDismiss={() => {
          setCelebration({ visible: false, title: '' });
          navigation.goBack();
        }}
      />
    </KeyboardAwareScrollView>
  );
}


