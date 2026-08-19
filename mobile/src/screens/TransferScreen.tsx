import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { authenticateWithBiometrics, triggerSuccessHaptic, triggerErrorHaptic } from '../lib/biometrics';

export default function TransferScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { orgId } = route.params || {};

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!amount || !description || !orgId) {
      await triggerErrorHaptic();
      Alert.alert("Error", "Please fill in amount, description, and ensure an organization is selected.");
      return;
    }

    // Require biometric confirmation before executing the transfer
    const authResult = await authenticateWithBiometrics(
      `Confirm transfer of ₱${amount} to ${destination ? destination.slice(0, 8) + '...' : 'destination'}`
    );

    if (!authResult.success) {
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/transactions', {
        organizationId: orgId,
        type: 'expense',
        amount: Number(amount),
        description: description,
        category: category || 'General',
        notes: destination ? `Destination: ${destination}` : undefined,
      });

      await triggerSuccessHaptic();
      Alert.alert("Success", "Transfer requested successfully!");
      navigation.goBack();
    } catch (err: any) {
      await triggerErrorHaptic();
      console.error(err);
      Alert.alert("Error", err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = Boolean(amount && description);

  return (
    <KeyboardAwareScrollView 
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      <View className="items-center mb-8">
        <View 
          style={{ backgroundColor: colors.infoBg, borderColor: colors.accentBlue }}
          className="w-16 h-16 rounded-full items-center justify-center border mb-4 shadow-sm"
        >
          <Ionicons name="send" size={28} color={colors.accentBlue} />
        </View>
        <Text style={{ color: colors.textPrimary }} className="text-xl font-bold">Send / Transfer Funds</Text>
        <Text style={{ color: colors.textSecondary }} className="text-center mt-2 text-sm">Request a transfer from the DAO treasury.</Text>
      </View>

      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="p-5 rounded-3xl border mb-6 shadow-sm"
      >
        <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Amount (PHP)</Text>
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

        <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Destination Address (Optional)</Text>
        <View 
          style={{ 
            backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="flex-row items-center rounded-xl px-4 py-3 mb-4 border"
        >
          <Ionicons name="wallet-outline" size={20} color={colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={{ color: colors.textPrimary }}
            className="flex-1 text-sm font-mono"
            placeholder="0x..."
            placeholderTextColor={colors.inputPlaceholder}
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="none"
          />
        </View>

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
            placeholder="What is this for?"
            placeholderTextColor={colors.inputPlaceholder}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">Budget Category</Text>
        <View 
          style={{ 
            backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
            borderColor: colors.border,
          }}
          className="flex-row items-center rounded-xl px-4 py-3 border"
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
      </View>

      <TouchableOpacity 
        style={{
          backgroundColor: isFormValid ? colors.accentBlue : colors.borderStrong,
          opacity: loading ? 0.7 : 1,
        }}
        className="py-4 rounded-2xl items-center mb-10 shadow-lg"
        onPress={handleTransfer}
        disabled={loading || !isFormValid}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-extrabold text-base">Confirm Transfer Request</Text>
        )}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
