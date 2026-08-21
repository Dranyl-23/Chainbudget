/**
 * ApprovalConfirmModal.tsx
 *
 * Bottom sheet modal presented before cryptographic signing of approval/rejection.
 * Provides clear context, summary of transaction details, comment input,
 * and explanation of the on-device biometric signature.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { triggerLightHaptic } from '../lib/biometrics';

type ApprovalConfirmModalProps = {
  visible: boolean;
  tx: any;
  action: 'approved' | 'rejected' | null;
  onConfirm: (comment: string) => void;
  onClose: () => void;
  isSigning: boolean;
};

function ApprovalConfirmModal({
  visible,
  tx,
  action,
  onConfirm,
  onClose,
  isSigning,
}: ApprovalConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (visible && action) {
      setComment(action === 'approved' ? 'Approved via mobile' : 'Rejected via mobile');
    }
  }, [visible, action]);

  useEffect(() => {
    const onBackPress = () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible || !tx || !action) return null;

  const isApprove = action === 'approved';
  const actionColor = isApprove ? colors.success : colors.error;
  const actionBg = isApprove ? colors.successBg : colors.errorBg;
  const actionBorder = isApprove ? colors.successBorder : colors.errorBorder;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ backgroundColor: colors.modalBackdrop }} className="flex-1 justify-end">
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 20) + 16,
                maxHeight: '85%',
              }}
              className="rounded-t-[32px] border-t px-6 pt-4 shadow-2xl"
            >
              {/* Drag Pill */}
              <View className="items-center mb-3">
                <View style={{ backgroundColor: colors.borderStrong }} className="w-12 h-1.5 rounded-full" />
              </View>

              {/* Title Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2.5">
                  <View
                    style={{ backgroundColor: actionBg, borderColor: actionBorder }}
                    className="w-10 h-10 rounded-2xl items-center justify-center border"
                  >
                    <Ionicons
                      name={isApprove ? 'checkmark-circle' : 'close-circle'}
                      size={24}
                      color={actionColor}
                    />
                  </View>
                  <View>
                    <Text style={{ color: colors.textPrimary }} className="text-lg font-extrabold">
                      Confirm {isApprove ? 'Approval' : 'Rejection'}
                    </Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs">
                      Sign transaction with on-device wallet
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
                  className="w-8 h-8 rounded-full items-center justify-center border"
                >
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Transaction Summary Card */}
              <View
                style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary, borderColor: colors.border }}
                className="p-4 rounded-2xl border mb-4"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 mr-2">
                    <Text style={{ color: colors.textPrimary }} className="font-bold text-base mb-0.5">
                      {tx.description}
                    </Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs">
                      Initiator: {tx.submittedBy?.displayName || 'Unknown'}
                    </Text>
                  </View>
                  <Text style={{ color: actionColor }} className="font-extrabold text-xl">
                    ₱{tx.amount?.toLocaleString()}
                  </Text>
                </View>

                {tx.category && (
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <Text style={{ color: colors.textMuted }} className="text-xs">Category:</Text>
                    <Text style={{ color: colors.textSecondary }} className="text-xs font-semibold">{tx.category}</Text>
                  </View>
                )}
              </View>

              {/* Comment / Reason Input */}
              <Text style={{ color: colors.textSecondary }} className="text-xs font-bold uppercase mb-2">
                Approval Comment (Optional)
              </Text>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Add an audit trail comment..."
                placeholderTextColor={colors.inputPlaceholder}
                style={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : colors.backgroundSecondary,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                }}
                className="border p-3.5 rounded-2xl mb-4 text-sm"
              />

              {/* Cryptographic Security Note */}
              <View
                style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '30' }}
                className="flex-row items-center p-3 rounded-xl border mb-5 gap-2.5"
              >
                <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary }} className="text-xs flex-1 font-medium leading-4">
                  EIP-712 typed signature will be verified cryptographically by the DAO treasury smart contract.
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={onClose}
                  disabled={isSigning}
                  style={{ backgroundColor: colors.cardGlass, borderColor: colors.border }}
                  className="flex-1 py-4 rounded-2xl items-center border"
                >
                  <Text style={{ color: colors.textSecondary }} className="font-bold text-sm">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onConfirm(comment)}
                  disabled={isSigning}
                  style={{ backgroundColor: actionColor }}
                  className="flex-[2] py-4 rounded-2xl items-center justify-center flex-row shadow-lg"
                >
                  {isSigning ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text className="text-white font-extrabold text-sm">
                        {isApprove ? 'Sign & Approve' : 'Sign & Reject'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export default React.memo(ApprovalConfirmModal);

