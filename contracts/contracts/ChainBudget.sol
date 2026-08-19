// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title ChainBudget (Tokenized Treasury Vault)
/// @notice Records budget transactions on-chain, holds organization funds, enforces 2-of-N 
///         multi-signature approval, provides Smart Contract Escrow for suppliers, and supports
///         emergency pause controls and two-step ownership management.
contract ChainBudget is Ownable2Step, Pausable, ReentrancyGuard {
    // ────────────────────────────────────────────────────────────────────────
    // Types
    // ────────────────────────────────────────────────────────────────────────

    struct Transaction {
        uint256 id;
        bytes32 dataHash;       // keccak256 of off-chain payload (amount, desc, etc.)
        uint256 amount;         // Amount in WEI to be transferred
        address payable to;     // Recipient address of the funds
        bool    isHighValue;    // True → requires 2-of-N approval
        bool    isEscrow;       // True → funds locked until supplier & org approve
        bool    isApproved;     // True once threshold is met
        bool    executed;       // True once funds are transferred (or locked in escrow)
        bool    exists;
        uint256 approvalCount;
        uint256 timestamp;
        address submittedBy;
    }

    struct EscrowDetails {
        bool isFunded;          // True when executed from main treasury
        bool payerApproved;     // Org Admin/Approver approved
        bool payeeApproved;     // Supplier approved
        bool isReleased;        // Funds actually sent to supplier
    }

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    uint256 public requiredApprovals = 2;   // 2-of-N threshold
    uint256 public txCounter;

    mapping(uint256 => Transaction) private transactions;
    mapping(uint256 => EscrowDetails) public escrows;
    mapping(uint256 => mapping(address => bool)) private hasApproved;
    mapping(address => bool) public isApprover;
    address[] public approvers;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event VaultDeposited(address indexed sender, uint256 amount);
    event TransactionRecorded(uint256 indexed txId, bytes32 dataHash, uint256 amount, address to, bool isHighValue, bool isEscrow, address submittedBy);
    event ApprovalSubmitted(uint256 indexed txId, address indexed approver, uint256 approvalCount);
    event TransactionApproved(uint256 indexed txId);
    event TransactionExecuted(uint256 indexed txId, address indexed to, uint256 amount);
    
    event EscrowFunded(uint256 indexed txId, uint256 amount);
    event EscrowApproved(uint256 indexed txId, address approver, bool isPayer);
    event EscrowReleased(uint256 indexed txId, address indexed to, uint256 amount);
    event PayeeConfirmationRecordedOffchain(uint256 indexed txId, address indexed recordedBy, string evidenceURI);

    event ApproverAdded(address indexed approver);
    event ApproverRemoved(address indexed approver);
    event RequiredApprovalsUpdated(uint256 newRequired);

    // ────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────────────────────

    modifier onlyApprover() {
        require(isApprover[msg.sender], "ChainBudget: caller is not an approver");
        _;
    }

    modifier txExists(uint256 txId) {
        require(transactions[txId].exists, "ChainBudget: transaction does not exist");
        _;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Constructor & Treasury
    // ────────────────────────────────────────────────────────────────────────

    constructor(address[] memory _initialApprovers, uint256 _requiredApprovals)
        Ownable(msg.sender)
    {
        require(_requiredApprovals > 0, "ChainBudget: required approvals must be > 0");
        require(_initialApprovers.length >= _requiredApprovals, "ChainBudget: not enough approvers");
        requiredApprovals = _requiredApprovals;

        for (uint256 i = 0; i < _initialApprovers.length; i++) {
            _addApprover(_initialApprovers[i]);
        }
    }

    // Accept MATIC deposits into the Treasury Vault
    receive() external payable whenNotPaused {
        emit VaultDeposited(msg.sender, msg.value);
    }

    function getVaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Emergency Controls (Pausable)
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Pauses contract state modifications in case of emergency
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses contract operations
    function unpause() external onlyOwner {
        _unpause();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Owner-only management
    // ────────────────────────────────────────────────────────────────────────

    function recordTransaction(
        bytes32 dataHash,
        uint256 amount,
        address payable to,
        bool isHighValue,
        bool isEscrow
    ) external onlyOwner whenNotPaused returns (uint256 txId) {
        txCounter++;
        txId = txCounter;

        transactions[txId] = Transaction({
            id: txId,
            dataHash: dataHash,
            amount: amount,
            to: to,
            isHighValue: isHighValue,
            isEscrow: isEscrow,
            isApproved: !isHighValue,   // Low-value → auto-approved
            executed: false,
            exists: true,
            approvalCount: 0,
            timestamp: block.timestamp,
            submittedBy: msg.sender
        });

        emit TransactionRecorded(txId, dataHash, amount, to, isHighValue, isEscrow, msg.sender);
    }

    function addApprover(address approver) external onlyOwner {
        _addApprover(approver);
    }

    function removeApprover(address approver) external onlyOwner {
        require(isApprover[approver], "ChainBudget: not an approver");
        isApprover[approver] = false;
        for (uint256 i = 0; i < approvers.length; i++) {
            if (approvers[i] == approver) {
                approvers[i] = approvers[approvers.length - 1];
                approvers.pop();
                break;
            }
        }
        emit ApproverRemoved(approver);
    }

    function setRequiredApprovals(uint256 _required) external onlyOwner {
        require(_required > 0, "ChainBudget: must be > 0");
        require(approvers.length >= _required, "ChainBudget: not enough approvers");
        requiredApprovals = _required;
        emit RequiredApprovalsUpdated(_required);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Approver actions & Execution
    // ────────────────────────────────────────────────────────────────────────

    function submitApproval(uint256 txId) external onlyApprover txExists(txId) whenNotPaused {
        Transaction storage txn = transactions[txId];
        require(txn.isHighValue, "ChainBudget: transaction does not need approval");
        require(!txn.isApproved, "ChainBudget: transaction already approved");
        require(!hasApproved[txId][msg.sender], "ChainBudget: already approved");

        hasApproved[txId][msg.sender] = true;
        txn.approvalCount++;

        emit ApprovalSubmitted(txId, msg.sender, txn.approvalCount);

        if (txn.approvalCount >= requiredApprovals) {
            txn.isApproved = true;
            emit TransactionApproved(txId);
        }
    }

    function executeTransaction(uint256 txId) external nonReentrant txExists(txId) whenNotPaused {
        require(msg.sender == owner() || isApprover[msg.sender], "ChainBudget: not authorized to execute");
        Transaction storage txn = transactions[txId];
        require(txn.isApproved, "ChainBudget: transaction not approved yet");
        require(!txn.executed, "ChainBudget: already executed");
        require(address(this).balance >= txn.amount, "ChainBudget: insufficient vault balance");

        txn.executed = true;
        
        if (txn.isEscrow) {
            escrows[txId].isFunded = true;
            emit EscrowFunded(txId, txn.amount);
        } else {
            // Transfer actual funds to the recipient
            (bool success, ) = txn.to.call{value: txn.amount}("");
            require(success, "ChainBudget: MATIC transfer failed");
            emit TransactionExecuted(txId, txn.to, txn.amount);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Escrow Management
    // ────────────────────────────────────────────────────────────────────────

    function releaseEscrow(uint256 txId) external nonReentrant txExists(txId) whenNotPaused {
        Transaction storage txn = transactions[txId];
        EscrowDetails storage esc = escrows[txId];
        
        require(txn.isEscrow, "ChainBudget: not an escrow transaction");
        require(esc.isFunded, "ChainBudget: escrow not funded yet");
        require(!esc.isReleased, "ChainBudget: escrow already released");

        // Allow direct payee/supplier or org approver/owner
        if (msg.sender == txn.to) {
            esc.payeeApproved = true;
            emit EscrowApproved(txId, msg.sender, false);
        } else if (msg.sender == owner() || isApprover[msg.sender]) {
            esc.payerApproved = true;
            emit EscrowApproved(txId, msg.sender, true);
        } else {
            revert("ChainBudget: not authorized to release this escrow");
        }

        _finalizeEscrowIfApproved(txId);
    }

    /// @notice Releases escrow using a cryptographic signature from the payee (supplier)
    /// @dev Allows relayer/backend to submit on behalf of payee with cryptographically verifiable consent
    function releaseEscrowWithPayeeSignature(uint256 txId, bytes calldata payeeSig)
        external
        nonReentrant
        txExists(txId)
        whenNotPaused
    {
        Transaction storage txn = transactions[txId];
        EscrowDetails storage esc = escrows[txId];

        require(txn.isEscrow, "ChainBudget: not an escrow transaction");
        require(esc.isFunded, "ChainBudget: escrow not funded yet");
        require(!esc.isReleased, "ChainBudget: escrow already released");

        bytes32 messageHash = keccak256(
            abi.encodePacked(address(this), block.chainid, txId, txn.amount, txn.to, "ESCROW_RELEASE")
        );
        bytes32 ethSignedDigest = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ECDSA.recover(ethSignedDigest, payeeSig);

        require(signer == txn.to, "ChainBudget: invalid payee signature");

        esc.payeeApproved = true;
        emit EscrowApproved(txId, signer, false);

        _finalizeEscrowIfApproved(txId);
    }

    /// @notice Records an off-chain confirmation with mandatory evidence URI (e.g. IPFS delivery proof)
    /// @dev Explicit auditable operational override path
    function recordOffchainPayeeConfirmation(uint256 txId, string calldata evidenceURI)
        external
        nonReentrant
        onlyOwner
        txExists(txId)
        whenNotPaused
    {
        Transaction storage txn = transactions[txId];
        EscrowDetails storage esc = escrows[txId];

        require(bytes(evidenceURI).length > 0, "ChainBudget: evidence URI required");
        require(txn.isEscrow, "ChainBudget: not an escrow transaction");
        require(esc.isFunded, "ChainBudget: escrow not funded yet");
        require(!esc.isReleased, "ChainBudget: escrow already released");

        esc.payeeApproved = true;
        emit PayeeConfirmationRecordedOffchain(txId, msg.sender, evidenceURI);

        _finalizeEscrowIfApproved(txId);
    }

    function _finalizeEscrowIfApproved(uint256 txId) internal {
        Transaction storage txn = transactions[txId];
        EscrowDetails storage esc = escrows[txId];

        if (esc.payerApproved && esc.payeeApproved && !esc.isReleased) {
            esc.isReleased = true;
            (bool success, ) = txn.to.call{value: txn.amount}("");
            require(success, "ChainBudget: MATIC transfer failed");
            emit EscrowReleased(txId, txn.to, txn.amount);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Read functions
    // ────────────────────────────────────────────────────────────────────────

    function getTransaction(uint256 txId) external view txExists(txId) returns (Transaction memory) {
        return transactions[txId];
    }

    function isTransactionApproved(uint256 txId) external view txExists(txId) returns (bool) {
        return transactions[txId].isApproved;
    }

    function getApprovers() external view returns (address[] memory) {
        return approvers;
    }

    function getApprovalCount(uint256 txId) external view txExists(txId) returns (uint256) {
        return transactions[txId].approvalCount;
    }

    function hasApproverVoted(uint256 txId, address approver) external view returns (bool) {
        return hasApproved[txId][approver];
    }

    function _addApprover(address approver) internal {
        require(approver != address(0), "ChainBudget: zero address");
        require(!isApprover[approver], "ChainBudget: already an approver");
        isApprover[approver] = true;
        approvers.push(approver);
        emit ApproverAdded(approver);
    }
}
