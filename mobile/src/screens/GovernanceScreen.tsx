import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput, Modal, BackHandler, FlatList, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { authenticateWithBiometrics, triggerSuccessHaptic, triggerErrorHaptic, triggerLightHaptic } from '../lib/biometrics';
import ScaleButton from '../components/ScaleButton';
import SuccessCelebrationModal from '../components/SuccessCelebrationModal';
import { getCachedProposals, setCachedProposals } from '../lib/cache';
import { formatStatusLabel, humanizeText } from '../lib/formatters';

export default function GovernanceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { organizations, activeOrgId, setActiveOrgId } = useOrg();
  const { showToast } = useToast();
  const { on } = useSocket();
  const { colors, isDark } = useTheme();

  const myMembership = user?.memberships?.find(
    (m: any) => (m.organization?._id || m.organization?.id || m.organization)?.toString() === activeOrgId?.toString()
  );
  const roleLevel = myMembership?.roleLevel || 4;
  const canCreateProposal = Boolean(activeOrgId && (roleLevel <= 2 || (user as any)?.isSuperAdmin));
  
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [votingOn, setVotingOn] = useState<{ proposalId: string; support: boolean } | null>(null);
  const recentlyVotedRef = useRef<string | null>(null);

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

  // Celebration State
  const [celebration, setCelebration] = useState<{ visible: boolean; title: string; subtitle?: string }>({
    visible: false,
    title: '',
  });

  const [filterTab, setFilterTab] = useState<'active' | 'passed' | 'rejected' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Android BackHandler for modals
  useEffect(() => {
    const onBackPress = () => {
      if (createModalVisible) {
        setCreateModalVisible(false);
        return true;
      }
      if (aiModalVisible) {
        setAiModalVisible(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [createModalVisible, aiModalVisible]);

  useEffect(() => {
    if (activeOrgId) {
      // Instant cache snapshot
      getCachedProposals(activeOrgId).then((cached) => {
        if (cached && cached.length > 0) {
          setProposals(cached);
          fadeAnim.setValue(1);
        }
      });
      fetchProposals(activeOrgId);
    }
  }, [activeOrgId]);

  // Live WebSocket Subscription: Auto-update proposals when new votes or proposals are recorded
  useEffect(() => {
    if (!activeOrgId) return;

    const unsub = on('dao_vote_updated', (data: any) => {
      if (!data?.orgId || data.orgId === activeOrgId) {
        // Skip if we just manually voted (handleVote already triggers fetchProposals)
        if (!recentlyVotedRef.current) {
          fetchProposals(activeOrgId);
        }
        triggerLightHaptic();
      }
    });

    return () => unsub();
  }, [activeOrgId, on]);

  const fetchProposals = async (orgId: string) => {
    if (proposals.length === 0) setLoading(true);
    try {
      const res = await api.get(`/dao/proposals?orgId=${orgId}`);
      const list = res.data.proposals || [];
      setProposals(list);
      setCachedProposals(orgId, list);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const onRefresh = () => {
    setRefreshing(true);
    if (activeOrgId) {
      fetchProposals(activeOrgId).finally(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    await triggerLightHaptic();
    const auth = await authenticateWithBiometrics(
      `Authorize DAO Vote: ${support ? 'YES (Support)' : 'NO (Reject)'}`
    );
    if (!auth.success) return;

    setVotingOn({ proposalId, support });
    recentlyVotedRef.current = proposalId;
    try {
      await api.post(`/dao/proposals/${proposalId}/vote`, {
        support,
      });
      setCelebration({
        visible: true,
        title: 'Vote Cast!',
        subtitle: `You voted ${support ? 'YES (Support)' : 'NO (Reject)'} on the proposal`,
      });
      if (activeOrgId) fetchProposals(activeOrgId);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to cast vote', 'error');
    } finally {
      setVotingOn(null);
      // Clear debounce flag after 2s to allow WebSocket to re-fetch if a different vote comes in
      setTimeout(() => { recentlyVotedRef.current = null; }, 2000);
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposalTitle || !newProposalAmount || !newProposalDescription) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    setCreatingProposal(true);
    try {
      await api.post('/dao/proposals', {
        title: newProposalTitle.trim(),
        amount: Number(newProposalAmount),
        description: newProposalDescription.trim(),
        orgId: activeOrgId,
        organizationId: activeOrgId,
      });
      setCreateModalVisible(false);
      setNewProposalTitle('');
      setNewProposalAmount('');
      setNewProposalDescription('');
      setCelebration({
        visible: true,
        title: 'Proposal Submitted!',
        subtitle: 'Your proposal is now live for community voting',
      });
      if (activeOrgId) fetchProposals(activeOrgId);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to create proposal', 'error');
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
      showToast('Could not complete AI analysis at this time.', 'error');
      setAiModalVisible(false);
    } finally {
      setAnalyzingProposal(false);
    }
  };

  const activeOrg = organizations.find((o) => o._id === activeOrgId);

  // Proposal Counts
  const activeCount = proposals.filter(
    (p) => (p.status || 'active').toLowerCase() === 'active'
  ).length;
  const passedCount = proposals.filter((p) => {
    const s = (p.status || '').toLowerCase();
    return s === 'passed' || s === 'executed' || s === 'approved';
  }).length;
  const rejectedCount = proposals.filter((p) => {
    const s = (p.status || '').toLowerCase();
    return (
      s === 'rejected' ||
      s === 'failed' ||
      s === 'cancelled' ||
      s === 'expired' ||
      s === 'closed'
    );
  }).length;
  const allCount = proposals.length;

  const filteredProposals = proposals.filter((p) => {
    const s = (p.status || 'active').toLowerCase();
    if (filterTab === 'active' && s !== 'active') return false;
    if (filterTab === 'passed' && s !== 'passed' && s !== 'executed' && s !== 'approved') return false;
    if (
      filterTab === 'rejected' &&
      s !== 'rejected' &&
      s !== 'failed' &&
      s !== 'cancelled' &&
      s !== 'expired' &&
      s !== 'closed'
    )
      return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      const proposerMatch = (p.creator?.displayName || '').toLowerCase().includes(q);
      if (!titleMatch && !descMatch && !proposerMatch) return false;
    }
    return true;
  });

  const renderProposal = ({ item: proposal }: { item: any }) => {
    const currentUserId = user?.id || (user as any)?._id;
    const hasVoted = proposal.votesList?.some((v: any) => (v.voter?._id || v.voter?.id || v.voter) === currentUserId);
    const myVote = proposal.votesList?.find((v: any) => (v.voter?._id || v.voter?.id || v.voter) === currentUserId);
    
    const yesVotes = proposal.votesList?.filter((v: any) => v.support).length || 0;
    const noVotes = proposal.votesList?.filter((v: any) => !v.support).length || 0;
    const totalVotes = yesVotes + noVotes;
    const yesPercentage = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0;
    const noPercentage = totalVotes > 0 ? 100 - yesPercentage : 0;

    const isClosed = proposal.status !== 'active';
    const isExpanded = Boolean(expandedDesc[proposal._id]);
    const isLongDesc = (proposal.description || '').length > 110;

    const isVotingAny = votingOn?.proposalId === proposal._id;
    const isVotingYes = isVotingAny && votingOn?.support === true;
    const isVotingNo  = isVotingAny && votingOn?.support === false;

    return (
      <View 
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="rounded-2xl border mb-4 p-4 shadow-sm"
      >
        <View className="flex-row justify-between items-start mb-2.5">
          <View className="flex-1 mr-3">
            <Text style={{ color: colors.textPrimary }} className="font-bold text-base mb-1">{proposal.title}</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs mb-2">
              Proposed by {proposal.creator?.displayName || 'DAO Member'}
            </Text>
            <TouchableOpacity
              onPress={() => handleAnalyzeProposal(proposal)}
              style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Run AI risk analysis on proposal"
            >
              <Ionicons name="sparkles" size={12} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>AI Risk Analysis</Text>
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor: isClosed ? colors.cardGlass : colors.successBg, borderColor: isClosed ? colors.border : colors.successBorder }} className="px-2.5 py-1 rounded-full border">
            <Text style={{ color: isClosed ? colors.textMuted : colors.success, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
              {formatStatusLabel(proposal.status || 'Active')}
            </Text>
          </View>
        </View>

        {/* Description with Expand/Collapse */}
        <View className="mb-3">
          <Text 
            style={{ color: colors.textSecondary }} 
            className="text-sm leading-5"
            numberOfLines={isExpanded ? undefined : 2}
          >
            {proposal.description}
          </Text>
          {isLongDesc && (
            <TouchableOpacity 
              onPress={() => {
                triggerLightHaptic();
                setExpandedDesc((prev) => ({ ...prev, [proposal._id]: !prev[proposal._id] }));
              }}
              className="mt-1"
            >
              <Text style={{ color: colors.primary }} className="text-xs font-bold">
                {isExpanded ? 'Show less ▲' : 'Read more ▼'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dual Voting Support Bar */}
        <View style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : colors.backgroundSecondary, borderColor: colors.borderSubtle }} className="p-3 rounded-xl border mb-3">
          <View className="flex-row justify-between items-center mb-1.5">
            <Text style={{ color: colors.textSecondary }} className="text-xs font-semibold">
              Votes: <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>{totalVotes}</Text>
            </Text>
            <View className="flex-row items-center">
              <Text style={{ color: colors.success }} className="text-xs font-bold">{yesPercentage}% Yes</Text>
              {totalVotes > 0 && (
                <View className="flex-row items-center ml-2">
                  <Text style={{ color: colors.textMuted }} className="text-xs mr-2">•</Text>
                  <Text style={{ color: colors.error }} className="text-xs font-bold">{noPercentage}% No</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ height: 6, backgroundColor: totalVotes > 0 && noPercentage > 0 ? colors.errorBg : colors.cardGlass, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' }}>
            <View style={{ width: `${yesPercentage}%`, height: '100%', backgroundColor: colors.success, borderRadius: 3 }} />
          </View>
        </View>

        {!isClosed && !hasVoted && (
          <View className="flex-row gap-3">
            <ScaleButton
              onPress={() => handleVote(proposal._id, false)}
              disabled={isVotingAny}
              style={{
                backgroundColor: colors.errorBg,
                borderColor: colors.errorBorder,
                flex: 1,
                borderWidth: 1,
                paddingVertical: 11,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Vote No on proposal"
            >
              {isVotingNo ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="close" size={18} color={colors.error} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.error, fontWeight: 'bold' }}>Vote No</Text>
                </View>
              )}
            </ScaleButton>

            <ScaleButton
              onPress={() => handleVote(proposal._id, true)}
              disabled={isVotingAny}
              style={{
                backgroundColor: colors.successBg,
                borderColor: colors.successBorder,
                flex: 1,
                borderWidth: 1,
                paddingVertical: 11,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Vote Yes on proposal"
            >
              {isVotingYes ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark" size={18} color={colors.success} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.success, fontWeight: 'bold' }}>Vote Yes</Text>
                </View>
              )}
            </ScaleButton>
          </View>
        )}

        {hasVoted && (
          <View style={{ backgroundColor: colors.cardGlass, borderColor: colors.borderSubtle }} className="p-2.5 rounded-xl border items-center">
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              You voted <Text style={{ color: myVote?.support ? colors.success : colors.error, fontWeight: 'bold' }}>
                {myVote?.support ? 'Yes' : 'No'}
              </Text>
            </Text>
          </View>
        )}
      </View>
    );
  };

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

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={filteredProposals}
          keyExtractor={(item) => item._id}
          renderItem={renderProposal}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <View className="mb-3">
              {/* Active Organization Pill */}
              {activeOrg && (
                <View 
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  className="flex-row items-center p-3 rounded-2xl border mb-3 shadow-sm justify-between"
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <View 
                      style={{ backgroundColor: colors.primaryMuted, borderColor: colors.primary + '40' }}
                      className="w-9 h-9 rounded-xl items-center justify-center mr-3 border"
                    >
                      <Ionicons name="library" size={16} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase font-bold">Active Organization</Text>
                      <Text style={{ color: colors.textPrimary }} className="text-sm font-bold" numberOfLines={1}>{activeOrg.name}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      triggerLightHaptic();
                      navigation.navigate('OrgChat', { orgId: activeOrgId });
                    }}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: colors.primaryMuted,
                      borderColor: colors.primary + '40',
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Ionicons name="chatbubbles-outline" size={14} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '700' }}>Org Chat</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search Bar */}
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
                className="flex-row items-center px-3.5 py-2.5 rounded-2xl border mb-3"
              >
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  placeholder="Search proposals, details, or author..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ color: colors.textPrimary }}
                  className="flex-1 ml-2.5 text-sm"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Tabs Pills (Horizontal Scroll) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              >
                {[
                  { key: 'active', label: 'Active', icon: 'flame-outline', count: activeCount },
                  { key: 'passed', label: 'Passed', icon: 'checkmark-circle-outline', count: passedCount },
                  { key: 'rejected', label: 'Closed', icon: 'close-circle-outline', count: rejectedCount },
                  { key: 'all', label: 'All', icon: 'layers-outline', count: allCount },
                ].map((tab) => {
                  const isSelected = filterTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => {
                        triggerLightHaptic();
                        setFilterTab(tab.key as any);
                      }}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: 1,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons
                        name={tab.icon as any}
                        size={13}
                        color={isSelected ? '#fff' : colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={{
                          color: isSelected ? '#fff' : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '600',
                          fontSize: 12,
                        }}
                      >
                        {tab.label}
                      </Text>
                      <View
                        style={{
                          backgroundColor: isSelected
                            ? 'rgba(255,255,255,0.25)'
                            : colors.cardGlass,
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderRadius: 999,
                          marginLeft: 5,
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? '#fff' : colors.textMuted,
                            fontSize: 10,
                            fontWeight: '800',
                          }}
                        >
                          {tab.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={loading ? (
            <View className="py-10 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textSecondary }} className="mt-4 text-xs">Loading proposals...</Text>
            </View>
          ) : (
            <View 
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="py-10 px-6 rounded-2xl border items-center justify-center mt-2"
            >
              <Ionicons name="document-text-outline" size={44} color={colors.textMuted} />
              <Text style={{ color: colors.textPrimary }} className="mt-3 font-bold text-sm">
                No {filterTab !== 'all' ? filterTab : ''} proposals found
              </Text>
              <Text style={{ color: colors.textSecondary }} className="mt-1 text-xs text-center">
                {searchQuery ? `No results match "${searchQuery}"` : 'Proposals for this category will appear here.'}
              </Text>
            </View>
          )}
        />
      </Animated.View>

      {/* Create Proposal FAB (Only visible to Level 1 President & Level 2 Treasurer) */}
      {canCreateProposal && (
        <ScaleButton
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
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Create new DAO proposal"
        >
          <Ionicons name="add" size={32} color="#fff" />
        </ScaleButton>
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

            <ScaleButton
              style={{ backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' }}
              onPress={handleCreateProposal}
              disabled={creatingProposal}
            >
              {creatingProposal ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Submit Proposal</Text>
              )}
            </ScaleButton>
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

      {/* Celebration Modal */}
      <SuccessCelebrationModal
        visible={celebration.visible}
        title={celebration.title}
        subtitle={celebration.subtitle}
        onDismiss={() => setCelebration({ visible: false, title: '' })}
      />
    </View>
  );
}

