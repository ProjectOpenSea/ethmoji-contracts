pragma solidity ^0.4.21;

import "./Proxy.sol";
import "./OwnableProxy.sol";

contract EthmojiProxy is Proxy, OwnableProxy { 

  /**
   * @dev This event will be emitted every time the implementation gets upgraded
   * @param implementation representing the address of the upgraded implementation
   */
  event Upgraded(address indexed implementation);

  // Storage position of the address of the current implementation
  bytes32 private constant implementationPosition = keccak256("ethmoji.io.super.duper.awesome.proxy.implementation");

  /**
   * @dev Tells the address of the current implementation
   * @return address of the current implementation
   */
  function implementation() public view returns (address impl) {
    bytes32 position = implementationPosition;
    assembly {
      impl := sload(position)
    }
  }

  /**
   * @dev Sets the address of the current implementation
   * @param newImplementation address representing the new implementation to be set
   */
  function setImplementation(address newImplementation) internal {
    bytes32 position = implementationPosition;
    assembly {
      sstore(position, newImplementation)
    }
  }
  
  /**
   * @dev Allows the proxy owner to upgrade the current version of the proxy.
   * @param newImplementation representing the address of the new implementation to be set.
   */
  function upgradeTo(address newImplementation) public onlyProxyOwner {
    _upgradeTo(newImplementation);
  }

    /**
   * @dev Allows the proxy owner to upgrade the current version of the proxy and call the new implementation
   * to initialize whatever is needed through a low level call.
   * @param newImplementation representing the address of the new implementation to be set.
   * @param data represents the msg.data to bet sent in the low level call. This parameter may include the function
   * signature of the implementation to be called with the needed payload
   */
  function upgradeToAndCall(address newImplementation, bytes data) payable public onlyProxyOwner {
    upgradeTo(newImplementation);
    require(address(this).call.value(msg.value)(data));
  }

  /**
   * @dev Upgrades the implementation address
   * @param newImplementation representing the address of the new implementation to be set
   */
  function _upgradeTo(address newImplementation) internal {
    address currentImplementation = implementation();
    require(currentImplementation != newImplementation);
    setImplementation(newImplementation);
    emit Upgraded(newImplementation);
  }
}

