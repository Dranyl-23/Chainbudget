import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';

export default function ScannerScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { activeOrgId, organizations } = useOrg();
  const { showToast } = useToast();

  const currentOrgId = route.params?.orgId || activeOrgId;

  const [image, setImage] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentOrgId) {
      fetchCategories(currentOrgId);
    }
  }, [currentOrgId]);

  const fetchCategories = async (orgId: string) => {
    try {
      const res = await api.get(`/budget?orgId=${orgId}`);
      const cats = res.data || [];
      setCategories(cats);
      if (cats.length > 0 && !selectedCategory) {
        setSelectedCategory(cats[0].name);
      }
    } catch {
      // Fallback
    }
  };

  const pickImage = async (useCamera: boolean) => {
    await triggerLightHaptic();
    let result;
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showToast('Camera permission is required to scan receipts.', 'warning');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.5,
      });
    }

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      performRealAIScan(result.assets[0].uri);
    }
  };

  const performRealAIScan = async (uri: string) => {
    setIsScanning(true);
    try {
      const filename = uri.split('/').pop() || 'receipt.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const formData = new FormData();
      formData.append('receipt', {
        uri,
        name: filename,
        type,
      } as any);

      const res = await api.post('/ai/scan-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000, // AI multimodal processing can take 15-30s
      });

      setAmount(res.data.totalAmount?.toString() || '');
      setDescription(`${res.data.merchant ? res.data.merchant + ' - ' : ''}Receipt`);

      // If AI suggested a category and it matches one of our org categories, auto-select it
      if (res.data.category) {
        const matched = categories.find(
          (c) => c.name.toLowerCase() === res.data.category.toLowerCase()
        );
        if (matched) {
          setSelectedCategory(matched.name);
        }
      }

      showToast('AI scanned receipt details successfully!', 'success');
    } catch (err: any) {
      console.error("AI Scan Error:", err);
      showToast(err.response?.data?.error || 'Failed to scan receipt. Please enter manually.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const submitRequest = async () => {
    if (!amount || !description) {
      showToast('Please fill in amount and description.', 'warning');
      return;
    }

    if (!currentOrgId) {
      showToast('No organization selected.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/transactions`, {
        organizationId: currentOrgId,
        type: 'expense',
        amount: Number(amount),
        description,
        category: selectedCategory || 'General',
      });

      showToast('Fund request submitted successfully!', 'success');
      setImage(null);
      setAmount('');
      setDescription('');
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to submit request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <KeyboardAwareScrollView 
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: (insets.top || 0) + 16, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      <View className="mb-6">
        <Text style={{ color: colors.textPrimary }} className="text-2xl font-bold mb-1">Request Funds</Text>
        <Text style={{ color: colors.textSecondary }} className="text-sm">
          Scan a receipt using AI or enter details manually to request reimbursement.
        </Text>
      </View>

      {/* Action Buttons: Camera & Gallery */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <TouchableOpacity 
          onPress={() => pickImage(true)}
          activeOpacity={0.7}
          style={{ 
            flex: 1,
            height: 52,
            backgroundColor: colors.surface, 
            borderColor: colors.accentCyan + (isDark ? '60' : '80'),
            borderWidth: 1.5,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="camera" size={20} color={colors.accentCyan} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.accentCyan, fontWeight: '700', fontSize: 14, textAlign: 'center' }}>
            Camera
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => pickImage(false)}
          activeOpacity={0.7}
          style={{ 
            flex: 1,
            height: 52,
            backgroundColor: colors.surface, 
            borderColor: colors.primary + (isDark ? '60' : '80'),
            borderWidth: 1.5,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="image" size={20} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14, textAlign: 'center' }}>
            Gallery
          </Text>
        </TouchableOpacity>
      </View>

      {image && (
        <View className="mb-6 items-center">
          <Image source={{ uri: image }} className="w-48 h-64 rounded-2xl border" style={{ borderColor: colors.border }} resizeMode="cover" />
          {isScanning && (
            <View 
              style={{ backgroundColor: colors.modalBackdrop }}
              className="absolute inset-0 rounded-2xl items-center justify-center"
            >
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={{ color: colors.primary }} className="font-bold mt-2">AI Scanning...</Text>
            </View>
          )}
        </View>
      )}

      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="p-5 rounded-3xl border mb-8 shadow-sm space-y-4"
      >
        <View className="mb-4">
          <Text style={{ color: colors.textSecondary }} className="text-xs uppercase tracking-widest font-bold mb-2">
            Amount (PHP)
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.inputPlaceholder}
            style={{ 
              backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
            className="border p-4 rounded-2xl text-lg font-bold"
          />
        </View>

        <View className="mb-4">
          <Text style={{ color: colors.textSecondary }} className="text-xs uppercase tracking-widest font-bold mb-2">
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this for?"
            placeholderTextColor={colors.inputPlaceholder}
            style={{ 
              backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
              borderColor: colors.border,
              color: colors.textPrimary,
            }}
            className="border p-4 rounded-2xl"
            multiline
          />
        </View>

        <View>
          <Text style={{ color: colors.textSecondary }} className="text-xs uppercase tracking-widest font-bold mb-2">
            Budget Category
          </Text>
          {categories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat._id}
                    onPress={() => {
                      triggerLightHaptic();
                      setSelectedCategory(cat.name);
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
            <TextInput
              value={selectedCategory}
              onChangeText={setSelectedCategory}
              placeholder="e.g. Operations, Supplies, Travel"
              placeholderTextColor={colors.inputPlaceholder}
              style={{
                backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
              className="border p-4 rounded-2xl"
            />
          )}
        </View>
      </View>


      <TouchableOpacity 
        onPress={submitRequest}
        disabled={isSubmitting || isScanning}
        style={{
          backgroundColor: isSubmitting || isScanning ? colors.borderStrong : colors.primary,
        }}
        className="w-full py-4 rounded-2xl items-center justify-center mb-10 shadow-lg"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white font-extrabold text-base">Submit Request</Text>
        )}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
