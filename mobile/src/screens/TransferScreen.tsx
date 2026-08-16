import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../lib/api';

export default function TransferScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { orgId } = route.params || {};

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [destination, setDestination] = useState(''); // E.g., wallet address
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!amount || !description || !orgId) {
      Alert.alert("Error", "Please fill in amount, description, and ensure an organization is selected.");
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/transactions', {
        organizationId: orgId,
        type: 'expense',
        amount: Number(amount),
        description: description,
        category: category || 'General',
        // In a real app we might pass the destination wallet address in 'notes' or a dedicated field if the backend supports it.
        notes: `Destination: ${destination}` 
      });

      Alert.alert("Success", "Transfer requested successfully!");
      navigation.goBack();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView 
      className="flex-1 bg-[#09090b]"
      contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-full bg-blue-500/20 items-center justify-center border border-blue-500/50 mb-4">
            <Ionicons name="send" size={28} color="#60a5fa" />
          </View>
          <Text className="text-white text-xl font-bold">Send / Transfer Funds</Text>
          <Text className="text-white/50 text-center mt-2">Request a transfer from the DAO treasury.</Text>
        </View>

        <View className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
          <Text className="text-white/60 text-xs font-bold uppercase mb-2">Amount (PHP)</Text>
          <TextInput
            className="text-white text-4xl font-extrabold pb-2 border-b border-white/10 mb-4"
            placeholder="0.00"
            placeholderTextColor="rgba(255,255,255,0.2)"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />

          <Text className="text-white/60 text-xs font-bold uppercase mb-2">Destination Address (Optional)</Text>
          <View className="flex-row items-center bg-black/40 rounded-xl px-4 py-3 mb-4 border border-white/5">
            <Ionicons name="wallet-outline" size={20} color="#666" style={{ marginRight: 10 }} />
            <TextInput
              className="flex-1 text-white text-sm"
              placeholder="0x..."
              placeholderTextColor="#666"
              value={destination}
              onChangeText={setDestination}
              autoCapitalize="none"
            />
          </View>

          <Text className="text-white/60 text-xs font-bold uppercase mb-2">Description</Text>
          <View className="flex-row items-center bg-black/40 rounded-xl px-4 py-3 mb-4 border border-white/5">
            <TextInput
              className="flex-1 text-white text-sm"
              placeholder="What is this for?"
              placeholderTextColor="#666"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <Text className="text-white/60 text-xs font-bold uppercase mb-2">Budget Category</Text>
          <View className="flex-row items-center bg-black/40 rounded-xl px-4 py-3 border border-white/5">
            <TextInput
              className="flex-1 text-white text-sm"
              placeholder="e.g. Marketing, Development"
              placeholderTextColor="#666"
              value={category}
              onChangeText={setCategory}
            />
          </View>
        </View>

        <TouchableOpacity 
          className={`py-4 rounded-xl items-center mb-10 ${loading || !amount || !description ? 'bg-blue-500/50' : 'bg-blue-500'}`}
          onPress={handleTransfer}
          disabled={loading || !amount || !description}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-lg">Confirm Request</Text>
          )}
        </TouchableOpacity>

    </KeyboardAwareScrollView>
  );
}
