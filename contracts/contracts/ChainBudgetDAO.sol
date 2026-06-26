// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ChainBudgetDAO
/// @notice Handles 1-member-1-vote DAO proposals for organizational decisions.
contract ChainBudgetDAO {
    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────
    
    address public owner;
    uint256 public proposalCount;

    struct Proposal {
        uint256 id;
        string title;
        bytes32 dataHash; // off-chain details hash
        uint256 yesVotes;
        uint256 noVotes;
        uint256 endTime;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    // proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Simple membership tracking (for a real DAO, this could be an ERC20 or ERC721)
    mapping(address => bool) public isMember;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────
    event ProposalCreated(uint256 indexed id, string title, bytes32 dataHash, uint256 endTime);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed id, bool passed);

    // ────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyMember() {
        require(isMember[msg.sender] || msg.sender == owner, "Only members can vote");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Membership
    // ────────────────────────────────────────────────────────────────────────
    function addMember(address _member) external onlyOwner {
        isMember[_member] = true;
    }

    function removeMember(address _member) external onlyOwner {
        isMember[_member] = false;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Proposal Logic
    // ────────────────────────────────────────────────────────────────────────
    
    /// @notice Creates a new proposal (typically called by backend/owner on behalf of an org)
    function createProposal(string calldata _title, bytes32 _dataHash, uint256 _durationSeconds) external onlyOwner returns (uint256) {
        proposalCount++;
        uint256 pid = proposalCount;
        
        proposals[pid] = Proposal({
            id: pid,
            title: _title,
            dataHash: _dataHash,
            yesVotes: 0,
            noVotes: 0,
            endTime: block.timestamp + _durationSeconds,
            executed: false
        });

        emit ProposalCreated(pid, _title, _dataHash, proposals[pid].endTime);
        return pid;
    }

    /// @notice Cast a vote on a proposal directly from the user's wallet
    function castVote(uint256 _proposalId, bool _support) external onlyMember {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp < p.endTime, "Voting has ended");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        hasVoted[_proposalId][msg.sender] = true;

        if (_support) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }

        emit Voted(_proposalId, msg.sender, _support);
    }

    /// @notice Finalizes the proposal after the deadline
    function executeProposal(uint256 _proposalId) external {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp >= p.endTime, "Voting still active");
        require(!p.executed, "Already executed");

        p.executed = true;
        bool passed = p.yesVotes > p.noVotes;
        
        emit ProposalExecuted(_proposalId, passed);
    }
    
    // Read function for frontend
    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        return proposals[_proposalId];
    }
}
