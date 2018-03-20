pragma solidity ^0.4.18;

import "./Composable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
/**
 * @title Ethmoji
 * Ehtmoji - a contract to mint and compose original emojis
 */

contract Ethmoji is Composable {
    using SafeMath for uint256;

    string public constant NAME = "Ethmoji";
    string public constant SYMBOL = "EMJ";

    // Mapping from address to emoji representing avatar
    mapping (address => uint256) public addressToAvatar;

    function Ethmoji() public { 
        isCompositionOnlyWithBaseLayers = true;
    }

    /**
    * @dev Mints a base token to an address with a given composition price
    * @param _to address of the future owner of the token
    * @param _compositionPrice uint256 composition price for the new token
    */
    function mintTo(address _to, uint256 _compositionPrice, uint256 _imageHash) public onlyOwner {
        Composable.mintTo(_to, _compositionPrice, _imageHash);
        _setAvatarIfNoAvatarIsSet(_to, tokensOf(_to)[0]);
    }

    /**
    * @dev Mints a composition emoji
    * @param _tokenIds uint256[] the array of layers that will make up the composition
    */
    function compose(uint256[] _tokenIds,  uint256 _imageHash) public payable whenNotPaused {
        Composable.compose(_tokenIds, _imageHash);
        _setAvatarIfNoAvatarIsSet(msg.sender, tokensOf(msg.sender)[0]);


        // Immediately pay out to layer owners
        for (uint8 i = 0; i < _tokenIds.length; i++) {
            _withdrawTo(ownerOf(_tokenIds[i]));
        }
    }

// ----- EXPOSED METHODS --------------------------------------------------------------------------

    /**
    * @dev returns the name ETHMOJI
    * @return string ETHMOJI
    */
    function name() public pure returns (string) {
        return NAME;
    }

    /**
    * @dev returns the name EMJ
    * @return string EMJ
    */
    function symbol() public pure returns (string) {
        return SYMBOL;
    }

    /**
    * @dev sets avatar for an address
    * @param _tokenId uint256 token ID
    */
    function setAvatar(uint256 _tokenId) public onlyOwnerOf(_tokenId) whenNotPaused {
        addressToAvatar[msg.sender] = _tokenId;
    }

    /**
    * @dev returns the ID representing the avatar of the address
    * @param _owner address
    * @return uint256 token ID of the avatar associated with that address
    */
    function getAvatar(address _owner) public view returns(uint256) {
        return addressToAvatar[_owner];
    }

    /**
    * @dev transfer ownership of token. keeps track of avatar logic
    * @param _to address to whom the token is being transferred to
    * @param _tokenId uint256 the ID of the token being transferred
    */
    function transfer(address _to, uint256 _tokenId) public onlyOwnerOf(_tokenId) whenNotPaused {
        // If the transferred token was previous owner's avatar, remove it
        if (addressToAvatar[msg.sender] == _tokenId) {
            _removeAvatar(msg.sender);
        }

        ERC721Token.transfer(_to, _tokenId);
    }

// ----- PRIVATE FUNCTIONS ------------------------------------------------------------------------

    /**
    * @dev sets avatar if no avatar was previously set
    * @param _owner address of the new vatara owner
    * @param _tokenId uint256 token ID
    */
    function _setAvatarIfNoAvatarIsSet(address _owner, uint256 _tokenId) private {
        if (addressToAvatar[_owner] == 0) {
            addressToAvatar[_owner] = _tokenId;
        }
    }

    /**
    * @dev removes avatar for address
    * @param _owner address of the avatar owner
    */
    function _removeAvatar(address _owner) private {
        addressToAvatar[_owner] = 0;
    }

    /**
    * @dev withdraw accumulated balance to the payee
    * @param _payee address to which to withdraw to
    */
    function _withdrawTo(address _payee) private {
        uint256 payment = payments[_payee];

        if (payment != 0 && this.balance >= payment) {
            totalPayments = totalPayments.sub(payment);
            payments[_payee] = 0;

            _payee.transfer(payment);
        }
    }
}
