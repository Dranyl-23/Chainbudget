/**
 * Shared type definitions for the ChainBudget mobile app.
 * Replaces `any` types scattered across screens with concrete interfaces.
 */

// ─── Organization ────────────────────────────────────────────────────────────

export interface Organization {
  _id: string;
  name: string;
  type?: string;
  logoUrl?: string;
  contractAddress?: string;
  vaultAddress?: string;
  chainId?: number;
  isPrivate?: boolean;
  requiredApprovals?: number;
  createdAt?: string;
}

// ─── User & Membership ──────────────────────────────────────────────────────

export interface Membership {
  organization: Organization | string;
  role?: string;
  roleLevel: number;
  isActive: boolean;
  hasSBT?: boolean;
  sbtTokenId?: string;
}

export interface User {
  _id: string;
  id?: string;
  walletAddress: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  memberships: Membership[];
  isSuperAdmin?: boolean;
  hasBackedUpPhrase?: boolean;
}

// ─── Transaction ─────────────────────────────────────────────────────────────

export interface Transaction {
  _id: string;
  organization: Organization | string;
  submittedBy?: User | string;
  type: 'income' | 'expense';
  amount: number;
  amountWei?: string;
  description: string;
  category?: string;
  budgetCategory?: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  isHighValue?: boolean;
  isEscrow?: boolean;
  escrowStatus?: 'locked' | 'released';
  payerApproved?: boolean;
  payeeApproved?: boolean;
  escrowNonce?: number;
  onChainTxId?: number;
  onChainId?: number;
  nonce?: number;
  blockchainTxHash?: string;
  dataHash?: string;
  isRecordedOnChain?: boolean;
  documentUrl?: string;
  documentHash?: string;
  receiptUrl?: string;
  receiptIpfsHash?: string;
  to?: string;
  supplier?: User | string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Approval ────────────────────────────────────────────────────────────────

export interface Approval {
  _id: string;
  transaction: string;
  organization: string;
  approver: Pick<User, '_id' | 'displayName' | 'walletAddress'>;
  action: 'approved' | 'rejected';
  comment?: string;
  walletAddress?: string;
  digitalSignature?: string;
  blockchainTxHash?: string;
  createdAt: string;
}

// ─── Verification Report ────────────────────────────────────────────────────

export interface VerificationReport {
  isVerified: boolean;
  transactionHash?: string;
  onChainTxId?: number;
  status: string;
  timestamp: string;
  organizationName?: string;
  contractAddress?: string;
  amount: number;
  type: string;
  category?: string;
  budgetCategory?: string;
  description: string;
  receiptIpfsHash?: string;
  receiptUrl?: string;
  submittedBy?: string;
  signatures: {
    name?: string;
    wallet?: string;
    signature?: string;
    action?: string;
    date?: string;
  }[];
}

// ─── DAO Proposal ────────────────────────────────────────────────────────────

export interface Proposal {
  _id: string;
  title: string;
  description?: string;
  status: 'active' | 'passed' | 'rejected' | 'executed';
  yesVotes: number;
  noVotes: number;
  votingDeadline: string;
  createdBy?: User | string;
  createdAt: string;
}

// ─── Notification ────────────────────────────────────────────────────────────

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: 'system' | 'approval' | 'transaction';
  isRead: boolean;
  orgId?: string;
  timestamp: string;
}

// ─── Navigation Params ──────────────────────────────────────────────────────

export type RootStackParamList = {
  Dashboard: undefined;
  Transfer: { orgId: string };
  Scanner: { orgId?: string };
  History: { orgId: string };
  TransactionDetail: { txId: string };
  Approvals: undefined;
  Governance: undefined;
  Members: { orgId: string };
  Notifications: undefined;
  VerificationReport: { hash: string };
  PublicLedger: undefined;
  Receive: { orgId?: string; initialOrgId?: string };
  Settings: undefined;
};
