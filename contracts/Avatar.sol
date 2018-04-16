pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract Avatar is Ownable { 
  struct AvatarToken { 
    address contractAddress;
    uint id;
  }
  
  mapping(address => AvatarToken) avatars;

  mapping(address => bool) validAvatarContracts;

  function getAvatar(address avatarOwner) public view returns (uint id, address contractAddress) {
    AvatarToken memory token = avatars[avatarOwner];
    require(token.contractAddress != 0);
    require(ERC721(token.contractAddress).ownerOf(token.id) == avatarOwner); 
    
    return (token.id, token.contractAddress);
  }

  function setAvatar(address contractAddress, uint id) public { 
    require(ERC721(contractAddress).ownerOf(id) == msg.sender);
    require(validAvatarContracts[contractAddress] == true);
    
    AvatarToken memory token;
    token.contractAddress = contractAddress;
    token.id = id;

    avatars[msg.sender] = token;
  }

  function setValidContractForAvatar(address contractAddress) public onlyOwner { 
    validAvatarContracts[contractAddress] = true;
  }

  function removeValidContractForAvatar(address contractAddress) public onlyOwner { 
    validAvatarContracts[contractAddress] = false;
  }

  function isValidContractForAvatar(address contractAddress) public view returns(bool) { 
    return validAvatarContracts[contractAddress];
  }
}

contract ERC721 { 
  function ownerOf(uint256 _tokenId) public view returns (address);
}