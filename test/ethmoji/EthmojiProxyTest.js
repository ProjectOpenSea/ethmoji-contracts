var abi = require('ethereumjs-abi')

var ethmojiContractDefinition = artifacts.require('Ethmoji')
var ethmojiProxyContractDefinition = artifacts.require('EthmojiProxy')
const BigNumber = web3.BigNumber

require('chai')
.use(require('chai-as-promised'))
.use(require('chai-bignumber')(BigNumber))
.should()

contract("EthmojiProxy", accounts => { 
  var owner = accounts[0]
  var secondUser = accounts[1]
  var ethmojiProxy
  var ethmoji 
  
  beforeEach(async function () { 
    ethmoji = await ethmojiContractDefinition.new({from: owner})
    ethmojiProxy = await ethmojiProxyContractDefinition.new({ from: owner })

    const initializeData = encodeCall('initialize', ['address'], [owner])
    await ethmojiProxy.upgradeToAndCall(ethmoji.address, initializeData, { from: owner })
    
    ethmojiProxy = await ethmojiContractDefinition.at(ethmojiProxy.address)
  })

  it('can upgrade', async function () { 
    let ethmojiV2 = await ethmojiContractDefinition.new({from: owner})

    ethmojiProxy = await ethmojiProxyContractDefinition.at(ethmojiProxy.address)

    let currentImplementationAddress = await ethmojiProxy.implementation()

    let ethmojiV1Address = ethmoji.address
    let ethmojiV2Address = ethmojiV2.address

    expect(currentImplementationAddress).to.equal(ethmojiV1Address);

    await ethmojiProxy.upgradeTo(ethmojiV2.address, { from: owner })
    
    currentImplementationAddress = await ethmojiProxy.implementation()

    expect(currentImplementationAddress).to.not.equal(ethmojiV1Address);
    expect(currentImplementationAddress).to.equal(ethmojiV2Address);

    ethmojiProxy = await ethmojiContractDefinition.at(ethmojiProxy.address)

    let ethmojiOwner = await ethmojiProxy.owner()
    ethmojiOwner.should.be.equal.owner

  })

  it('not owner can not upgrade', async function () { 
    let ethmojiV2 = await ethmojiContractDefinition.new({from: owner})

    ethmojiProxy = await ethmojiProxyContractDefinition.at(ethmojiProxy.address)

    let currentImplementationAddress = await ethmojiProxy.implementation()

    let ethmojiV1Address = ethmoji.address
    let ethmojiV2Address = ethmojiV2.address

    expect(currentImplementationAddress).to.equal(ethmojiV1Address);

    await expectThrow(ethmojiProxy.upgradeTo(ethmojiV2.address, { from: secondUser }))
  })
})

var expectThrow = async promise => {
  try {
    await promise
  } catch (error) {
    // TODO: Check jump destination to destinguish between a throw
    //       and an actual invalid jump.
    const invalidOpcode = error.message.search('invalid opcode') >= 0
    // TODO: When we contract A calls contract B, and B throws, instead
    //       of an 'invalid jump', we get an 'out of gas' error. How do
    //       we distinguish this from an actual out of gas event? (The
    //       testrpc log actually show an 'invalid jump' event.)
    const outOfGas = error.message.search('out of gas') >= 0
    const revert = error.message.search('revert') >= 0
    assert(
      invalidOpcode || outOfGas || revert,
      'Expected throw, got \'' + error + '\' instead',
    )
    return
  }
  assert.fail('Expected throw not received')
}

var encodeCall = function(name, arguments, values) {
  const methodId = abi.methodID(name, arguments).toString('hex');
  const params = abi.rawEncode(arguments, values).toString('hex');
  return '0x' + methodId + params;
}