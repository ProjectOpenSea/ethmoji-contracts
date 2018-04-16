// FYI: methods in the beforeEach do not get reported in eth-gas-reporter, hence the lack of useful beforeEach methods :(
  var contractDeclaration = artifacts.require("Ethmoji")
  var proxyContractDeclaration = artifacts.require("EthmojiProxy")
  var abi = require('ethereumjs-abi')

  const createKeccakHash = require('keccak')
  const BigNumber = web3.BigNumber
  require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should()
  
  contract('Ethmoji', accounts => { 
    var owner = accounts[0]
    var purchaser = accounts[1]
    var contractInstance; 
    let tx1;
    let tx2; 
    let compositionFee
    let compPriceIncrease
    let imageHash
    let imageHashTwo
    let imageHashThree
    let developerFee = 1.05
  
    beforeEach(async function() { 
      var ethmojiContractInstance = await contractDeclaration.new({ from: owner })
      var proxy = await proxyContractDeclaration.new({ from: owner })

      const initializeData = encodeCall('initialize', ['address'], [owner])
      await proxy.upgradeToAndCall(ethmojiContractInstance.address, initializeData, { from: owner })
      
      contractInstance = await contractDeclaration.at(proxy.address)

      compositionFee = await contractInstance.minCompositionFee()
      
      compPriceIncrease = new BigNumber(web3.toWei(.001, "ether"))
      imageHash = 12345
      imageHashTwo = 45678
      imageHashThree = 891
    })
  
    describe('initial state', () => { 
      it('initial state', async function () { 
        const name = await contractInstance.name()
        const symbol = await contractInstance.symbol()
    
        name.should.be.equal('Ethmoji')
        symbol.should.be.equal('EMJ')
      })
    })
  
    describe('prices', () => { 
      it('for minting a composition with default prices', async function () { 
        await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner }) //mints token 1
        await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHashTwo, { from: owner }) //mints token 2
  
        let price = await contractInstance.getTotalCompositionPrice([1, 2])
        let expectedMintingPrice = compositionFee.add(compositionFee).mul(developerFee)

        price.should.bignumber.be.equal(expectedMintingPrice)
      })
  
      it('for minting a composition with set prices', async function () { 
        let newCompositionPriceForToken1 = 1
        let newCompositionPriceForToken2 = 2
  
        let compPrice1 = new BigNumber(web3.toWei(newCompositionPriceForToken1, "ether"))
        let compPrice2 = new BigNumber(web3.toWei(newCompositionPriceForToken2, "ether"))
        
        await contractInstance.mintTo(owner, compPrice1, compPriceIncrease, false, imageHash, { from: owner }) //mints token 1
        await contractInstance.mintTo(owner, compPrice2, compPriceIncrease, false, imageHashTwo, { from: owner }) //mints token 2
  
        let price = await contractInstance.getTotalCompositionPrice([1, 2])        
        let expectedMintingPrice = (((newCompositionPriceForToken1 + newCompositionPriceForToken2) * developerFee ) / 100) * 100 //floating number math..
  
        price.toString().should.be.equal(web3.toWei(expectedMintingPrice, "ether"))
      })
  
      it('after setting global composition fee', async function () {
        await contractInstance.setMinCompositionFee(new BigNumber(web3.toWei(5, "ether")), { from: owner })
        
        let newCompositionFee = await contractInstance.minCompositionFee()
        await contractInstance.mintTo(owner, newCompositionFee, compPriceIncrease, false, imageHash, { from: owner }) //mints token 1
        await contractInstance.mintTo(owner, newCompositionFee, compPriceIncrease, false, imageHashTwo, { from: owner }) //mints token 2

        let expectedMintingPrice = (((5 + 5) * developerFee ) / 100) * 100 //floating number math..

        let price = await contractInstance.getTotalCompositionPrice([1, 2])
        price.toString().should.be.equal(web3.toWei(expectedMintingPrice, "ether"))
      })

      it('same base costs more after previous uses', async function () { 
        await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner }) //mints token 1
        await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHashTwo, { from: owner }) //mints token 2
        await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, 3, { from: owner }) //mints token 3

        let mintingPrice = await contractInstance.getTotalCompositionPrice([1, 2])

        await contractInstance.compose([1, 2], imageHashThree, { from: owner, value: mintingPrice, gasPrice: 0 }) // mints token 3
        
        let price = await contractInstance.getTotalCompositionPrice([1, 3])
        
        let expectedMintingPrice = compositionFee.add(compositionFee).add(compPriceIncrease).mul(developerFee)
  
        price.should.bignumber.be.equal(expectedMintingPrice)
      })
    })
  
    describe('minting a base token', () => { 
      let tx;
      let tokenId;
      let compositionPrice;
  
      it('emits correct log', async function () { 
        tx = await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        tx.logs[0].event.should.be.equal('Transfer')
  
        tx.logs[1].event.should.be.equal('BaseTokenCreated')
        tx.logs[2].event.should.be.equal('CompositionPriceChanged')
      })
  
      it('sets one layer (itself)', async function () { 
        tx = await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        tokenId = tx.logs[0].args._tokenId;
  
        const layers = await contractInstance.getTokenLayers(tokenId)   
        layers.length.should.be.equal(1)
        layers[0].should.be.bignumber.equal(tokenId)
      })
  
      it('sets correct owner (owner)', async function () { 
        tx = await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        tokenId = tx.logs[0].args._tokenId;
  
        const tokenOwner = await contractInstance.ownerOf(tokenId)
        tokenOwner.should.be.equal(owner)
      })
  
      it('sets correct initial composition price', async function () { 
        tx = await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        tokenId = tx.logs[0].args._tokenId;
  
        const compositionPrice = await contractInstance.getCompositionPrice(tokenId)    
        compositionPrice.should.bignumber.be.equal(compositionPrice)
      })
  
      it('updates uniqueness', async function () { 
        tx = await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        tokenId = tx.logs[0].args._tokenId;
  
        var isValidComposition = await contractInstance.isValidComposition([tokenId], imageHash)
        isValidComposition.should.be.false
      })
    })
    
    describe('uniqueness', () => {
      let tx
      let mintingPrice
  
      beforeEach(async function () { 
        for(let i = 1; i <= 10; i ++ ) { 
          await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, i, { from: owner })
        }
      })
  
      it('checks uniqueness with existing hashes layers', async function () { 
        let isUnique = await contractInstance.isValidComposition([2, 3], imageHash)
        isUnique.should.be.equal(true)
  
        mintingPrice = await contractInstance.getTotalCompositionPrice([2, 3])
        await contractInstance.compose([2, 3], imageHash, { from: owner, value: mintingPrice, gasPrice: 0 })
  
        isUnique = await contractInstance.isValidComposition([1, 2], imageHash)
        isUnique.should.be.equal(false)
  
        isUnique = await contractInstance.isValidComposition([1, 3], imageHashTwo)
        isUnique.should.be.equal(true)
      })
  
      it('using composition emoji to create an exisitng emoji breaks uniqueness', async function () { 
        mintingPrice = await contractInstance.getTotalCompositionPrice([1, 2, 3])
  
        let tx = await contractInstance.compose([1, 2], imageHash, { from: owner, value: mintingPrice, gasPrice: 0 }) // mints token 11
        let tokenId = tx.logs.filter(t => t.event == 'Transfer')[0].args._tokenId
        tokenId.should.bignumber.be.equal(11)
  
        mintingPrice = await contractInstance.getTotalCompositionPrice([1, 2, 3])
        await contractInstance.compose([1, 2, 3], imageHashTwo, { from: owner, value: mintingPrice, gasPrice: 0 }) // mints token 12
        isUnique = await contractInstance.isValidComposition([11, 3], imageHashThree)
        isUnique.should.be.equal(false)
  
        await expectThrow(contractInstance.compose([11, 3], imageHashThree, { from: owner, value: mintingPrice, gasPrice: 0 }))
      })
  
      it('checks uniqueness with duplicate layers', async function () { 
        let isUnique = await contractInstance.isValidComposition([1, 1, 2], imageHash)
        isUnique.should.be.equal(false)
      })
  
      it('checks that uniqueness fails on compositions with more than 100 layers', async function () { 
        for(let i = 1; i <= 101; i ++ ) { 
          let imageHash = i+10;
          await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        }
        let compLayers = Array.apply(null, Array(102)).map(function (_, i) { return i+1; });
        let isCompositionOnlyWithBaseLayers = await contractInstance.isCompositionOnlyWithBaseLayers()
        await expectThrow(contractInstance.isValidComposition(compLayers, 100000000))
      })
  
      it('checks that uniqueness is true on compositions with 100 layers', async function () { 
        for(let i = 1; i <= 91; i ++ ) { 
          let imageHash = i+10;
          await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        }
  
        let compLayers = Array.apply(null, Array(100)).map(function (_, i) { return i+1; });
        let isUnique = await contractInstance.isValidComposition(compLayers, imageHashTwo)
        isUnique.should.be.equal(true)
      })
  
      it('checks that uniqueness when large number is used', async function () { 
        let bigLayerId = new web3.BigNumber("9".repeat(32))
        let isUnique = await contractInstance.isValidComposition([bigLayerId, bigLayerId.plus(1), bigLayerId.plus(2)], imageHash)
        isUnique.should.be.equal(false)
      })
    })
  
    describe('minting a composition', () => { 
      let tx
      let mintingPrice
  
      beforeEach(async function () { 
        // mints token 1-10
        for(let i = 1; i <= 10; i ++ ) { 
          let imageHash = i;
          await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        }
        mintingPrice = await contractInstance.getTotalCompositionPrice([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      })
  
      it('emits correct logs', async function () { 
        let isUnique = await contractInstance.isValidComposition([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], imageHash)
        isUnique.should.be.equal(true)
  
        tx = await contractInstance.compose([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], imageHash, { from: purchaser, value: mintingPrice, gasPrice: 0 })
        
        isUnique = await contractInstance.isValidComposition([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], imageHashTwo)
        isUnique.should.be.equal(false)
  
        tx.logs[0].event.should.be.equal('RoyaltiesPaid')
        tx.logs[1].event.should.be.equal('RoyaltiesPaid')
        tx.logs[2].event.should.be.equal('RoyaltiesPaid')
        tx.logs[3].event.should.be.equal('RoyaltiesPaid')
        tx.logs[4].event.should.be.equal('RoyaltiesPaid')
        tx.logs[5].event.should.be.equal('RoyaltiesPaid')
        tx.logs[6].event.should.be.equal('RoyaltiesPaid')
        tx.logs[7].event.should.be.equal('RoyaltiesPaid')
        tx.logs[8].event.should.be.equal('RoyaltiesPaid')
        tx.logs[9].event.should.be.equal('RoyaltiesPaid')
        tx.logs[10].event.should.be.equal('Transfer')
        tx.logs[11].event.should.be.equal('CompositionTokenCreated')
      })
  
      it('caller overpays and gets the excess back', async function () {
        let balanceBeforeTransaction = web3.eth.getBalance(purchaser)
        let price = new BigNumber(web3.toWei(10, "ether"))
        tx = await contractInstance.compose([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], imageHash, { from: purchaser, value: price, gasPrice: 0 })
        
        tx.logs[0].event.should.be.equal('RoyaltiesPaid')
        tx.logs[1].event.should.be.equal('RoyaltiesPaid')
        tx.logs[2].event.should.be.equal('RoyaltiesPaid')
        tx.logs[3].event.should.be.equal('RoyaltiesPaid')
        tx.logs[4].event.should.be.equal('RoyaltiesPaid')
        tx.logs[5].event.should.be.equal('RoyaltiesPaid')
        tx.logs[6].event.should.be.equal('RoyaltiesPaid')
        tx.logs[7].event.should.be.equal('RoyaltiesPaid')
        tx.logs[8].event.should.be.equal('RoyaltiesPaid')
        tx.logs[9].event.should.be.equal('RoyaltiesPaid')
        tx.logs[10].event.should.be.equal('Transfer')
        tx.logs[11].event.should.be.equal('CompositionTokenCreated')

        let balanceAfterTransaction = web3.eth.getBalance(purchaser)
        
        balanceAfterTransaction.should.bignumber.be.equal(balanceBeforeTransaction.minus(mintingPrice))
      }) 
  
      it('composes with 100 layers', async function() { 
        for(let i = 1; i <= 65; i ++ ) { 
          let imageHash = i + 10
          await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner })
        }
        let compLayers = Array.apply(null, Array(65)).map(function (_, i) { return i + 1; });
        mintingPrice = await contractInstance.getTotalCompositionPrice(compLayers)
        tx = await contractInstance.compose(compLayers, imageHashTwo, { from: owner, value: mintingPrice, gasPrice: 0 })
      })
  
      it('has correct id', async function () { 
        tx = await contractInstance.compose([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], imageHash, { from: owner, value: mintingPrice, gasPrice: 0 })
  
        let tokenId = tx.logs.filter(t => t.event == 'Transfer')[0].args._tokenId
        tokenId.should.bignumber.be.equal(11)
      })
  
      it('has correct layers when using base emojis', async function () { 
        tx = await contractInstance.compose([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], imageHash, { from: owner, value: mintingPrice, gasPrice: 0 })
        let tokenId = tx.logs.filter(t => t.event == 'Transfer')[0].args._tokenId
        tokenId.should.be.bignumber.be.equal(11)
  
        let layers = await contractInstance.getTokenLayers(tokenId)
        layers.length.should.be.equal(10)
        layers[0].should.bignumber.be.equal(1)
        layers[1].should.bignumber.be.equal(2)
        layers[2].should.bignumber.be.equal(3)
        layers[3].should.bignumber.be.equal(4)
        layers[4].should.bignumber.be.equal(5)
        layers[5].should.bignumber.be.equal(6)
        layers[6].should.bignumber.be.equal(7)
        layers[7].should.bignumber.be.equal(8)
        layers[8].should.bignumber.be.equal(9)
        layers[9].should.bignumber.be.equal(10)
      })
  
      it('throws when using composition emoji and base emojis', async function () { 
        tx = await contractInstance.compose([1, 2], imageHash, { from: owner, value: mintingPrice, gasPrice: 0}) //token 11
        let tokenId = tx.logs.filter(t => t.event == 'Transfer')[0].args._tokenId
        tokenId.should.bignumber.be.equal(11)
  
        await expectThrow(contractInstance.compose([11, 3], imageHashTwo, { from: owner, value: mintingPrice, gasPrice: 0}))
      })
  
      it('throws when using two composition emojis', async function () { 
        tx = await contractInstance.compose([1, 2], imageHash, { from: owner, value: mintingPrice, gasPrice: 0}) //token 11
        let tokenId = tx.logs.filter(t => t.event == 'Transfer')[0].args._tokenId
        tokenId.should.bignumber.be.equal(11)
  
        tx = await contractInstance.compose([3, 4], imageHashTwo, { from: owner, value: mintingPrice, gasPrice: 0}) //token 12
        tokenId = tx.logs[2].args._tokenId
        tokenId.should.bignumber.be.equal(12)
  
        await expectThrow(contractInstance.compose([11, 12], imageHashThree, { from: owner, value: mintingPrice, gasPrice: 0}))
      })
  
      it('throws when trying to make a composite emoji with duplicate', async function () { 
        tx = await contractInstance.compose([1, 2], imageHash, { from: owner, value: mintingPrice, gasPrice: 0}) //token 11
        let tokenId = tx.logs.filter(t => t.event == 'Transfer')[0].args._tokenId
        tokenId.should.bignumber.be.equal(11)
  
        await expectThrow(contractInstance.compose([1, 2], imageHash, { from: owner, value: mintingPrice, gasPrice: 0})) //token 11
      })
    })
  
    describe('profits', () => { 
      it('gives owner of emoji profits from compostion emojis', async function () {
        //owner owns token id 1 and gets paid for compositions that use token id 1
      
        await contractInstance.mintTo(purchaser, compositionFee, compPriceIncrease, false, imageHash, { from: owner }) //mints token 1
        await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHashTwo, { from: owner }) //mints token 2
  
        let balanceOfOwnerPreTransaction = web3.eth.getBalance(owner);
        
        let mintingPrice = await contractInstance.getTotalCompositionPrice([1, 2])
        await contractInstance.compose([1, 2], compositionFee, { from: purchaser, value: mintingPrice, gasPrice: 0 })
  
        let balanceOfOwnerAfterTransaction = web3.eth.getBalance(owner);
  
        balanceOfOwnerAfterTransaction.should.bignumber.be.equal(balanceOfOwnerPreTransaction.add(compositionFee))
      })
  
      it('gives owner of emoji profits from compostion emojis with set composition price', async function () { 
        //owner owns token id 1 and gets paid for compositions that use token id 1
          await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, true, imageHash, { from: owner }) //mints token 1
        await contractInstance.mintTo(purchaser, compositionFee, compPriceIncrease, false, imageHashTwo, { from: owner }) //mints token 2
  
        let newCompositionPriceForToken1 = new BigNumber(web3.toWei(.005, "ether")) 
        await contractInstance.setCompositionPrice(1, newCompositionPriceForToken1, { from: owner })
  
        let balanceOfOwnerPreTransaction = web3.eth.getBalance(owner);
  
        let mintingPrice = await contractInstance.getTotalCompositionPrice([1, 2])
        await contractInstance.compose([1, 2], imageHashThree, { from: purchaser, value: mintingPrice, gasPrice: 0 })
  
        let balanceOfOwnerAfterTransaction = web3.eth.getBalance(owner);
  
        balanceOfOwnerAfterTransaction.should.bignumber.be.equal(balanceOfOwnerPreTransaction.add(newCompositionPriceForToken1))
      })
    })
    
    describe('payout', () => { 
      it('gives developer fee collected by the contract to specified address', async function () { 
        await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHash, { from: owner }) //mints token 1
        await contractInstance.mintTo(owner, compositionFee, compPriceIncrease, false, imageHashTwo, { from: owner }) //mints token 2
  
        let balanceOfContractPreTransaction = web3.eth.getBalance(contractInstance.address);
        let balanceOfOwnerPreTransaction = web3.eth.getBalance(owner);
  
        let mintingPrice = await contractInstance.getTotalCompositionPrice([1, 2], { from: owner, gasPrice: 0 })
        mintingPrice.should.bignumber.be.equal(compositionFee.add(compositionFee).mul(developerFee))
        await contractInstance.compose([1, 2], imageHashThree, { from: purchaser, value: mintingPrice, gasPrice: 0 })      
  
        let balanceOfOwnerPostWithdrawTransaction = web3.eth.getBalance(owner);
        balanceOfOwnerPostWithdrawTransaction.should.bignumber.be.equal(balanceOfOwnerPreTransaction.add(compositionFee.add(compositionFee)))
  
        let balanceOfContractAfterMinting = web3.eth.getBalance(contractInstance.address);
        balanceOfContractAfterMinting.should.bignumber.be.equal(compositionFee.add(compositionFee).mul(developerFee).minus(compositionFee.add(compositionFee)))
  
        await contractInstance.payout(owner, { from: owner, gasPrice: 0 })
  
        let balanceOfContractAfterTransaction = web3.eth.getBalance(contractInstance.address);
        let balanceOfOwnerAfterTransaction = web3.eth.getBalance(owner);
  
        balanceOfOwnerAfterTransaction.should.bignumber.be.equal(balanceOfOwnerPostWithdrawTransaction.add(balanceOfContractAfterMinting))
        balanceOfContractAfterTransaction.should.bignumber.be.equal(balanceOfContractPreTransaction)
      })
    })
  
    describe('transfer ownership', () => { 
      let newAddress
      beforeEach(async function () { 
        newAddress = accounts[2];
      })
      
      it('account does not have access to contract owner only functions', async function () { 
          await expectThrow(contractInstance.payout(newAddress, {from : newAddress}))
      })
  
      it('non contract owner cannot set contract owners', async function () { 
          await expectThrow(contractInstance.transferOwnership(newAddress, {from : newAddress}))
      })
  
      it('account does have access to contract owner only functions after it is set as owner', async function () { 
        await contractInstance.transferOwnership(newAddress, { from: owner })
        let tx = await contractInstance.payout(newAddress, {from : newAddress})
        tx.should.be.not.null
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
    