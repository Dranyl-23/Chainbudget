import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { triggerLightHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '../lib/biometrics';
import AnimatedToggleSwitch from '../components/AnimatedToggleSwitch';
import api from '../lib/api';

const ORG_TYPES = [
  { value: 'student_org', label: 'Student Org', icon: 'school-outline' },
  { value: 'barangay', label: 'Barangay / LGU', icon: 'business-outline' },
  { value: 'homeowners_association', label: 'Homeowners (HOA)', icon: 'key-outline' },
  { value: 'ngo', label: 'NGO / Non-Profit', icon: 'heart-outline' },
  { value: 'cooperative', label: 'Cooperative', icon: 'people-outline' },
  { value: 'church', label: 'Church / Religious', icon: 'home-outline' },
  { value: 'sports_club', label: 'Sports / Club', icon: 'trophy-outline' },
  { value: 'startup', label: 'Startup / Company', icon: 'rocket-outline' },
  { value: 'family', label: 'Family / Estate', icon: 'people-circle-outline' },
  { value: 'fundraising', label: 'Fundraising / Charity', icon: 'gift-outline' },
];

export default function CreateOrganizationScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { refreshUser } = useAuth();
  const { refreshOrgs, setActiveOrgId } = useOrg();

  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('student_org');
  const [orgDesc, setOrgDesc] = useState('');
  const [threshold, setThreshold] = useState('10000');
  const [approvals, setApprovals] = useState('2');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdOrgData, setCreatedOrgData] = useState<any>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      Alert.alert('Required', 'Please enter an organization name.');
      return;
    }

    setCreating(true);
    await triggerLightHaptic();

    try {
      const res = await api.post('/organizations', {
        name: orgName.trim(),
        type: orgType,
        description: orgDesc.trim() || undefined,
        highValueThreshold: Number(threshold) || 10000,
        requiredApprovals: Number(approvals) || 2,
        isPrivate,
      });

      const newOrg = res.data?.organization || res.data;
      setCreatedOrgData(newOrg);

      await triggerSuccessHaptic();

      // Refresh contexts
      if (refreshUser) await refreshUser();
      if (refreshOrgs) await refreshOrgs();

      if (newOrg?._id) {
        setActiveOrgId(newOrg._id);
      }

      // Show Custom Success Celebration Modal
      setShowSuccessModal(true);
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();

    } catch (err: any) {
      await triggerErrorHaptic();
      Alert.alert('Creation Error', err.response?.data?.error || 'Failed to create organization. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const selectedTypeObj = ORG_TYPES.find(t => t.value === orgType);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Card */}
        <LinearGradient
          colors={isDark ? ['#1e1b4b', '#0f172a'] : ['#e0e7ff', '#f8fafc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 20,
            marginBottom: 24,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: colors.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
              borderWidth: 1,
              borderColor: colors.primary + '40',
            }}
          >
            <Ionicons name="business" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800' }}>
              Create Organization
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 16 }}>
              Set up a transparent on-chain treasury with multi-signature governance.
            </Text>
          </View>
        </LinearGradient>

        {/* Section 1: Organization Name */}
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          1. Organization Name *
        </Text>
        <TextInput
          value={orgName}
          onChangeText={setOrgName}
          placeholder="e.g. CS Student Council, Apex DAO"
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: '600',
            marginBottom: 20,
          }}
        />

        {/* Section 2: Organization Category */}
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          2. Organization Type
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {ORG_TYPES.map((t) => {
            const isSelected = orgType === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => {
                  triggerLightHaptic();
                  setOrgType(t.value);
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 13,
                  paddingVertical: 9,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  backgroundColor: isSelected ? colors.primaryMuted : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                  gap: 6,
                }}
              >
                <Ionicons
                  name={t.icon as any}
                  size={15}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
                <Text
                  style={{
                    color: isSelected ? colors.primary : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: isSelected ? '700' : '500',
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section 3: Description */}
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          3. Description (Optional)
        </Text>
        <TextInput
          value={orgDesc}
          onChangeText={setOrgDesc}
          placeholder="Brief description of the organization's mission and purpose..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: colors.textPrimary,
            fontSize: 14,
            minHeight: 80,
            marginBottom: 20,
          }}
        />

        {/* Section 4: Governance & Multi-Sig Settings */}
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          4. Governance & Multi-Sig Thresholds
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            padding: 16,
            marginBottom: 20,
          }}
        >
          {/* High Value Threshold */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                High-Value Threshold
              </Text>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
                ₱{Number(threshold || 0).toLocaleString()}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>
              Transactions equal or exceeding this amount will automatically require multi-signature executive approvals.
            </Text>
            <TextInput
              value={threshold}
              onChangeText={setThreshold}
              keyboardType="numeric"
              placeholder="10000"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: colors.textPrimary,
                fontSize: 14,
                fontWeight: '600',
              }}
            />
          </View>

          {/* Required Approvals Stepper */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                Required Approver Signatures
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                Number of executives required to authorize payout
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  const cur = Math.max(1, Number(approvals || 2) - 1);
                  setApprovals(cur.toString());
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: colors.primaryMuted,
                  borderWidth: 1,
                  borderColor: colors.primary + '30',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="remove" size={18} color={colors.primary} />
              </TouchableOpacity>

              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800', minWidth: 20, textAlign: 'center' }}>
                {approvals}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  const cur = Math.min(10, Number(approvals || 2) + 1);
                  setApprovals(cur.toString());
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: colors.primaryMuted,
                  borderWidth: 1,
                  borderColor: colors.primary + '30',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section 5: Public vs Private Ledger Toggle */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            padding: 16,
            marginBottom: 28,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, marginRight: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Ionicons
                name={isPrivate ? 'lock-closed' : 'globe-outline'}
                size={16}
                color={isPrivate ? colors.warning : colors.success}
              />
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                {isPrivate ? 'Private Organization' : 'Public Transparency Ledger'}
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 15 }}>
              {isPrivate
                ? 'Only invited members can view the transactions and treasury reports.'
                : 'Transactions are published to the public portal for community transparency.'}
            </Text>
          </View>

          <AnimatedToggleSwitch
            value={!isPrivate}
            onValueChange={(val: boolean) => {
              triggerLightHaptic();
              setIsPrivate(!val);
            }}
            activeColor="#10B981"
            inactiveColor={isDark ? '#334155' : '#CBD5E1'}
          />
        </View>

        {/* Create Submit Button (Option 2 Executive Web3 Indigo/Violet) */}
        <TouchableOpacity
          onPress={handleCreateOrg}
          disabled={creating || !orgName.trim()}
          activeOpacity={0.85}
          style={{
            opacity: creating || !orgName.trim() ? 0.6 : 1,
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 18,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {creating ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>
                  Creating Organization...
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 }}>
                Deploy & Create Organization
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Custom Success Celebration Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              backgroundColor: isDark ? '#13121d' : '#ffffff',
              borderColor: colors.border,
              borderWidth: 1.5,
              borderRadius: 28,
              padding: 24,
              width: '100%',
              maxWidth: 340,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* Animated Pulse Ring + Business Icon */}
            <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 18, marginTop: 4 }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 86,
                  height: 86,
                  borderRadius: 43,
                  backgroundColor: colors.successBg || 'rgba(34, 197, 94, 0.15)',
                  borderWidth: 1.5,
                  borderColor: colors.successBorder || 'rgba(34, 197, 94, 0.3)',
                  transform: [{ scale: pulseAnim }],
                }}
              />
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#10B981',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                <Ionicons name="business" size={32} color="#ffffff" />
              </LinearGradient>
            </View>

            {/* Title & Subtitle */}
            <Text style={{ color: colors.textPrimary }} className="text-xl font-black text-center mb-2">
              Organization Created! 🎉
            </Text>
            <Text style={{ color: colors.textSecondary }} className="text-xs text-center leading-5 mb-5 px-2">
              "{createdOrgData?.name || orgName}" is ready. You are now the Founder (Level 1 Admin).
            </Text>

            {/* Metadata Card */}
            <View
              style={{
                backgroundColor: colors.cardGlass || (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: 16,
                padding: 12,
                width: '100%',
                marginBottom: 20,
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text style={{ color: colors.textMuted }} className="text-xs">Category:</Text>
                <Text style={{ color: colors.primary }} className="text-xs font-bold">
                  {selectedTypeObj?.label || 'Organization'}
                </Text>
              </View>

              <View className="flex-row items-center justify-between mb-2">
                <Text style={{ color: colors.textMuted }} className="text-xs">Multi-Sig Signers:</Text>
                <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                  {approvals} Signatures Required
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text style={{ color: colors.textMuted }} className="text-xs">Ledger Access:</Text>
                <Text style={{ color: isPrivate ? colors.warning : colors.success }} className="text-xs font-bold">
                  {isPrivate ? 'Private' : 'Public Ledger'}
                </Text>
              </View>
            </View>

            {/* Go to Dashboard Action */}
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                setShowSuccessModal(false);
                navigation.goBack();
              }}
              activeOpacity={0.85}
              style={{
                width: '100%',
                shadowColor: '#6366F1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                  Open Organization Dashboard
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
