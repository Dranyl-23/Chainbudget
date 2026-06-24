// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChainBudget
/// @notice Records budget transactions on-chain and enforces 2-of-N multi-signature
///         approval for high-value disbursements.
/// @dev Deployed to an EVM-compatible testnet (e.g. Polygon Amoy) during the
///      capstone prototype phase. Only the contract owner (backend service wallet)
///      may record transactions; Level-1 approvers interact through submitApproval().

contract ChainBudget {
    // ────────────────────────────────────────────────────────────────────────
    // Types
    // ────────────────────────────────────────────────────────────────────────

    struct Transaction {
        uint256 id;
        bytes32 dataHash;       // keccak256 of off-chain payload (amount, desc, etc.)
        uint256 amount;         // Amount in smallest unit (e.g. wei-equivalent for display)
        bool    isHighValue;    // True → requires 2-of-N approval
        bool    isApproved;     // True once threshold is met
        bool    exists;
        uint256 approvalCount;
        uint256 timestamp;
        address submittedBy;
    }

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    address public owner;           // Backend service wallet (deployer)
    uint256 public requiredApprovals = 2;   // 2-of-N threshold
    uint256 public txCounter;

    mapping(uint256 => Transaction) private transactions;
    // txId → approver address → has voted
    mapping(uint256 => mapping(address => bool)) private hasApproved;
    // Whitelisted Level-1 approvers
    mapping(address => bool) public isApprover;
    address[] public approvers;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event TransactionRecorded(
        uint256 indexed txId,
        bytes32 dataHash,
        uint256 amount,
        bool isHighValue,
        address submittedBy
    );

    event ApprovalSubmitted(
        uint256 indexed txId,
        address indexed approver,
        uint256 approvalCount
    );

    event TransactionApproved(uint256 indexed txId);

    event ApproverAdded(address indexed approver);
    event ApproverRemoved(address indexed approver);
    event RequiredApprovalsUpdated(uint256 newRequired);

    // ────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ChainBudget: caller is not owner");
        _;
    }

    modifier onlyApprover() {
        require(isApprover[msg.sender], "ChainBudget: caller is not an approver");
        _;
    }

    modifier txExists(uint256 txId) {
        require(transactions[txId].exists, "ChainBudget: transaction does not exist");
        _;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    constructor(address[] memory _initialApprovers, uint256 _requiredApprovals) {
        require(_requiredApprovals > 0, "ChainBudget: required approvals must be > 0");
        require(
            _initialApprovers.length >= _requiredApprovals,
            "ChainBudget: not enough approvers for threshold"
        );
        owner = msg.sender;
        requiredApprovals = _requiredApprovals;

        for (uint256 i = 0; i < _initialApprovers.length; i++) {
            _addApprover(_initialApprovers[i]);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Owner-only management
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Record a transaction reference on-chain (called by backend service)
    /// @param dataHash keccak256 hash of the full off-chain transaction payload
    /// @param amount   Numeric amount for on-chain reference
    /// @param isHighValue If true, transaction requires 2-of-N approval before
    ///                    isApproved becomes true
    function recordTransaction(
        bytes32 dataHash,
        uint256 amount,
        bool isHighValue
    ) external onlyOwner returns (uint256 txId) {
        txCounter++;
        txId = txCounter;

        transactions[txId] = Transaction({
            id: txId,
            dataHash: dataHash,
            amount: amount,
            isHighValue: isHighValue,
            isApproved: !isHighValue,   // Low-value → auto-approved
            exists: true,
            approvalCount: 0,
            timestamp: block.timestamp,
            submittedBy: msg.sender
        });

        emit TransactionRecorded(txId, dataHash, amount, isHighValue, msg.sender);
    }

    /// @notice Add a Level-1 approver wallet
    function addApprover(address approver) external onlyOwner {
        _addApprover(approver);
    }

    /// @notice Remove a Level-1 approver wallet
    function removeApprover(address approver) external onlyOwner {
        require(isApprover[approver], "ChainBudget: not an approver");
        isApprover[approver] = false;
        // Remove from array
        for (uint256 i = 0; i < approvers.length; i++) {
            if (approvers[i] == approver) {
                approvers[i] = approvers[approvers.length - 1];
                approvers.pop();
                break;
            }
        }
        emit ApproverRemoved(approver);
    }

    /// @notice Update the required approval threshold
    function setRequiredApprovals(uint256 _required) external onlyOwner {
        require(_required > 0, "ChainBudget: must be > 0");
        require(
            approvers.length >= _required,
            "ChainBudget: not enough approvers for new threshold"
        );
        requiredApprovals = _required;
        emit RequiredApprovalsUpdated(_required);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Approver actions
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Submit approval for a high-value pending transaction
    function submitApproval(uint256 txId)
        external
        onlyApprover
        txExists(txId)
    {
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

    // ────────────────────────────────────────────────────────────────────────
    // Read functions
    // ────────────────────────────────────────────────────────────────────────

    function getTransaction(uint256 txId)
        external
        view
        txExists(txId)
        returns (Transaction memory)
    {
        return transactions[txId];
    }

    function isTransactionApproved(uint256 txId)
        external
        view
        txExists(txId)
        returns (bool)
    {
        return transactions[txId].isApproved;
    }

    function getApprovers() external view returns (address[] memory) {
        return approvers;
    }

    function getApprovalCount(uint256 txId)
        external
        view
        txExists(txId)
        returns (uint256)
    {
        return transactions[txId].approvalCount;
    }

    function hasApproverVoted(uint256 txId, address approver)
        external
        view
        returns (bool)
    {
        return hasApproved[txId][approver];
    }

    // ────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ────────────────────────────────────────────────────────────────────────

    function _addApprover(address approver) internal {
        require(approver != address(0), "ChainBudget: zero address");
        require(!isApprover[approver], "ChainBudget: already an approver");
        isApprover[approver] = true;
        approvers.push(approver);
        emit ApproverAdded(approver);
    }
}
