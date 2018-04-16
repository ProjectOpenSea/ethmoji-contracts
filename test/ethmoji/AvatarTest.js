var abi = require('ethereumjs-abi')

var contractDefinition = artifacts.require('Avatar')
var ethmojiContractDefinition = artifacts.require('Ethmoji')
var ethmojiProxyContractDefinition = artifacts.require('EthmojiProxy')
const BigNumber = web3.BigNumber

require('chai')
.use(require('chai-as-promised'))
.use(require('chai-bignumber')(BigNumber))
.should()

contract("Avatar", accounts => { 
  var owner = accounts[0]
  var secondUser = accounts[1]
  var avatar
  var ethmojiProxy

  beforeEach(async function () { 
    avatar = await contractDefinition.new({from: owner})
    let ethmoji = await ethmojiContractDefinition.new({from: owner})
    ethmojiProxy = await ethmojiProxyContractDefinition.new({ from: owner })

    const initializeData = encodeCall('initialize', ['address'], [owner])
    await ethmojiProxy.upgradeToAndCall(ethmoji.address, initializeData, { from: owner })
    
    ethmojiProxy = await ethmojiContractDefinition.at(ethmojiProxy.address)
  })

  describe('setValidContractForAvatar', () => { 
    it('sets ethmoji as a valid avatar contract', async function () { 
      await avatar.setValidContractForAvatar(ethmojiProxy.address, {from: owner})

      let res = await avatar.isValidContractForAvatar(ethmojiProxy.address)
      res.should.be.true
    })
  })

  describe('avatar', () => { 
    beforeEach(async function () { 
      await avatar.setValidContractForAvatar(ethmojiProxy.address, {from: owner})
    })
 
    it('owner can set an avatar', async function () { 
      let compositionFee = await ethmojiProxy.minCompositionFee()
      let compPriceIncrease = compositionFee

      await ethmojiProxy.mintTo(owner, compositionFee, compPriceIncrease, false, 1, { from: owner }) //mints token 1
      let tokenOwner = await ethmojiProxy.ownerOf(1)
      tokenOwner.should.be.equal(owner)
      
      await avatar.setAvatar(ethmojiProxy.address, 1, {from: owner})
      
      let storedAvatarInfo = await avatar.getAvatar(owner)

      storedAvatarInfo[0].should.bignumber.be.equal(1)
      storedAvatarInfo[1].should.be.equal(ethmojiProxy.address)
    })

    it('not owner can not set an avatar', async function () { 
      let compositionFee = await ethmojiProxy.minCompositionFee()
      let compPriceIncrease = compositionFee

      await ethmojiProxy.mintTo(owner, compositionFee, compPriceIncrease, false, 1, { from: owner }) //mints token 1
      let tokenOwner = await ethmojiProxy.ownerOf(1)
      tokenOwner.should.be.equal(owner)
      
      await expectThrow(avatar.setAvatar(ethmojiProxy.address, 1, {from: secondUser}))
    })

    it('owner loses avatar after transfer', async function () { 
      let compositionFee = await ethmojiProxy.minCompositionFee()
      let compPriceIncrease = compositionFee

      await ethmojiProxy.mintTo(owner, compositionFee, compPriceIncrease, false, 1, { from: owner }) //mints token 1
      let tokenOwner = await ethmojiProxy.ownerOf(1)
      tokenOwner.should.be.equal(owner)
      
      await avatar.setAvatar(ethmojiProxy.address, 1, {from: owner})
      
      let storedAvatarInfo = await avatar.getAvatar(owner)

      storedAvatarInfo[0].should.bignumber.be.equal(1)
      storedAvatarInfo[1].should.be.equal(ethmojiProxy.address)

      await ethmojiProxy.transfer(secondUser, 1, { from: owner }) 

      await expectThrow(avatar.getAvatar(owner))
    })
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