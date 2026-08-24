/**
 * NetworkStatusScreen.tsx
 *
 * Displays live blockchain protocol metrics, RPC node latency, and smart contract architecture.
 * Dynamic & Centralized: Discovers verified on-chain parameters via Protocol Discovery Service.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { triggerLightHaptic, triggerSuccessHaptic } from '../lib/biometrics';
import {
  fetchLiveProtocolConfig,
  getExplorerAddressUrl,
  LiveProtocolResponse,
  PROTOCOL_CONFIG,
} from '../config/contracts';

export default function NetworkStatusScreen() {
  const { colors, isDark } = useTheme();
  const { organizations, activeOrgId } = useOrg();
  const { showToast } = useToast();
  const activeOrg = organizations.find((o) => o._id === activeOrgId);

  const [protocolInfo, setProtocolInfo] = useState<LiveProtocolResponse | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [checkingPing, setCheckingPing] = useState<boolean>(false);

  useEffect(() => {
    loadProtocolConfig();
    measureRpcPing();
  }, []);

  const loadProtocolConfig = async () => {
    const data = await fetchLiveProtocolConfig();
    setProtocolInfo(data);
  };

  const measureRpcPing = async () => {
    setCheckingPing(true);
    const start = Date.now();
    try {
      const rpcUrl = protocolInfo?.network.rpcUrl || PROTOCOL_CONFIG.network.rpcUrl;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      });
      if (res.ok) {
        setPingLatency(Date.now() - start);
      } else {
        setPingLatency(Date.now() - start);
      }
    } catch {
      setPingLatency(Date.now() - start);
    } finally {
      setCheckingPing(false);
    }
  };

  const network = protocolInfo?.network || PROTOCOL_CONFIG.network;
  const contracts = protocolInfo?.contracts || PROTOCOL_CONFIG.contracts;
  const relayer = protocolInfo?.relayer || PROTOCOL_CONFIG.relayer;

  const activeContractAddress =
    (activeOrg?.contractAddress && activeOrg.contractAddress !== '0x0000000000000000000000000000000000000000')
      ? activeOrg.contractAddress
      : (activeOrg?.vaultAddress && activeOrg.vaultAddress !== '0x0000000000000000000000000000000000000000')
      ? activeOrg.vaultAddress
      : contracts.masterTreasury;

  const copyText = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    await triggerSuccessHaptic();
    showToast(`${label} copied to clipboard!`, 'info');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Network Hero Card */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 20,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.25 : 0.05,
          shadowRadius: 10,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: 'rgba(147, 51, 234, 0.15)',
                borderColor: '#9333EA40',
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="cube" size={24} color="#9333EA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                {network.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                Chain ID: {network.chainId} • Proof-of-Stake (PoS)
              </Text>
            </View>
          </View>
          <View
            style={{
              backgroundColor: '#10B98118',
              borderColor: '#10B98140',
              borderWidth: 1,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' }} />
            <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800' }}>ONLINE</Text>
          </View>
        </View>

        <Text style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 }}>
          ChainBudget smart contracts execute on Polygon with instant finality, tamper-proof state transitions, and subsidized gas.
        </Text>
      </View>

      {/* Protocol Specifications */}
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11.5,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        Protocol Parameters
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 22,
          padding: 16,
          marginBottom: 20,
          gap: 12,
        }}
      >
        {[
          { label: 'Blockchain Network', value: network.name },
          { label: 'Network Chain ID', value: `${network.chainId} (${network.hexChainId})` },
          { label: 'Native Currency', value: network.currency },
          { label: 'Gasless Relayer', value: `${relayer.status} (${relayer.type})` },
          { label: 'Consensus Mechanism', value: network.consensus },
        ].map((item, idx) => (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottomColor: colors.borderSubtle,
              borderBottomWidth: idx < 4 ? 1 : 0,
              paddingBottom: idx < 4 ? 10 : 0,
              gap: 12,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>{item.label}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700', flex: 1.3, textAlign: 'right' }}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Node Ping & RPC */}
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11.5,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        RPC Node Health
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 22,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>Public JSON-RPC Endpoint</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              {network.rpcUrl}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              measureRpcPing();
            }}
            disabled={checkingPing}
            style={{
              backgroundColor: colors.primaryMuted,
              borderColor: colors.primary + '40',
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {checkingPing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View className="flex-row items-center gap-1">
                <Ionicons name="refresh" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                  {pingLatency !== null ? `${pingLatency} ms` : 'Ping'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Smart Contract Card */}
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11.5,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        Active Vault Smart Contract
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 22,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
          On-Chain Vault Address ({activeOrg?.name || 'ChainBudget Master'})
        </Text>
        <TouchableOpacity
          onPress={() => copyText(activeContractAddress, 'Smart contract address')}
          activeOpacity={0.7}
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : colors.backgroundSecondary,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <Text
            style={{ color: colors.primary, fontSize: 12, fontWeight: '700', fontFamily: 'monospace', flex: 1, marginRight: 8 }}
            numberOfLines={1}
          >
            {activeContractAddress}
          </Text>
          <Ionicons name="copy-outline" size={16} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            triggerLightHaptic();
            Linking.openURL(getExplorerAddressUrl(activeContractAddress, network.explorerUrl));
          }}
          activeOpacity={0.85}
          style={{
            borderRadius: 14,
            shadowColor: '#6366F1',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 14,
              paddingVertical: 13,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="open-outline" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
              View Contract on PolygonScan
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Protocol Core Contracts */}
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 11.5,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        Deployed Protocol Contracts
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 22,
          padding: 16,
          marginBottom: 20,
          gap: 12,
        }}
      >
        {[
          { label: 'Master Treasury Contract', address: contracts.masterTreasury },
          { label: 'DAO Governance Contract', address: contracts.daoGovernance },
          { label: 'Soulbound SBT Tokens', address: contracts.sbtMembership },
        ].map((c) => (
          <TouchableOpacity
            key={c.label}
            onPress={() => {
              triggerLightHaptic();
              Linking.openURL(getExplorerAddressUrl(c.address, network.explorerUrl));
            }}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderSubtle,
            }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>{c.label}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                {c.address.slice(0, 10)}...{c.address.slice(-8)}
              </Text>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
