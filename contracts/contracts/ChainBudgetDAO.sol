// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title ChainBudgetDAO
/// @notice Handles 1-member-1-vote DAO proposals with on-chain quorum validation,
///         safe lifecycle state machine, and decentralized proposal execution.
contract ChainBudgetDAO is Ownable2Step {
    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────
    
    uint256 public proposalCount;
    uint256 public minQuorum; // Minimum total votes (yes + no) required to finalize

    struct Proposal {
        uint256 id;
        string title;
        bytes32 dataHash; // Off-chain details hash
        address creator;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool cancelled;
        bool passed;
    }

    mapping(uint256 => Proposal) public proposals;
    // proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Membership tracking for DAO voting eligibility
    mapping(address => bool) public isMember;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────
    event ProposalCreated(uint256 indexed id, string title, bytes32 dataHash, address indexed creator, uint256 endTime);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 currentYes, uint256 currentNo);
    event ProposalExecuted(uint256 indexed id, bool passed, uint256 yesVotes, uint256 noVotes);
    event ProposalCancelled(uint256 indexed id);
    event MinQuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);

    // ────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────────────────────

    modifier onlyMember() {
        require(isMember[msg.sender] || msg.sender == owner(), "DAO: only members can vote or propose");
        _;
    }

    modifier proposalExists(uint256 _proposalId) {
        require(_proposalId > 0 && _proposalId <= proposalCount && proposals[_proposalId].id == _proposalId, "DAO: proposal does not exist");
        _;
    }

    constructor(uint256 _initialQuorum) Ownable(msg.sender) {
        minQuorum = _initialQuorum;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Membership & Governance Configuration
    // ────────────────────────────────────────────────────────────────────────

    function addMember(address _member) external onlyOwner {
        require(_member != address(0), "DAO: zero address");
        require(!isMember[_member], "DAO: already a member");
        isMember[_member] = true;
        emit MemberAdded(_member);
    }

    function removeMember(address _member) external onlyOwner {
        require(isMember[_member], "DAO: not a member");
        isMember[_member] = false;
        emit MemberRemoved(_member);
    }

    function setMinQuorum(uint256 _newQuorum) external onlyOwner {
        uint256 old = minQuorum;
        minQuorum = _newQuorum;
        emit MinQuorumUpdated(old, _newQuorum);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Proposal Logic
    // ────────────────────────────────────────────────────────────────────────
    
    /// @notice Creates a new proposal
    /// @param _title Proposal title
    /// @param _dataHash Keccak256 hash of off-chain metadata (description, requested amount, category)
    /// @param _durationSeconds Duration of voting period in seconds (minimum 1 hour)
    function createProposal(
        string calldata _title, 
        bytes32 _dataHash, 
        uint256 _durationSeconds
    ) external onlyMember returns (uint256) {
        require(bytes(_title).length > 0, "DAO: title cannot be empty");
        require(_durationSeconds >= 3600, "DAO: minimum voting duration is 1 hour");
        
        proposalCount++;
        uint256 pid = proposalCount;
        
        proposals[pid] = Proposal({
            id: pid,
            title: _title,
            dataHash: _dataHash,
            creator: msg.sender,
            yesVotes: 0,
            noVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + _durationSeconds,
            executed: false,
            cancelled: false,
            passed: false
        });

        emit ProposalCreated(pid, _title, _dataHash, msg.sender, proposals[pid].endTime);
        return pid;
    }

    /// @notice Cast a vote on a proposal from an authorized member's wallet
    function castVote(uint256 _proposalId, bool _support) external onlyMember proposalExists(_proposalId) {
        Proposal storage p = proposals[_proposalId];
        require(!p.cancelled, "DAO: proposal is cancelled");
        require(block.timestamp < p.endTime, "DAO: voting period has ended");
        require(!hasVoted[_proposalId][msg.sender], "DAO: already voted on this proposal");

        hasVoted[_proposalId][msg.sender] = true;

        if (_support) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }

        emit Voted(_proposalId, msg.sender, _support, p.yesVotes, p.noVotes);
    }

    /// @notice Cancels a proposal before voting ends (only creator or owner)
    function cancelProposal(uint256 _proposalId) external proposalExists(_proposalId) {
        Proposal storage p = proposals[_proposalId];
        require(msg.sender == p.creator || msg.sender == owner(), "DAO: not authorized to cancel");
        require(!p.executed, "DAO: already executed");
        require(!p.cancelled, "DAO: already cancelled");
        require(block.timestamp < p.endTime, "DAO: voting has ended");

        p.cancelled = true;
        emit ProposalCancelled(_proposalId);
    }

    /// @notice Finalizes and executes the proposal after voting period has ended.
    /// @dev Permissionless: any caller can execute once conditions (time, quorum, majority) are met on-chain.
    function executeProposal(uint256 _proposalId) external proposalExists(_proposalId) {
        Proposal storage p = proposals[_proposalId];
        require(!p.cancelled, "DAO: proposal was cancelled");
        require(block.timestamp >= p.endTime, "DAO: voting still active");
        require(!p.executed, "DAO: proposal already executed");

        uint256 totalVotes = p.yesVotes + p.noVotes;
        require(totalVotes >= minQuorum, "DAO: minimum quorum not reached");

        p.executed = true;
        p.passed = (p.yesVotes > p.noVotes);

        emit ProposalExecuted(_proposalId, p.passed, p.yesVotes, p.noVotes);
    }
    
    // Read function for frontend / clients
    function getProposal(uint256 _proposalId) external view proposalExists(_proposalId) returns (Proposal memory) {
        return proposals[_proposalId];
    }
}
