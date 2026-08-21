import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authenticateWithBiometrics, triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';

export default function GovernanceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();
  
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [votingOn, setVotingOn] = useState<string | null>(null);

  // Proposal Creation State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newProposalTitle, setNewProposalTitle] = useState('');
  const [newProposalAmount, setNewProposalAmount] = useState('');
  const [newProposalDescription, setNewProposalDescription] = useState('');
  const [creatingProposal, setCreatingProposal] = useState(false);

  // AI Analysis State
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [analyzingProposal, setAnalyzingProposal] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);

  useEffect(() => {
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (activeOrgId) {
      fetchProposals(activeOrgId);
    }
  }, [activeOrgId]);

  // Live WebSocket Subscription: Auto-update proposals when new votes or proposals are recorded
  useEffect(() => {
    if (!activeOrgId) return;

    const unsub = on('dao_vote_updated', (data: any) => {
      if (!data?.orgId || data.orgId === activeOrgId) {
        fetchProposals(activeOrgId);
        triggerLightHaptic();
      }
    });

    return () => unsub();
  }, [activeOrgId, on]);

  const fetchOrgs = async () => {
    try {
      const orgRes = await api.get('/organizations');
      setOrganizations(orgRes.data || []);
      if (orgRes.data?.length > 0 && !activeOrgId) {
        setActiveOrgId(orgRes.data[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProposals = async (orgId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/dao/proposals?orgId=${orgId}`);
      setProposals(res.data.proposals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrgs().then(() => {
      if (activeOrgId) fetchProposals(activeOrgId);
      setRefreshing(false);
    });
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    await triggerLightHaptic();
    
    // Require biometric confirmation before casting DAO vote
    const auth = await authenticateWithBiometrics(
      `Authorize DAO Vote: ${support ? 'YES (Support)' : 'NO (Reject)'}`
    );
    if (!auth.success) return;

    setVotingOn(proposalId);
    try {
      await api.post(`/dao/proposals/${proposalId}/vote`, {
        support,
      });
      await triggerSuccessHaptic();
      Alert.alert('Success', `You successfully voted ${support ? 'Yes' : 'No'}!`);
      if (activeOrgId) fetchProposals(activeOrgId);
    } catch (err: any) {
      await triggerErrorHaptic();
      console.error(err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to cast vote');
    } finally {
      setVotingOn(null);
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposalTitle || !newProposalAmount || !newProposalDescription) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setCreatingProposal(true);
    try {
      await api.post('/dao/proposals', {
        title: newProposalTitle,
        amount: Number(newProposalAmount),
        description: newProposalDescription,
        organizationId: activeOrgId,
      });
      await triggerSuccessHaptic();
      Alert.alert('Success', 'Proposal created successfully!');
      setCreateModalVisible(false);
      setNewProposalTitle('');
      setNewProposalAmount('');
      setNewProposalDescription('');
      if (activeOrgId) fetchProposals(activeOrgId);
    } catch (err: any) {
      await triggerErrorHaptic();
      console.error(err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to create proposal');
    } finally {
      setCreatingProposal(false);
    }
  };

  const handleAnalyzeProposal = async (proposal: any) => {
    setAiModalVisible(true);
    setAnalyzingProposal(true);
    setAiAnalysisResult(null);
    
    try {
      const res = await api.post('/ai/analyze-proposal', {
        title: proposal.title,
        description: proposal.description,
        amount: proposal.amount,
      });
      setAiAnalysisResult(res.data);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Analysis Failed', 'Could not complete AI analysis at this time.');
      setAiModalVisible(false);
    } finally {
      setAnalyzingProposal(false);
    }
  };

  const activeOrg = organizations.find(o => o._id === activeOrgId);

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* Header */}
      <View 
        style={{ 
          paddingTop: (insets.top || 0) + 16,
          backgroundColor: colors.background,
          borderBottomColor: colors.borderSubtle,
        }}
        className="pb-4 px-4 border-b z-10"
      >
        <View className="flex-row justify-between items-center mb-1">
          <Text style={{ color: colors.textPrimary }} className="text-2xl font-bold tracking-tight">Governance</Text>
        </View>
        <Text style={{ color: colors.textSecondary }} className="text-xs">Vote on active DAO proposals</Text>
      </View>

      <ScrollView 
        className="flex-1 p-4"
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Org Switcher / Identifier */}
        {activeOrg && (
          <View 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-row items-center p-3 rounded-2xl border mb-6 shadow-sm"
          >
            <View 
              style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
              className="w-9 h-9 rounded-xl items-center justify-center mr-3 border"
            >
              <Ionicons name="library" size={16} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase font-bold">Active Organization</Text>
              <Text style={{ color: colors.textPrimary }} className="text-sm font-bold">{activeOrg.name}</Text>
            </View>
          </View>
        )}

        {loading ? (
          <View className="py-10 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary }} className="mt-4 text-xs">Loading proposals...</Text>
          </View>
        ) : proposals.length === 0 ? (
          <View className="py-12 items-center justify-center">
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textSecondary }} className="mt-4 font-medium">No proposals found</Text>
          </View>
        ) : (
          proposals.map(proposal => {
            const currentUserId = user?.id || (user as any)?._id;
            const hasVoted = proposal.votesList?.some((v: any) => (v.voter?._id || v.voter?.id || v.voter) === currentUserId);
            const myVote = proposal.votesList?.find((v: any) => (v.voter?._id || v.voter?.id || v.voter) === currentUserId);
            
            const yesVotes = proposal.votesList?.filter((v: any) => v.support).length || 0;
            const noVotes = proposal.votesList?.filter((v: any) => !v.support).length || 0;
            const totalVotes = yesVotes + noVotes;
            const yesPercentage = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0;

            const isClosed = proposal.status !== 'active';

            return (
              <View 
                key={proposal._id} 
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                className="rounded-2xl border mb-4 p-5 shadow-sm"
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 mr-3">
                    <Text style={{ color: colors.textPrimary }} className="font-bold text-lg mb-1">{proposal.title}</Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs mb-2">
                      Proposed by {proposal.creator?.displayName || 'DAO Member'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleAnalyzeProposal(proposal)}
                      style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 }}
                    >
                      <Ionicons name="sparkles" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: 'bold' }}>AI Analysis</Text>
                    </TouchableOpacity>
                  </View>
                  <View 
                    style={{
                      backgroundColor: isClosed 
                        ? (proposal.status === 'executed' ? colors.successBg : colors.errorBg) 
                        : colors.primaryMuted,
                      borderColor: isClosed
                        ? (proposal.status === 'executed' ? colors.successBorder : colors.errorBorder)
                        : colors.primary + '40',
                    }}
                    className="px-2.5 py-1 rounded-full border"
                  >
                    <Text 
                      style={{
                        color: isClosed
                          ? (proposal.status === 'executed' ? colors.success : colors.error)
                          : colors.primary,
                      }}
                      className="text-[10px] font-extrabold uppercase"
                    >
                      {proposal.status}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.textSecondary }} className="text-sm mb-5 leading-relaxed">
                  {proposal.description}
                </Text>

                {/* Progress Bar */}
                <View className="mb-5">
                  <View className="flex-row justify-between mb-2">
                    <Text style={{ color: colors.success }} className="text-xs font-bold">Yes: {yesVotes}</Text>
                    <Text style={{ color: colors.error }} className="text-xs font-bold">No: {noVotes}</Text>
                  </View>
                  <View 
                    style={{ backgroundColor: colors.cardGlass }}
                    className="h-2.5 w-full rounded-full overflow-hidden flex-row"
                  >
                    <View style={{ width: `${yesPercentage}%`, backgroundColor: colors.success }} className="h-full" />
                    <View style={{ width: `${100 - yesPercentage}%`, backgroundColor: colors.error }} className="h-full" />
                  </View>
                </View>

                {/* Voting Actions */}
                {!isClosed && !hasVoted && (
                  <View className="flex-row gap-3 mt-2">
                    <TouchableOpacity 
                      onPress={() => handleVote(proposal._id, true)}
                      disabled={votingOn === proposal._id}
                      style={{ backgroundColor: colors.successBg, borderColor: colors.successBorder }}
                      className="flex-1 border py-3 rounded-xl items-center flex-row justify-center"
                    >
                      {votingOn === proposal._id ? (
                        <ActivityIndicator size="small" color={colors.success} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} style={{ marginRight: 6 }} />
                          <Text style={{ color: colors.success }} className="font-bold">Vote Yes</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleVote(proposal._id, false)}
                      disabled={votingOn === proposal._id}
                      style={{ backgroundColor: colors.errorBg, borderColor: colors.errorBorder }}
                      className="flex-1 border py-3 rounded-xl items-center flex-row justify-center"
                    >
                      {votingOn === proposal._id ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <>
                          <Ionicons name="close-circle-outline" size={16} color={colors.error} style={{ marginRight: 6 }} />
                          <Text style={{ color: colors.error }} className="font-bold">Vote No</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {hasVoted && (
                  <View 
                    style={{ backgroundColor: colors.cardGlass, borderColor: colors.borderSubtle }}
                    className="py-3 rounded-xl items-center mt-2 border"
                  >
                    <Text style={{ color: colors.textSecondary }} className="text-xs">
                      You voted <Text style={{ color: myVote?.support ? colors.success : colors.error, fontWeight: 'bold' }}>
                        {myVote?.support ? 'Yes' : 'No'}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Proposal FAB */}
      {activeOrgId && (
        <TouchableOpacity
          onPress={() => setCreateModalVisible(true)}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
            zIndex: 100,
          }}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Create Proposal Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 'bold' }}>Create DAO Proposal</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Title</Text>
            <TextInput
              style={{ backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 }}
              placeholder="e.g. Funding for Q3 Marketing"
              placeholderTextColor={colors.textMuted}
              value={newProposalTitle}
              onChangeText={setNewProposalTitle}
            />

            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Amount (PHP)</Text>
            <TextInput
              style={{ backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 }}
              placeholder="e.g. 50000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={newProposalAmount}
              onChangeText={setNewProposalAmount}
            />

            <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Description</Text>
            <TextInput
              style={{ backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 24, height: 100 }}
              placeholder="Detailed description of the proposal..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              value={newProposalDescription}
              onChangeText={setNewProposalDescription}
            />

            <TouchableOpacity
              style={{ backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' }}
              onPress={handleCreateProposal}
              disabled={creatingProposal}
            >
              {creatingProposal ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Submit Proposal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AI Analysis Modal */}
      <Modal
        visible={aiModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="sparkles" size={24} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 'bold' }}>AI Risk Analysis</Text>
              </View>
              <TouchableOpacity onPress={() => setAiModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {analyzingProposal ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 16 }}>Analyzing proposal...</Text>
                </View>
              ) : aiAnalysisResult ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 'bold', marginRight: 8 }}>Risk Score:</Text>
                    <View style={{ backgroundColor: aiAnalysisResult.riskScore > 7 ? colors.errorBg : aiAnalysisResult.riskScore > 4 ? colors.warningBg : colors.successBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: aiAnalysisResult.riskScore > 7 ? colors.errorBorder : aiAnalysisResult.riskScore > 4 ? colors.warningBorder : colors.successBorder }}>
                      <Text style={{ color: aiAnalysisResult.riskScore > 7 ? colors.error : aiAnalysisResult.riskScore > 4 ? colors.warning : colors.success, fontWeight: 'bold' }}>{aiAnalysisResult.riskScore} / 10</Text>
                    </View>
                  </View>

                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Summary</Text>
                  <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>{aiAnalysisResult.summary}</Text>

                  <Text style={{ color: colors.success, fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Pros</Text>
                  {aiAnalysisResult.pros?.map((pro: string, i: number) => (
                    <View key={`pro-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 8, marginTop: 2 }} />
                      <Text style={{ color: colors.textSecondary, flex: 1 }}>{pro}</Text>
                    </View>
                  ))}

                  <Text style={{ color: colors.error, fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 8 }}>Cons & Risks</Text>
                  {aiAnalysisResult.cons?.map((con: string, i: number) => (
                    <View key={`con-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                      <Ionicons name="warning" size={16} color={colors.error} style={{ marginRight: 8, marginTop: 2 }} />
                      <Text style={{ color: colors.textSecondary, flex: 1 }}>{con}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 20 }}>No analysis available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
