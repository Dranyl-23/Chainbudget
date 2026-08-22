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
        <View style={{ backgroundColor: colors.modalBackdrop, flex: 1, justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopColor: colors.borderSubtle,
                borderTopWidth: 1,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom || 0, 24) + 12,
                maxHeight: '88%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 10,
              }}
            >
              {/* Drag Indicator Bar */}
              <View className="items-center mb-3">
                <View
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : colors.borderStrong }}
                  className="w-12 h-1 rounded-full"
                />
              </View>

              {/* Title Header */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-3">
                  <View
                    style={{
                      backgroundColor: actionBg,
                      borderColor: actionBorder,
                      borderWidth: 1.5,
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={isApprove ? 'checkmark-circle' : 'close-circle'}
                      size={24}
                      color={actionColor}
                    />
                  </View>
                  <View>
                    <Text style={{ color: colors.textPrimary }} className="text-lg font-black tracking-tight">
                      Confirm {isApprove ? 'Approval' : 'Rejection'}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 1 }}>
                      Sign transaction with on-device wallet
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    triggerLightHaptic();
                    onClose();
                  }}
                  style={{
                    backgroundColor: colors.cardGlass,
                    borderColor: colors.borderSubtle,
                    borderWidth: 1,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Transaction Summary Card */}
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : colors.backgroundSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <View className="flex-row justify-between items-start mb-2.5">
                  <View className="flex-1 mr-3">
                    <Text
                      style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800', lineHeight: 20 }}
                      numberOfLines={2}
                    >
                      {tx.description}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }}>
                      Initiator: {tx.submittedBy?.displayName || 'Unknown Member'}
                    </Text>
                  </View>
                  <Text style={{ color: actionColor, fontSize: 20, fontWeight: '900' }}>
                    ₱{Number(tx.amount || 0).toLocaleString()}
                  </Text>
                </View>

                {tx.category ? (
                  <View className="flex-row items-center gap-1.5 pt-2 border-t" style={{ borderTopColor: colors.borderSubtle }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>Category:</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 11.5, fontWeight: '700' }}>
                      {tx.category}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Comment / Reason Input */}
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 10.5,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                  paddingLeft: 2,
                }}
              >
                APPROVAL COMMENT (OPTIONAL)
              </Text>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Add an audit trail comment..."
                placeholderTextColor={colors.inputPlaceholder}
                style={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : colors.backgroundSecondary,
                  borderColor: colors.border,
                  borderWidth: 1,
                  color: colors.textPrimary,
                  fontSize: 13,
                  paddingHorizontal: 14,
                  height: 46,
                  borderRadius: 14,
                  marginBottom: 12,
                }}
              />

              {/* Cryptographic Security Note */}
              <View
                style={{
                  backgroundColor: colors.primaryMuted,
                  borderColor: colors.primary + '35',
                  borderWidth: 1,
                  padding: 12,
                  borderRadius: 16,
                  marginBottom: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    backgroundColor: colors.primary + '20',
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                </View>
                <Text style={{ color: colors.primary, fontSize: 11, flex: 1, fontWeight: '600', lineHeight: 15 }}>
                  EIP-712 typed signature will be verified cryptographically by the DAO treasury smart contract.
                </Text>
              </View>

              {/* Action Buttons Row */}
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                {/* Cancel Button */}
                <TouchableOpacity
                  onPress={() => {
                    triggerLightHaptic();
                    onClose();
                  }}
                  disabled={isSigning}
                  style={{
                    backgroundColor: colors.cardGlass,
                    borderColor: colors.border,
                    borderWidth: 1.5,
                    height: 50,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13.5,
                      fontWeight: '800',
                      includeFontPadding: false,
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                {/* Sign & Approve Button */}
                <TouchableOpacity
                  onPress={() => onConfirm(comment)}
                  disabled={isSigning}
                  style={{
                    backgroundColor: actionColor,
                    height: 50,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 6,
                    flex: 1.6,
                    shadowColor: actionColor,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                  activeOpacity={0.8}
                >
                  {isSigning ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="finger-print" size={19} color="#ffffff" />
                      <Text
                        style={{
                          color: '#ffffff',
                          fontSize: 13.5,
                          fontWeight: '900',
                          includeFontPadding: false,
                        }}
                      >
                        {isApprove ? 'Sign & Approve' : 'Sign & Reject'}
                      </Text>
                    </View>
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
