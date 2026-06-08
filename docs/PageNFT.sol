// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract PageNFT is ERC721 {
    uint256 private _nextTokenId;
    mapping(uint256 => bytes32) private _swarmHashes;

    event PageCreated(
        uint256 indexed tokenId,
        address indexed creator,
        bytes32 swarmHash
    );

    event PageUpdated(
        uint256 indexed tokenId,
        bytes32 oldHash,
        bytes32 newHash
    );

    constructor() ERC721("DecentralizedPages", "DPAGE") {}

    function mintPage(bytes32 swarmHash) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _swarmHashes[tokenId] = swarmHash;

        emit PageCreated(tokenId, msg.sender, swarmHash);
        return tokenId;
    }

    function updatePage(uint256 tokenId, bytes32 newHash) public {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");

        bytes32 oldHash = _swarmHashes[tokenId];
        _swarmHashes[tokenId] = newHash;

        emit PageUpdated(tokenId, oldHash, newHash);
    }

    function getPage(uint256 tokenId)
        public
        view
        returns (bytes32 swarmHash, address owner)
    {
        return (_swarmHashes[tokenId], ownerOf(tokenId));
    }

    function getSwarmHash(uint256 tokenId) public view returns (bytes32) {
        return _swarmHashes[tokenId];
    }

    function nextTokenId() public view returns (uint256) {
        return _nextTokenId;
    }
}
