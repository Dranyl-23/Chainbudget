import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GovernanceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [votingOn, setVotingOn] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (activeOrgId) {
      fetchProposals(activeOrgId);
    }
  }, [activeOrgId]);

  const fetchOrgs = async () => {
    try {
      const orgRes = await api.get('/organizations');
      setOrganizations(orgRes.data);
      if (orgRes.data.length > 0 && !activeOrgId) {
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
    setVotingOn(proposalId);
    try {
      await api.post(`/dao/vote`, {
        proposalId,
        support,
        reason: "" // Optional reason could be added via a modal later
      });
      Alert.alert('Success', `You successfully voted ${support ? 'Yes' : 'No'}!`);
      if (activeOrgId) fetchProposals(activeOrgId);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to cast vote');
    } finally {
      setVotingOn(null);
    }
  };

  const activeOrg = organizations.find(o => o._id === activeOrgId);

  return (
    <View className="flex-1 bg-[#09090b]">
      {/* Header */}
      <View 
        style={{ paddingTop: (insets.top || 0) + 16 }}
        className="pb-4 px-4 bg-[#09090b] border-b border-white/5 z-10"
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-bold text-white tracking-tight">Governance</Text>
        </View>
        <Text className="text-white/50 text-xs">Vote on active DAO proposals</Text>
      </View>

      <ScrollView 
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e879f9" />}
      >
        {/* Org Switcher / Identifier */}
        {activeOrg && (
          <View className="flex-row items-center bg-white/5 p-3 rounded-xl border border-white/10 mb-6">
            <View className="w-8 h-8 rounded-lg bg-black/40 items-center justify-center mr-3 border border-white/5">
              <Ionicons name="library" size={14} color="#e879f9" />
            </View>
            <View className="flex-1">
              <Text className="text-white/60 text-[10px] uppercase font-bold">Active Organization</Text>
              <Text className="text-white text-sm font-bold">{activeOrg.name}</Text>
            </View>
          </View>
        )}

        {loading ? (
          <View className="py-10 items-center justify-center">
            <ActivityIndicator color="#e879f9" />
            <Text className="text-white/50 mt-4 text-xs">Loading proposals...</Text>
          </View>
        ) : proposals.length === 0 ? (
          <View className="py-10 items-center justify-center">
            <Ionicons name="document-text-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text className="text-white/40 mt-4">No proposals found</Text>
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
              <View key={proposal._id} className="bg-[#15151e] rounded-2xl border border-white/5 mb-4 p-5">
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="text-white font-bold text-lg mb-1">{proposal.title}</Text>
                    <Text className="text-white/50 text-xs">
                      Proposed by {proposal.creator?.displayName}
                    </Text>
                  </View>
                  <View className={`px-2 py-1 rounded-md ${isClosed ? (proposal.status === 'executed' ? 'bg-emerald-500/20' : 'bg-rose-500/20') : 'bg-fuchsia-500/20'}`}>
                    <Text className={`text-[10px] font-bold uppercase ${isClosed ? (proposal.status === 'executed' ? 'text-emerald-400' : 'text-rose-400') : 'text-fuchsia-400'}`}>
                      {proposal.status}
                    </Text>
                  </View>
                </View>

                <Text className="text-white/70 text-sm mb-5 leading-relaxed">
                  {proposal.description}
                </Text>

                {/* Progress Bar */}
                <View className="mb-5">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-emerald-400 text-xs font-bold">Yes: {yesVotes}</Text>
                    <Text className="text-rose-400 text-xs font-bold">No: {noVotes}</Text>
                  </View>
                  <View className="h-2 w-full bg-black/40 rounded-full overflow-hidden flex-row">
                    <View style={{ width: `${yesPercentage}%` }} className="h-full bg-emerald-500" />
                    <View style={{ width: `${100 - yesPercentage}%` }} className="h-full bg-rose-500" />
                  </View>
                </View>

                {/* Voting Actions */}
                {!isClosed && !hasVoted && (
                  <View className="flex-row gap-3 mt-2">
                    <TouchableOpacity 
                      onPress={() => handleVote(proposal._id, true)}
                      disabled={votingOn === proposal._id}
                      className="flex-1 bg-emerald-500/20 border border-emerald-500/30 py-3 rounded-xl items-center flex-row justify-center"
                    >
                      {votingOn === proposal._id ? (
                        <ActivityIndicator size="small" color="#34d399" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={16} color="#34d399" style={{ marginRight: 6 }} />
                          <Text className="text-emerald-400 font-bold">Vote Yes</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleVote(proposal._id, false)}
                      disabled={votingOn === proposal._id}
                      className="flex-1 bg-rose-500/20 border border-rose-500/30 py-3 rounded-xl items-center flex-row justify-center"
                    >
                      {votingOn === proposal._id ? (
                        <ActivityIndicator size="small" color="#fb7185" />
                      ) : (
                        <>
                          <Ionicons name="close-circle-outline" size={16} color="#fb7185" style={{ marginRight: 6 }} />
                          <Text className="text-rose-400 font-bold">Vote No</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {hasVoted && (
                  <View className="bg-black/20 py-3 rounded-xl items-center mt-2 border border-white/5">
                    <Text className="text-white/60 text-xs">
                      You voted <Text className={myVote.support ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {myVote.support ? 'Yes' : 'No'}
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
    </View>
  );
}
