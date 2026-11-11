// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title ChainBudget Membership SBT
/// @notice A Soulbound Token (non-transferable NFT) issued to verified members of organizations.
/// @dev Supports multi-organization membership (1 SBT per organization per member wallet).
contract MembershipSBT is ERC721, Ownable2Step {
    uint256 private _nextTokenId;

    // Mapping from token ID to organization ID
    mapping(uint256 => string) public tokenOrgIds;

    // Multi-organization tracking: user => orgId => isMember
    mapping(address => mapping(string => bool)) public hasOrgMembership;

    // User's token ID per organization: user => orgId => tokenId
    mapping(address => mapping(string => uint256)) public userOrgTokenId;

    event MembershipMinted(address indexed to, uint256 indexed tokenId, string orgId);
    event MembershipRevoked(address indexed from, uint256 indexed tokenId, string orgId);

    constructor(address initialOwner) 
        ERC721("ChainBudget Member", "CB-SBT") 
        Ownable(initialOwner) 
    {}

    /// @notice Mints a new Soulbound Token to the member's wallet for a specific organization
    /// @param to The wallet address of the member
    /// @param orgId The ID of the organization
    /// @return tokenId The ID of the newly minted token
    function mintMembership(address to, string memory orgId) external onlyOwner returns (uint256) {
        require(to != address(0), "MembershipSBT: zero address");
        require(bytes(orgId).length > 0, "MembershipSBT: empty orgId");
        require(!hasOrgMembership[to][orgId], "MembershipSBT: user already holds SBT for this organization");
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        tokenOrgIds[tokenId] = orgId;
        hasOrgMembership[to][orgId] = true;
        userOrgTokenId[to][orgId] = tokenId;
        
        emit MembershipMinted(to, tokenId, orgId);
        
        return tokenId;
    }

    /// @notice Revokes a membership token (burns it)
    function revokeMembership(uint256 tokenId) external onlyOwner {
        string memory orgId = tokenOrgIds[tokenId];
        address tokenOwner = ownerOf(tokenId);
        
        hasOrgMembership[tokenOwner][orgId] = false;
        delete userOrgTokenId[tokenOwner][orgId];
        delete tokenOrgIds[tokenId];

        _burn(tokenId);

        emit MembershipRevoked(tokenOwner, tokenId, orgId);
    }

    /// @notice Checks if a user is an active member of a specific organization
    function isMemberOf(address member, string memory orgId) external view returns (bool) {
        return hasOrgMembership[member][orgId];
    }

    /// @notice Override transfer function to enforce Soulbound (non-transferable) behavior
    /// @dev Blocks transfers unless it is minting (from == address(0)) or burning (to == address(0))
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        if (from != address(0) && to != address(0)) {
            revert("MembershipSBT: This token is soulbound and cannot be transferred.");
        }
        
        return super._update(to, tokenId, auth);
    }

    /// @notice Override tokenURI to return dynamic SVG metadata representing the digital ID
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);
        string memory orgId = tokenOrgIds[tokenId];
        string memory tokenIdStr = Strings.toString(tokenId);
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" style="background: linear-gradient(135deg, #4F46E5, #06B6D4); border-radius: 20px; font-family: sans-serif; color: white;">',
            '<rect width="100%" height="100%" rx="20" fill="none"/>',
            '<text x="20" y="40" font-size="20" font-weight="bold" fill="white">ChainBudget</text>',
            '<text x="20" y="70" font-size="14" fill="#E0E7FF">Verified Member SBT</text>',
            '<text x="20" y="160" font-size="12" fill="#E0E7FF">Token ID</text>',
            '<text x="20" y="185" font-size="20" font-weight="bold" fill="white">#', tokenIdStr, '</text>',
            '<text x="20" y="240" font-size="12" fill="#E0E7FF">Organization</text>',
            '<text x="20" y="265" font-size="16" font-weight="bold" fill="white">', orgId, '</text>',
            '<text x="20" y="360" font-size="10" fill="#E0E7FF">Non-Transferable (Soulbound)</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name": "ChainBudget Membership #', tokenIdStr, '",',
            '"description": "A Soulbound Digital ID representing active membership in a ChainBudget organization.",',
            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }
}
