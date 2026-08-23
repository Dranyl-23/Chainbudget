import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useOrg } from '../context/OrgContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import api from '../lib/api';

type FeedbackType = 'bug' | 'suggestion' | 'usability' | 'general';

const CATEGORIES: { id: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; desc: string }[] = [
  { id: 'bug', label: 'Bug Report', icon: 'bug-outline', color: '#EF4444', desc: 'Broken feature or glitch' },
  { id: 'suggestion', label: 'Feature Idea', icon: 'bulb-outline', color: '#10B981', desc: 'New functionality request' },
  { id: 'usability', label: 'UI / UX', icon: 'color-palette-outline', color: '#6366F1', desc: 'Design or layout feedback' },
  { id: 'general', label: 'General', icon: 'chatbox-ellipses-outline', color: '#F59E0B', desc: 'Questions or overall review' },
];

export default function FeedbackScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { activeOrgId } = useOrg();

  const [type, setType] = useState<FeedbackType>('bug');
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // Custom Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const selectedCategory = CATEGORIES.find((c) => c.id === type);

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
      Alert.alert('Message Required', 'Please provide a description of your feedback or issue.');
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

      // Show Custom Success Modal
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
      console.error('Feedback submit error:', err);
      Alert.alert('Submission Error', err.response?.data?.error || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            padding: 18,
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: colors.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chatbubbles" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
              Tester Feedback & Bug Reports
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              Share your testing observations or suggestions to help us improve ChainBudget.
            </Text>
          </View>
        </View>

        {/* Section 1: Feedback Type */}
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          1. Select Category
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {CATEGORIES.map((cat) => {
            const isSelected = type === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  triggerLightHaptic();
                  setType(cat.id);
                }}
                activeOpacity={0.7}
                style={{
                  width: '48%',
                  backgroundColor: isSelected ? cat.color + '15' : colors.surface,
                  borderColor: isSelected ? cat.color : colors.border,
                  borderWidth: 1.5,
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name={cat.icon} size={18} color={isSelected ? cat.color : colors.textMuted} />
                  <Text
                    style={{
                      color: isSelected ? cat.color : colors.textPrimary,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {cat.label}
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{cat.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section 2: Star Rating */}
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          2. Rate Your Experience
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>Overall Rating</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Tap stars to set score ({rating}/5)</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
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
                  size={26}
                  color={star <= rating ? '#F59E0B' : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section 3: Subject & Description */}
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          3. Subject (Optional)
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Escrow Release button font alignment"
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: colors.textPrimary,
            fontSize: 14,
            marginBottom: 20,
          }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
            4. Details & Observations *
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{message.length} chars</Text>
        </View>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Describe what happened, error message, steps to reproduce, or ideas..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            color: colors.textPrimary,
            fontSize: 14,
            minHeight: 120,
            marginBottom: 20,
          }}
        />

        {/* Section 4: Screenshot Upload */}
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          5. Screenshot (Optional)
        </Text>
        {screenshotUri ? (
          <View style={{ position: 'relative', marginBottom: 24 }}>
            <Image
              source={{ uri: screenshotUri }}
              style={{
                width: '100%',
                height: 180,
                borderRadius: 16,
                borderColor: colors.border,
                borderWidth: 1,
                resizeMode: 'cover',
              }}
            />
            <TouchableOpacity
              onPress={handleRemoveImage}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                backgroundColor: 'rgba(0,0,0,0.75)',
                borderRadius: 16,
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handlePickImage}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderRadius: 16,
              paddingVertical: 18,
              marginBottom: 24,
            }}
          >
            <Ionicons name="image-outline" size={22} color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
              Tap to attach screenshot
            </Text>
          </TouchableOpacity>
        )}

        {/* Diagnostics Info Box */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.primaryMuted,
            borderColor: colors.primary + '30',
            borderWidth: 1,
            borderRadius: 14,
            padding: 12,
            marginBottom: 24,
          }}
        >
          <Ionicons name="hardware-chip-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.textSecondary, fontSize: 11, flex: 1, lineHeight: 16 }}>
            Device specifications ({Device.brand || Platform.OS} • ChainBudget v1.1.7) will be automatically included with your report.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || uploadingImage}
          activeOpacity={0.85}
          style={{
            backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
            borderRadius: 18,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: submitting ? 0.7 : 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.15 : 0.25,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          {submitting ? (
            <View className="flex-row items-center justify-center gap-2">
              <ActivityIndicator size="small" color={isDark ? '#09090B' : '#FFFFFF'} />
              <Text style={{ color: isDark ? '#09090B' : '#FFFFFF', fontWeight: '800', fontSize: 15, includeFontPadding: false }}>
                {uploadingImage ? 'Uploading screenshot...' : 'Submitting feedback...'}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center justify-center gap-2">
              <Ionicons name="paper-plane" size={20} color={isDark ? '#09090B' : '#FFFFFF'} />
              <Text style={{ color: isDark ? '#09090B' : '#FFFFFF', fontWeight: '800', fontSize: 15, includeFontPadding: false }}>
                Send Feedback Report
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Custom Designed Success Modal */}
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
            {/* Glowing Pulse Rings + Gradient Icon */}
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
                <Ionicons name="checkmark-sharp" size={34} color="#ffffff" />
              </LinearGradient>
            </View>

            {/* Title & Description */}
            <Text
              style={{ color: colors.textPrimary }}
              className="text-xl font-black text-center mb-2"
            >
              Thank You! 🎉
            </Text>
            <Text
              style={{ color: colors.textSecondary }}
              className="text-xs text-center leading-5 mb-5 px-2"
            >
              Your feedback has been delivered to the development team. We appreciate your help in testing ChainBudget!
            </Text>

            {/* Summary Tag / Pill */}
            <View
              style={{
                backgroundColor: colors.cardGlass || (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                borderColor: colors.borderSubtle,
                borderWidth: 1,
                borderRadius: 16,
                paddingVertical: 10,
                paddingHorizontal: 14,
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="star" size={15} color="#F59E0B" />
                <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                  {rating}/5 Stars
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: (selectedCategory?.color || colors.primary) + '20',
                  borderColor: (selectedCategory?.color || colors.primary) + '40',
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    color: selectedCategory?.color || colors.primary,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {selectedCategory?.label || 'Feedback'}
                </Text>
              </View>
            </View>

            {/* Action Done Button */}
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                setShowSuccessModal(false);
                navigation.goBack();
              }}
              activeOpacity={0.85}
              style={{
                width: '100%',
                backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.15 : 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text style={{ color: isDark ? '#09090B' : '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                Done & Return
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
