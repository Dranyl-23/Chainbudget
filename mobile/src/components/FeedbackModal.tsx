import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useTheme } from '../context/ThemeContext';
import { useOrg } from '../context/OrgContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import api from '../lib/api';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type FeedbackType = 'bug' | 'suggestion' | 'usability' | 'general';

const CATEGORIES: { id: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { id: 'bug', label: 'Bug Report', icon: 'bug-outline', color: '#EF4444' },
  { id: 'suggestion', label: 'Feature Idea', icon: 'bulb-outline', color: '#10B981' },
  { id: 'usability', label: 'UI / UX', icon: 'color-palette-outline', color: '#6366F1' },
  { id: 'general', label: 'General', icon: 'chatbox-ellipses-outline', color: '#F59E0B' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onClose, onSuccess }) => {
  const { colors } = useTheme();
  const { activeOrgId } = useOrg();

  const [type, setType] = useState<FeedbackType>('bug');
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  const resetForm = () => {
    setType('bug');
    setRating(5);
    setTitle('');
    setMessage('');
    setScreenshotUri(null);
    setSubmitting(false);
    setUploadingImage(false);
  };

  const handlePickImage = async () => {
    try {
      await triggerLightHaptic();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setScreenshotUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const handleRemoveImage = () => {
    triggerLightHaptic();
    setScreenshotUri(null);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please provide a short description of your feedback or issue.');
      return;
    }

    setSubmitting(true);
    await triggerLightHaptic();

    try {
      let uploadedScreenshotUrl: string | null = null;

      // Upload screenshot if attached
      if (screenshotUri) {
        setUploadingImage(true);
        const formData = new FormData();
        const filename = screenshotUri.split('/').pop() || 'feedback_screenshot.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const mimeType = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri: Platform.OS === 'ios' ? screenshotUri.replace('file://', '') : screenshotUri,
          name: filename,
          type: mimeType,
        } as any);

        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedScreenshotUrl = uploadRes.data?.documentUrl || null;
      }

      // Collect device diagnostics
      const deviceInfo = {
        platform: Platform.OS === 'android' ? 'Android' : 'iOS',
        osVersion: `${Platform.Version || Device.osVersion || ''}`,
        appVersion: '1.1.7',
        deviceModel: Device.modelName || Device.productName || 'Mobile Device',
        brand: Device.brand || 'Android',
      };

      // Submit feedback payload
      await api.post('/feedback', {
        organizationId: activeOrgId || null,
        type,
        rating,
        title: title.trim(),
        message: message.trim(),
        screenshotUrl: uploadedScreenshotUrl,
        deviceInfo,
      });

      await triggerSuccessHaptic();
      resetForm();
      onClose();

      Alert.alert(
        'Thank You! 🎉',
        'Your feedback has been delivered to the development team. We appreciate your help in testing ChainBudget!'
      );

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Feedback submit error:', err);
      Alert.alert('Submission Error', err.response?.data?.error || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            maxHeight: '90%',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: colors.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chatbubbles" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
                  Tester Feedback & Reports
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Help us improve ChainBudget
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                onClose();
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Category Selector */}
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Select Feedback Type
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {CATEGORIES.map((cat) => {
                const isSelected = type === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      triggerLightHaptic();
                      setType(cat.id);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: isSelected ? cat.color + '20' : colors.surface,
                      borderColor: isSelected ? cat.color : colors.border,
                      borderWidth: 1,
                    }}
                  >
                    <Ionicons name={cat.icon} size={16} color={isSelected ? cat.color : colors.textMuted} />
                    <Text
                      style={{
                        color: isSelected ? cat.color : colors.textSecondary,
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '500',
                      }}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Rating Stars */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Overall Experience</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Tap star to rate</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => {
                      triggerLightHaptic();
                      setRating(star);
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={24}
                      color={star <= rating ? '#F59E0B' : colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Title / Summary */}
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Subject (Optional)
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Button alignment on Escrow release"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: colors.textPrimary,
                fontSize: 13,
                marginBottom: 16,
              }}
            />

            {/* Message / Description */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                Feedback Details *
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 10 }}>{message.length} chars</Text>
            </View>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the issue you encountered, steps to reproduce, or suggestions..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: colors.textPrimary,
                fontSize: 13,
                minHeight: 100,
                marginBottom: 16,
              }}
            />

            {/* Screenshot Attachment */}
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Attach Screenshot (Optional)
            </Text>
            {screenshotUri ? (
              <View style={{ position: 'relative', marginBottom: 20 }}>
                <Image
                  source={{ uri: screenshotUri }}
                  style={{
                    width: '100%',
                    height: 160,
                    borderRadius: 14,
                    borderColor: colors.border,
                    borderWidth: 1,
                    resizeMode: 'cover',
                  }}
                />
                <TouchableOpacity
                  onPress={handleRemoveImage}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: 14,
                    width: 28,
                    height: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handlePickImage}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderRadius: 14,
                  paddingVertical: 14,
                  marginBottom: 20,
                }}
              >
                <Ionicons name="image-outline" size={20} color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  Tap to upload screenshot
                </Text>
              </TouchableOpacity>
            )}

            {/* Diagnostics Auto-Info Badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.primaryMuted,
                borderColor: colors.primary + '30',
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                marginBottom: 24,
              }}
            >
              <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11, flex: 1 }}>
                Device specs ({Device.brand || Platform.OS} • ChainBudget v1.1.7) will be attached automatically to help diagnose bugs.
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || uploadingImage}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 16,
                paddingVertical: 15,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: submitting ? 0.7 : 1,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {submitting ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, includeFontPadding: false }}>
                    {uploadingImage ? 'Uploading screenshot...' : 'Submitting feedback...'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, includeFontPadding: false }}>
                    Send Feedback
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
};
