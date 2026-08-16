import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, Keyboard, ImageBackground, Image, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

export default function VerifyTransactionScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [hash, setHash] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleVerify = () => {
    Keyboard.dismiss();
    if (!hash.trim()) return;
    navigation.navigate('VerificationReport', { hash: hash.trim() });
  };

  const handleScanQR = async () => {
    if (!permission) return;
    if (!permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        alert('Camera permissions are required to scan QR codes.');
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    // Only accept the first valid scan
    setIsScanning(false);
    
    // Auto-fill and navigate
    const scannedHash = result.data.trim();
    setHash(scannedHash);
    navigation.navigate('VerificationReport', { hash: scannedHash });
  };

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
          style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, opacity: 0.4 }}
          resizeMode="contain"
        />
        
        <LinearGradient 
          colors={['transparent', '#090616', '#090616']} 
          locations={[0, 0.5, 1]}
          className="flex-1"
        >
          <KeyboardAwareScrollView 
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            extraScrollHeight={20}
          >
            {/* Header */}
            <View style={{ paddingTop: insets.top }} className="flex-row items-center p-4">
              <TouchableOpacity 
                onPress={() => navigation.goBack()} 
                className="w-10 h-10 items-center justify-center -ml-2 rounded-full bg-white/5 border border-white/10"
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text className="text-white font-bold text-lg ml-4 tracking-wide">Verify Transaction</Text>
            </View>

            <View className="flex-1 p-6 justify-center">
              
              {/* Icon & Hero */}
              <View className="items-center mb-10">
                <View className="items-center justify-center mb-6 relative">
                  {/* Glow */}
                  <View className="absolute w-[80px] h-[80px] bg-emerald-500/20 rounded-full" />
                  <View className="absolute w-[100px] h-[100px] bg-emerald-500/10 rounded-full" />
                  {/* Icon Box */}
                  <View className="w-20 h-20 rounded-[24px] border-[1.5px] border-emerald-500/50 items-center justify-center bg-[#022c22]/80 z-10">
                    <Ionicons name="shield-checkmark" size={36} color="#34d399" />
                  </View>
                </View>
                <Text 
                  className="text-2xl font-bold text-white mb-3 text-center tracking-tight"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Audit a Receipt
                </Text>
                <Text className="text-emerald-400/80 text-[15px] text-center leading-relaxed">
                  Enter a Polygon hash (0x...) or internal ID{'\n'}to cryptographically verify authenticity.
                </Text>
              </View>

              {/* Input Section */}
              <View className="bg-[#120f26]/60 border-[1.5px] border-emerald-900/50 rounded-3xl p-5 mb-6 shadow-2xl">
                <Text className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-3 ml-2">Transaction Hash</Text>
                <TextInput
                  className="text-emerald-300 bg-[#061f1c]/80 px-5 py-4 rounded-2xl border-[1px] border-emerald-500/30 mb-5 font-mono text-[13px]"
                  placeholder="0x..."
                  placeholderTextColor="#064e3b"
                  value={hash}
                  onChangeText={setHash}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor="#10b981"
                />
                
                <TouchableOpacity 
                  onPress={handleVerify}
                  disabled={!hash.trim()}
                  activeOpacity={0.9}
                >
                  <LinearGradient 
                    colors={hash.trim() ? ['#10b981', '#0ea5e9'] : ['#1f2937', '#111827']} 
                    start={{ x: 0, y: 0.5 }} 
                    end={{ x: 1, y: 0.5 }} 
                    className="w-full py-4 rounded-full flex-row items-center justify-center"
                  >
                    <Text className={`font-bold text-[17px] ${hash.trim() ? 'text-white' : 'text-white/30'}`}>
                      Verify Now
                    </Text>
                    {hash.trim() && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* OR Divider */}
              <View className="flex-row items-center mb-6">
                <View className="flex-1 h-[1px] bg-white/10" />
                <Text className="text-white/30 mx-4 font-bold text-[11px] uppercase tracking-widest">OR</Text>
                <View className="flex-1 h-[1px] bg-white/10" />
              </View>

              {/* Scan QR Button */}
              <TouchableOpacity 
                onPress={handleScanQR}
                activeOpacity={0.8}
                className="w-full bg-[#1e1b4b]/60 border-[1.5px] border-indigo-500/30 p-4 rounded-3xl flex-row items-center justify-center"
              >
                <Ionicons name="qr-code-outline" size={20} color="#a5b4fc" style={{ marginRight: 10 }} />
                <Text className="text-indigo-200 font-bold text-[16px]">Scan QR Code</Text>
              </TouchableOpacity>

            </View>
          </KeyboardAwareScrollView>
        </LinearGradient>
      </ImageBackground>

      {/* QR Scanner Modal */}
      <Modal visible={isScanning} animationType="slide" transparent={false}>
        <View className="flex-1 bg-black">
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
          />
          
          {/* Scanner Overlay UI */}
          <View className="flex-1 justify-between p-6 pt-16 pb-12">
            <View className="items-center">
              <Text className="text-white font-bold text-xl mb-2 tracking-wide shadow-black drop-shadow-xl">Scan Receipt QR Code</Text>
              <Text className="text-white/80 text-center px-6 drop-shadow-md">
                Point your camera at a ChainBudget receipt QR code to verify it.
              </Text>
            </View>

            {/* Target Reticle */}
            <View className="flex-1 items-center justify-center my-10 pointer-events-none">
              <View className="w-64 h-64 border-2 border-indigo-400 rounded-3xl bg-indigo-500/10" />
            </View>

            {/* Cancel Button */}
            <TouchableOpacity 
              onPress={() => setIsScanning(false)}
              className="w-full bg-white/10 p-4 rounded-full items-center border border-white/20 backdrop-blur-md"
            >
              <Text className="text-white font-bold text-[17px]">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
