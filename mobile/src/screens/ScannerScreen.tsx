import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import api from '../lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Camera permission is required to scan receipts.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.5,
      });
    }

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      // Call Real AI Scanning
      performRealAIScan(result.assets[0].uri);
    }
  };

  const performRealAIScan = async (uri: string) => {
    setIsScanning(true);
    try {
      const filename = uri.split('/').pop() || 'receipt.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const formData = new FormData();
      formData.append('receipt', {
        uri,
        name: filename,
        type,
      } as any);

      const res = await api.post('/ai/scan-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setAmount(res.data.totalAmount?.toString() || '');
      setDescription(`${res.data.merchant ? res.data.merchant + ' - ' : ''}Receipt`);
      Alert.alert('Scan Complete', 'AI has automatically filled in the details from your receipt!');
    } catch (err: any) {
      console.error("AI Scan Error:", err);
      Alert.alert('Scan Failed', err.response?.data?.error || 'Failed to scan receipt. Please enter details manually.');
    } finally {
      setIsScanning(false);
    }
  };

  const submitRequest = async () => {
    if (!amount || !description) {
      Alert.alert('Error', 'Please fill in the amount and description.');
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real scenario, you'd upload the image to IPFS/S3 first, then submit the request.
      // We will simulate a simple API call here assuming the org ID is known or fetched from context.
      const orgRes = await api.get('/organizations');
      if (orgRes.data.length === 0) throw new Error("No organization found");
      const orgId = orgRes.data[0]._id;

      await api.post(`/transactions`, {
        organization: orgId,
        type: 'expense',
        amount: Number(amount),
        description,
        category: 'Operations & Supplies', // default for now
      });

      Alert.alert('Success', 'Fund request submitted successfully!');
      setImage(null);
      setAmount('');
      setDescription('');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScrollView 
      className="flex-1 bg-[#09090b]"
      contentContainerStyle={{ padding: 16, paddingTop: (insets.top || 0) + 16, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      <View className="mb-6">
        <Text className="text-2xl font-bold text-white mb-2">Request Funds</Text>
        <Text className="text-white/60 text-sm">Scan a receipt using AI or enter details manually to request reimbursement.</Text>
      </View>

      <View className="flex-row gap-3 mb-6">
        <TouchableOpacity 
          onPress={() => pickImage(true)}
          className="flex-1 bg-white/5 border border-cyan-500/30 p-4 rounded-xl items-center justify-center flex-row gap-2"
        >
          <Ionicons name="camera" size={20} color="#22d3ee" />
          <Text className="text-cyan-400 font-bold">Camera</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => pickImage(false)}
          className="flex-1 bg-white/5 border border-fuchsia-500/30 p-4 rounded-xl items-center justify-center flex-row gap-2"
        >
          <Ionicons name="image" size={20} color="#e879f9" />
          <Text className="text-fuchsia-400 font-bold">Gallery</Text>
        </TouchableOpacity>
      </View>

      {image && (
        <View className="mb-6 items-center">
          <Image source={{ uri: image }} className="w-48 h-64 rounded-xl border border-white/20" resizeMode="cover" />
          {isScanning && (
            <View className="absolute inset-0 bg-black/60 rounded-xl items-center justify-center">
              <ActivityIndicator color="#22d3ee" size="large" />
              <Text className="text-cyan-400 font-bold mt-2 animate-pulse">AI Scanning...</Text>
            </View>
          )}
        </View>
      )}

      <View className="space-y-4 mb-8">
        <View>
          <Text className="text-white/60 text-xs uppercase tracking-widest font-bold mb-1 ml-1">Amount (PHP)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#666"
            className="bg-white/5 border border-white/10 text-white p-4 rounded-xl text-lg font-bold"
          />
        </View>

        <View className="mt-4">
          <Text className="text-white/60 text-xs uppercase tracking-widest font-bold mb-1 ml-1">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this for?"
            placeholderTextColor="#666"
            className="bg-white/5 border border-white/10 text-white p-4 rounded-xl"
            multiline
          />
        </View>
      </View>

      <TouchableOpacity 
        onPress={submitRequest}
        disabled={isSubmitting || isScanning}
        className={`w-full py-4 rounded-xl items-center justify-center mb-10 ${
          isSubmitting || isScanning ? 'bg-fuchsia-500/50' : 'bg-fuchsia-500'
        }`}
      >
        {isSubmitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-lg">Submit Request</Text>
        )}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
