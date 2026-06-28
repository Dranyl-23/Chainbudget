// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title ChainBudgetTreasury
/// @notice A gasless multi-signature treasury for organizations.
/// @dev Verifies EIP-712 off-chain signatures to execute on-chain transfers.
contract ChainBudgetTreasury is EIP712 {
    using ECDSA for bytes32;

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────
    
    address public owner;
    uint256 public requiredApprovals;
    
    mapping(address => bool) public isApprover;
    address[] public approvers;
    
    // To prevent double-spending, we record which transactions have been executed
    mapping(string => bool) public executedTransactions;

    bytes32 private constant APPROVAL_TYPEHASH = keccak256(
        "Approval(string action,string txId,string amount,string description)"
    );

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────
    
    event VaultDeposited(address indexed sender, uint256 amount);
    event TransactionExecuted(string indexed txId, address indexed to, uint256 amount);
    event ApproverAdded(address indexed approver);
    event ApproverRemoved(address indexed approver);
    event RequiredApprovalsUpdated(uint256 newRequired);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────
    
    constructor(address[] memory _initialApprovers, uint256 _requiredApprovals) 
        EIP712("ChainBudget", "1") 
    {
        require(_requiredApprovals > 0, "Treasury: required approvals must be > 0");
        require(_initialApprovers.length >= _requiredApprovals, "Treasury: not enough approvers");
        
        owner = msg.sender;
        requiredApprovals = _requiredApprovals;

        for (uint256 i = 0; i < _initialApprovers.length; i++) {
            _addApprover(_initialApprovers[i]);
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Treasury: caller is not owner");
        _;
    }

    // Accept deposits
    receive() external payable {
        emit VaultDeposited(msg.sender, msg.value);
    }

    function getVaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Gasless Multi-Sig Execution
    // ────────────────────────────────────────────────────────────────────────
    
    /// @notice Executes a transaction by verifying multiple EIP-712 signatures off-chain.
    /// @dev Called by the backend (relayer) paying the gas.
    function executeWithSignatures(
        string calldata action,
        string calldata txId,
        string calldata amountStr,
        uint256 amountWei, // Actual uint256 amount to transfer
        string calldata description,
        address payable to,
        bytes[] calldata signatures
    ) external {
        require(!executedTransactions[txId], "Treasury: Transaction already executed");
        require(signatures.length >= requiredApprovals, "Treasury: Not enough signatures provided");
        require(address(this).balance >= amountWei, "Treasury: Insufficient vault balance");

        // Hash the typed data payload exactly as signed in the frontend
        bytes32 structHash = keccak256(
            abi.encode(
                APPROVAL_TYPEHASH,
                keccak256(bytes(action)),
                keccak256(bytes(txId)),
                keccak256(bytes(amountStr)),
                keccak256(bytes(description))
            )
        );
        
        bytes32 hash = _hashTypedDataV4(structHash);
        
        address[] memory recoveredAddresses = new address[](signatures.length);
        uint256 validSignatureCount = 0;

        for (uint256 i = 0; i < signatures.length; i++) {
            address recovered = ECDSA.recover(hash, signatures[i]);
            
            // Check if recovered address is an authorized approver
            if (isApprover[recovered]) {
                // Ensure no duplicate signatures from the same approver
                bool isDuplicate = false;
                for (uint256 j = 0; j < validSignatureCount; j++) {
                    if (recoveredAddresses[j] == recovered) {
                        isDuplicate = true;
                        break;
                    }
                }
                
                if (!isDuplicate) {
                    recoveredAddresses[validSignatureCount] = recovered;
                    validSignatureCount++;
                }
            }
        }

        require(validSignatureCount >= requiredApprovals, "Treasury: Not enough valid unique signatures from approvers");

        // Execute the transfer
        executedTransactions[txId] = true;
        
        (bool success, ) = to.call{value: amountWei}("");
        require(success, "Treasury: MATIC transfer failed");

        emit TransactionExecuted(txId, to, amountWei);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Management
    // ────────────────────────────────────────────────────────────────────────
    
    function addApprover(address approver) external onlyOwner {
        _addApprover(approver);
    }

    function removeApprover(address approver) external onlyOwner {
        require(isApprover[approver], "Treasury: not an approver");
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
        require(_required > 0, "Treasury: must be > 0");
        require(approvers.length >= _required, "Treasury: not enough approvers");
        requiredApprovals = _required;
        emit RequiredApprovalsUpdated(_required);
    }

    function getApprovers() external view returns (address[] memory) {
        return approvers;
    }

    function _addApprover(address approver) internal {
        require(approver != address(0), "Treasury: zero address");
        require(!isApprover[approver], "Treasury: already an approver");
        isApprover[approver] = true;
        approvers.push(approver);
        emit ApproverAdded(approver);
    }
}
