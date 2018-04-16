pragma solidity ^0.4.21;

import "./Composable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Ethmoji
 * Ethmoji - a contract to mint and compose original emojis
*/
contract Ethmoji is Composable {
    using SafeMath for uint256;

    // set proxy as the owner
    bool internal _initialized;

    string public constant NAME = "Ethmoji";
    string public constant SYMBOL = "EMJ";
    
    function initialize(address newOwner) public {
        require(!_initialized);
        isCompositionOnlyWithBaseLayers = true;
        minCompositionFee = .001 ether;
        owner = newOwner;
        _initialized = true;
    }

    /**
    * @dev Mints a composition emoji
    * @param _tokenIds uint256[] the array of layers that will make up the composition
    */
    function compose(uint256[] _tokenIds,  uint256 _imageHash) public payable whenNotPaused {
        Composable.compose(_tokenIds, _imageHash);

        // Immediately pay out to layer owners
        for (uint256 i = 0; i < _tokenIds.length; i++) {
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

// ----- PRIVATE FUNCTIONS ------------------------------------------------------------------------

    /**
    * @dev withdraw accumulated balance to the payee
    * @param _payee address to which to withdraw to
    */
    function _withdrawTo(address _payee) private {
        uint256 payment = payments[_payee];

        if (payment != 0 && address(this).balance >= payment) {
            totalPayments = totalPayments.sub(payment);
            payments[_payee] = 0;
            _payee.transfer(payment);
        }
    }
}
