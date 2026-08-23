import React from 'react';
import { View, Text, TouchableOpacity, Image, ImageBackground, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomeLandingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  return (
    <View className="flex-1 bg-[#090616]">
      <ImageBackground 
        source={require('../../assets/login_bg.jpg')} 
        style={{ flex: 1, width: '100%', height: '100%' }}
        imageStyle={{ opacity: 0.6 }}
      >
        {/* Floating Blocks Decorator */}
        <Image 
          source={require('../../assets/Blocks.png')}
          style={{ position: 'absolute', top: -screenWidth * 0.16, right: -screenWidth * 0.21, width: screenWidth * 1.05, height: screenWidth * 1.05, opacity: 0.8 }}
          resizeMode="contain"
        />
        <LinearGradient 
          colors={['transparent', '#090616', '#090616']} 
          locations={[0, 0.4, 1]}
          className="flex-1 px-6 justify-center" 
          style={{ paddingTop: Math.max(insets.top, 12) + 24, paddingBottom: Math.max(insets.bottom, 12) + 16 }}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {/* Logo & Hero */}
          <View className="items-center mb-10">
            {/* Logo Box */}
            <View className="items-center justify-center mb-4 relative">
              <Image 
                source={require('../../assets/3D-Chainbudget.png')} 
                style={{ width: Math.min(screenWidth * 0.40, 170), height: Math.min(screenWidth * 0.40, 170), zIndex: 10 }} 
                resizeMode="contain" 
              />
            </View>
            
            {/* Title */}
            <Text className="text-[40px] font-bold tracking-tight mb-2 text-center">
              <Text className="text-white">Chain</Text>
              <Text className="text-[#00E5FF]">Budget</Text>
            </Text>
            
            {/* Subtitle */}
            <Text className="text-[#00E5FF] font-medium text-base text-center mb-6">
              Transparent & Accountable
            </Text>
            
            {/* Description */}
            <Text className="text-white/60 text-[15px] text-center leading-relaxed">
              The open on-chain ledger for public{'\n'}budget dissemination.{'\n'}Powered by Polygon and AI.
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="w-full space-y-4 mb-8">
            
            {/* Explore Public Ledger Button */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('PublicLedger')}
              activeOpacity={0.8}
              className="w-full bg-[#120f26]/80 border-[1.5px] border-[#3730a3]/80 p-4 rounded-3xl flex-row items-center justify-between mb-4"
            >
              <View className="flex-row items-center gap-4">
                <View className="w-12 h-12 rounded-[16px] border-[1.5px] border-[#4338ca]/50 items-center justify-center bg-[#1e1b4b]/40">
                  <Ionicons name="globe-outline" size={24} color="#818cf8" />
                </View>
                <View>
                  <Text className="text-white font-bold text-[17px] mb-0.5">Explore Public Ledger</Text>
                  <Text className="text-white/50 text-[13px]">View transparent organizations</Text>
                </View>
              </View>
              <View className="w-8 h-8 rounded-full bg-white/5 items-center justify-center">
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            {/* Verify a Transaction Button */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('VerifyTransaction')}
              activeOpacity={0.8}
              className="w-full bg-[#061f1c]/80 border-[1.5px] border-[#064e3b]/80 p-4 rounded-3xl flex-row items-center justify-between mb-8"
            >
              <View className="flex-row items-center gap-4">
                <View className="w-12 h-12 rounded-[16px] border-[1.5px] border-[#059669]/50 items-center justify-center bg-[#022c22]/40">
                  <Ionicons name="shield-checkmark-outline" size={24} color="#34d399" />
                </View>
                <View>
                  <Text className="text-white font-bold text-[17px] mb-0.5">Verify a Transaction</Text>
                  <Text className="text-white/50 text-[13px]">Audit on-chain receipts</Text>
                </View>
              </View>
              <View className="w-8 h-8 rounded-full bg-white/5 items-center justify-center">
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </View>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.9}
            >
              <LinearGradient 
                colors={['#1d4ed8', '#00E5FF']} 
                start={{ x: 0, y: 0.5 }} 
                end={{ x: 1, y: 0.5 }} 
                className="w-full p-3 rounded-full flex-row items-center justify-center shadow-lg"
              >
                <Ionicons name="wallet-outline" size={26} color="#ffffff" style={{ marginRight: 16 }} />
                <View>
                  <Text className="text-white font-bold text-[18px] mb-0.5">Login / Connect Wallet</Text>
                  <Text className="text-white/70 text-[13px]">Secure access to your wallet</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="flex-row items-center justify-center mt-auto pb-2">
            <Text className="text-white/40 text-[11px] uppercase tracking-wide mr-2">Secured by Polygon</Text>
            <Ionicons name="cube-outline" size={14} color="#9333ea" />
            
            <View className="w-[1px] h-3 bg-white/20 mx-4" />
            
            <Ionicons name="sparkles" size={12} color="#60a5fa" style={{ marginRight: 4 }} />
            <Text className="text-white/40 text-[11px] uppercase tracking-wide">AI-Powered Insights</Text>
          </View>

          {/* Legal & Help Quick Links */}
          <View className="flex-row items-center justify-center gap-4 pb-2">
            <TouchableOpacity onPress={() => navigation.navigate('HelpFaq')}>
              <Text className="text-white/50 text-[11px] font-medium">Help & FAQs</Text>
            </TouchableOpacity>
            <Text className="text-white/20 text-[11px]">·</Text>
            <TouchableOpacity onPress={() => navigation.navigate('DataPrivacy')}>
              <Text className="text-white/50 text-[11px] font-medium">Data Privacy</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
          
        </LinearGradient>

      </ImageBackground>
    </View>
  );
}
