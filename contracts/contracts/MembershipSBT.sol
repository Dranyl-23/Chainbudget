// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ChainBudget Membership SBT
/// @notice A Soulbound Token (non-transferable NFT) issued to verified members of an organization.
contract MembershipSBT is ERC721, Ownable {
    uint256 private _nextTokenId;

    // Mapping from token ID to organization ID (string representation)
    mapping(uint256 => string) public tokenOrgIds;

    event MembershipMinted(address indexed to, uint256 indexed tokenId, string orgId);

    constructor() ERC721("ChainBudget Member", "CB-SBT") Ownable(msg.sender) {}

    /// @notice Mints a new Soulbound Token to the member's wallet
    /// @param to The wallet address of the member
    /// @param orgId The ID of the organization they belong to
    /// @return tokenId The ID of the newly minted token
    function mintMembership(address to, string memory orgId) external onlyOwner returns (uint256) {
        require(balanceOf(to) == 0, "Address already owns a membership SBT");
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        tokenOrgIds[tokenId] = orgId;
        
        emit MembershipMinted(to, tokenId, orgId);
        
        return tokenId;
    }

    /// @notice Revokes a membership token (burns it)
    function revokeMembership(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
    }

    /// @notice Override transfer function to make it Soulbound
    /// @dev Blocks transfers unless it's minting or burning
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Prevent transfer if it's not minting (from == address(0)) or burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            revert("MembershipSBT: This token is soulbound and cannot be transferred.");
        }
        
        return super._update(to, tokenId, auth);
    }

    /// @notice Override tokenURI to return a dynamic SVG representing the digital ID
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);
        string memory orgId = tokenOrgIds[tokenId];
        
        // Generate a very basic SVG data URI for the ID card
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" style="background: linear-gradient(135deg, #6B55D9, #A892F0); border-radius: 20px; font-family: sans-serif; color: white;">',
            '<rect width="100%" height="100%" rx="20"/>',
            '<text x="20" y="40" font-size="20" font-weight="bold" fill="white">ChainBudget</text>',
            '<text x="20" y="70" font-size="14" fill="#E8E1FF">Verified Member</text>',
            '<text x="20" y="160" font-size="12" fill="#E8E1FF">SBT ID</text>',
            '<text x="20" y="180" font-size="18" font-weight="bold" fill="white">#', _uint2str(tokenId), '</text>',
            '<text x="20" y="240" font-size="12" fill="#E8E1FF">Organization</text>',
            '<text x="20" y="260" font-size="16" font-weight="bold" fill="white">', orgId, '</text>',
            '<text x="20" y="360" font-size="10" fill="#E8E1FF">Non-Transferable (Soulbound)</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name": "ChainBudget Membership #', _uint2str(tokenId), '",',
            '"description": "A Soulbound Digital ID representing active membership in a ChainBudget-managed organization.",',
            '"image": "data:image/svg+xml;base64,', _encodeBase64(bytes(svg)), '"}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", _encodeBase64(bytes(json))));
    }

    // Helper functions for string conversion and base64
    function _uint2str(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    function _encodeBase64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        string memory result = new string(encodedLen + 32);
        
        assembly {
            mstore(result, encodedLen)
            let tablePtr := add(table, 1)
            let dataPtr := data
            let endPtr := add(dataPtr, mload(data))
            let resultPtr := add(result, 32)

            for {} lt(dataPtr, endPtr) {} {
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1)
            }
            switch mod(mload(data), 3)
            case 1 { mstore8(sub(resultPtr, 1), 0x3d) mstore8(sub(resultPtr, 2), 0x3d) }
            case 2 { mstore8(sub(resultPtr, 1), 0x3d) }
        }
        return result;
    }
}
