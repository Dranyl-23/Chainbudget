/**
 * OrgBottomSheet.tsx
 *
 * Modern bottom sheet drawer for switching active organizations.
 * Displays organization metadata, Soulbound Token (SBT) membership level,
 * and handles seamless org switching with full Theme tokens.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';

type OrgBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  organizations: any[];
  activeOrgId: string | null;
  onSelectOrg: (orgId: string) => void;
};

export default function OrgBottomSheet({
  visible,
  onClose,
  organizations,
  activeOrgId,
  onSelectOrg,
}: OrgBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  return (
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
                maxHeight: '75%',
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
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
