/**
 * OrgBottomSheet.tsx
 *
 * Modern bottom sheet drawer for switching active organizations and creating new organizations.
 * Displays organization metadata, Soulbound Token (SBT) membership level,
 * and includes the complete mobile Organization Creation Wizard.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { triggerLightHaptic, triggerSuccessHaptic, triggerErrorHaptic } from '../lib/biometrics';
import api from '../lib/api';
import ScaleButton from './ScaleButton';

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

type OrgBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  organizations: any[];
  activeOrgId: string | null;
  onSelectOrg: (orgId: string) => void;
};

function OrgBottomSheet({
  visible,
  onClose,
  organizations,
  activeOrgId,
  onSelectOrg,
}: OrgBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { refreshUser } = useAuth();

  // Wizard state
  const [wizardVisible, setWizardVisible] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('student_org');
  const [orgDesc, setOrgDesc] = useState('');
  const [threshold, setThreshold] = useState('10000');
  const [approvals, setApprovals] = useState('2');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  if (!visible) return null;

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      Alert.alert('Required', 'Please enter an organization name.');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post('/organizations', {
        name: orgName.trim(),
        type: orgType,
        description: orgDesc.trim() || undefined,
        highValueThreshold: Number(threshold) || 10000,
        requiredApprovals: Number(approvals) || 2,
        isPrivate,
      });

      await triggerSuccessHaptic();
      Alert.alert('Success', `Organization "${orgName.trim()}" created successfully!`);
      setWizardVisible(false);
      setOrgName('');
      setOrgDesc('');
      if (refreshUser) await refreshUser();
      if (res.data?.organization?._id) {
        onSelectOrg(res.data.organization._id);
      }
      onClose();
    } catch (err: any) {
      await triggerErrorHaptic();
      Alert.alert('Error', err.response?.data?.error || 'Failed to create organization.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View 
            style={{ backgroundColor: colors.modalBackdrop }}
            className="flex-1 justify-end"
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 20) + 16,
                  maxHeight: '80%',
                }}
                className="rounded-t-[32px] border-t px-6 pt-4 shadow-2xl"
              >
                {/* Top Drag Indicator Pill */}
                <View className="items-center mb-4">
                  <View 
                    style={{ backgroundColor: colors.borderStrong }}
                    className="w-12 h-1.5 rounded-full"
                  />
                </View>

                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                  <View>
                    <Text style={{ color: colors.textPrimary }} className="text-xl font-extrabold">Switch Organization</Text>
                    <Text style={{ color: colors.textSecondary }} className="text-xs mt-0.5">
                      Select a workspace or DAO treasury to manage
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
                    className="w-8 h-8 rounded-full items-center justify-center border"
                  >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Organization List */}
                <ScrollView showsVerticalScrollIndicator={false}>
                  {organizations.map((org) => {
                    const isActive = org._id === activeOrgId;

                    return (
                      <TouchableOpacity
                        key={org._id}
                        activeOpacity={0.7}
                        onPress={() => {
                          triggerLightHaptic();
                          onSelectOrg(org._id);
                          onClose();
                        }}
                        style={{
                          backgroundColor: isActive ? colors.primaryMuted : colors.cardGlass,
                          borderColor: isActive ? colors.primary : colors.borderSubtle,
                        }}
                        className="flex-row items-center p-4 rounded-2xl mb-3 border shadow-sm"
                      >
                        {/* Org Avatar */}
                        <View
                          style={{
                            backgroundColor: isActive ? colors.primaryMuted : (isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary),
                            borderColor: isActive ? colors.primary : colors.border,
                          }}
                          className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border"
                        >
                          <Ionicons
                            name="business"
                            size={22}
                            color={isActive ? colors.primary : colors.textMuted}
                          />
                        </View>

                        {/* Org Details */}
                        <View className="flex-1 mr-2">
                          <View className="flex-row items-center gap-2">
                            <Text
                              style={{ color: isActive ? colors.primary : colors.textPrimary }}
                              className="font-bold text-base"
                              numberOfLines={1}
                            >
                              {org.name}
                            </Text>
                            {org.isDao && (
                              <View 
                                style={{ backgroundColor: colors.successBg, borderColor: colors.successBorder }}
                                className="px-2 py-0.5 rounded-full border"
                              >
                                <Text style={{ color: colors.success }} className="text-[9px] font-extrabold uppercase">
                                  DAO
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text style={{ color: colors.textMuted }} className="text-xs font-mono mt-0.5" numberOfLines={1}>
                            {org.vaultAddress || org.contractAddress
                              ? `${(org.vaultAddress || org.contractAddress).slice(0, 8)}...${(
                                  org.vaultAddress || org.contractAddress
                                ).slice(-6)}`
                              : 'Treasury Vault'}
                          </Text>
                        </View>

                        {/* Active Indicator */}
                        <Ionicons
                          name={isActive ? 'checkmark-circle' : 'chevron-forward'}
                          size={22}
                          color={isActive ? colors.primary : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}

                  {/* Create New Organization Button */}
                  <ScaleButton
                    onPress={() => setWizardVisible(true)}
                    style={{
                      backgroundColor: colors.primaryMuted,
                      borderColor: colors.primary + '50',
                      borderWidth: 1.5,
                      borderRadius: 18,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 6,
                      marginBottom: 16,
                      gap: 8,
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 14 }}>
                      Create New Organization
                    </Text>
                  </ScaleButton>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Organization Creation Wizard Modal */}
      <Modal
        visible={wizardVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWizardVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            maxHeight: '90%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="business" size={24} color={colors.primary} />
                <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>New Organization</Text>
              </View>
              <TouchableOpacity onPress={() => setWizardVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Organization Name *</Text>
              <TextInput
                style={{
                  backgroundColor: colors.background, color: colors.textPrimary,
                  borderColor: colors.border, borderWidth: 1, borderRadius: 12,
                  padding: 14, marginBottom: 16, fontSize: 15,
                }}
                placeholder="e.g. CS Student Council, Green Earth NGO"
                placeholderTextColor={colors.textMuted}
                value={orgName}
                onChangeText={setOrgName}
              />

              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8 }}>Organization Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {ORG_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setOrgType(t.value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      backgroundColor: orgType === t.value ? colors.primaryMuted : colors.background,
                      borderColor: orgType === t.value ? colors.primary : colors.border,
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name={t.icon as any}
                      size={14}
                      color={orgType === t.value ? colors.primary : colors.textMuted}
                    />
                    <Text style={{
                      color: orgType === t.value ? colors.primary : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: orgType === t.value ? '700' : '500',
                    }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Description (optional)</Text>
              <TextInput
                style={{
                  backgroundColor: colors.background, color: colors.textPrimary,
                  borderColor: colors.border, borderWidth: 1, borderRadius: 12,
                  padding: 14, marginBottom: 16, height: 70, fontSize: 14,
                }}
                placeholder="Brief description of the organization's mission..."
                placeholderTextColor={colors.textMuted}
                multiline
                value={orgDesc}
                onChangeText={setOrgDesc}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6, fontSize: 12 }}>
                    High-Value Threshold (₱)
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.background, color: colors.textPrimary,
                      borderColor: colors.border, borderWidth: 1, borderRadius: 12,
                      padding: 12, fontSize: 14,
                    }}
                    placeholder="10000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={threshold}
                    onChangeText={setThreshold}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6, fontSize: 12 }}>
                    Required Approvals
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.background, color: colors.textPrimary,
                      borderColor: colors.border, borderWidth: 1, borderRadius: 12,
                      padding: 12, fontSize: 14,
                    }}
                    placeholder="2"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={approvals}
                    onChangeText={setApprovals}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsPrivate(!isPrivate)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 24,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
                    {isPrivate ? '🔒 Private Organization' : '🌐 Public Transparency'}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                    {isPrivate
                      ? 'Transactions and budgets will be hidden from the public explorer.'
                      : 'Transactions will be visible on the public transparency portal.'}
                  </Text>
                </View>
                <Ionicons
                  name={isPrivate ? 'toggle' : 'toggle-outline'}
                  size={32}
                  color={isPrivate ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>

              <ScaleButton
                onPress={handleCreateOrg}
                disabled={creating}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Create Organization</Text>
                )}
              </ScaleButton>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default React.memo(OrgBottomSheet);
