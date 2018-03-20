const Ethmoji = artifacts.require("./ethmoji/Ethmoji.sol");

module.exports = function(deployer) {
  deployer.deploy(Ethmoji, {gas: 6721975});
};
