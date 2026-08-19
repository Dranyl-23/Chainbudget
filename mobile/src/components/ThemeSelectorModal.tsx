import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ThemeMode } from '../theme/tokens';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';

interface ThemeSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ThemeOption {
  key: ThemeMode;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    key: 'system',
    title: 'System Default',
    subtitle: 'Automatically matches your device light/dark appearance',
    icon: 'phone-portrait-outline',
    iconColor: '#38bdf8',
  },
  {
    key: 'light',
    title: 'Light Mode',
    subtitle: 'Crisp, clean high-contrast daytime interface',
    icon: 'sunny-outline',
    iconColor: '#f59e0b',
  },
  {
    key: 'dark',
    title: 'Dark Mode',
    subtitle: 'Cyberpunk dark interface with neon accents',
    icon: 'moon-outline',
    iconColor: '#c084fc',
  },
];

export default function ThemeSelectorModal({ visible, onClose }: ThemeSelectorModalProps) {
  const { themeMode, setThemeMode, isDark, colors } = useTheme();

  const handleSelect = async (mode: ThemeMode) => {
    await triggerSuccessHaptic();
    await setThemeMode(mode);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View 
        style={{ backgroundColor: colors.modalBackdrop }}
        className="flex-1 items-center justify-center p-6"
      >
        <View 
          style={{ 
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
          className="w-full max-w-sm border rounded-3xl p-6 shadow-2xl"
        >
          {/* Header */}
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-row items-center gap-2.5">
              <View 
                style={{ 
                  backgroundColor: colors.primaryMuted,
                  borderColor: colors.border,
                }}
                className="w-9 h-9 rounded-xl items-center justify-center border"
              >
                <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
              </View>
              <Text 
                style={{ color: colors.textPrimary }}
                className="text-lg font-extrabold"
              >
                Choose Theme
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                onClose();
              }}
              style={{ backgroundColor: colors.cardGlass }}
              className="w-8 h-8 rounded-full items-center justify-center"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View className="space-y-3 mb-6">
            {THEME_OPTIONS.map((opt) => {
              const isSelected = themeMode === opt.key;

              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => handleSelect(opt.key)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: isSelected ? colors.primaryMuted : colors.cardGlass,
                    borderColor: isSelected ? colors.primary : colors.borderSubtle,
                  }}
                  className="flex-row items-center justify-between p-4 rounded-2xl border mb-2.5"
                >
                  <View className="flex-row items-center flex-1 mr-3">
                    <View 
                      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)' }}
                      className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    >
                      <Ionicons name={opt.icon} size={20} color={opt.iconColor} />
                    </View>
                    <View className="flex-1">
                      <Text 
                        style={{ color: isSelected ? colors.primary : colors.textPrimary }}
                        className="font-bold text-sm mb-0.5"
                      >
                        {opt.title}
                      </Text>
                      <Text 
                        style={{ color: colors.textMuted }}
                        className="text-[11px] leading-snug"
                      >
                        {opt.subtitle}
                      </Text>
                    </View>
                  </View>

                  {/* Radio Indicator */}
                  <View 
                    style={{
                      borderColor: isSelected ? colors.primary : colors.borderStrong,
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                    }}
                    className="w-5 h-5 rounded-full border-2 items-center justify-center"
                  >
                    {isSelected && (
                      <View className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Close Button */}
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onClose();
            }}
            style={{ 
              backgroundColor: colors.cardGlass,
              borderColor: colors.border,
            }}
            className="py-3.5 rounded-2xl border items-center justify-center"
          >
            <Text 
              style={{ color: colors.textPrimary }}
              className="font-bold text-sm"
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
