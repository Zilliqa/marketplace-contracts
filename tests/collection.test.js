/* eslint-disable no-undef */
require('dotenv').config({ path: './.env' })
const { BN, bytes, units } = require('@zilliqa-js/util')
const { scillaJSONParams, scillaJSONVal } = require("@zilliqa-js/scilla-json-utils");
const { default: BigNumber } = require('bignumber.js')
const { getAddressFromPrivateKey, schnorr } = require('@zilliqa-js/crypto')
const { deployAllowlistContract } = require('../scripts/marketplace/deployAllowlistContract.js')
const { deployFixedPriceContract } = require('../scripts/marketplace/deployFixedPriceContract.js')
const { deployFungibleToken } = require('../scripts/deployFungibleToken.js')
const { deployCollectionContract } = require('../scripts/marketplace/deployCollectionContract.js')

const { deployNonFungibleToken } = require('../scripts/deployNonFungibleToken.js')
 const {
   setupBalancesOnAccounts,
   clearBalancesOnAccounts,
   transfer
} = require('../scripts/utils/call.js')

// const { getContractState } = require('../scripts/utils/deploy.js')
const { callContract, getBalance } = require('../scripts/utils/call.js')
const { getBlockNumber } = require('../scripts/utils/helper')
const { zilliqa } = require('../scripts/utils/zilliqa.js')

const {
  TX_PARAMS,
  FAUCET_PARAMS,
  asyncNoop,
  ZERO_ADDRESS
} = require("./config");

const zero_address = "0x0000000000000000000000000000000000000000"

const accounts = {
  'contractOwner': {
    'privateKey': process.env.MASTER_PRIVATE_KEY,
    'address': getAddressFromPrivateKey(process.env.MASTER_PRIVATE_KEY)
  },
  'nftSeller': {
    'privateKey': process.env.SELLER_PRIVATE_KEY,
    'address': getAddressFromPrivateKey(process.env.SELLER_PRIVATE_KEY)
  },
  'nftBuyer': {
    'privateKey': process.env.BUYER_PRIVATE_KEY,
    'address': getAddressFromPrivateKey(process.env.BUYER_PRIVATE_KEY)
  },
  'stranger': {
    'privateKey': process.env.N_01_PRIVATE_KEY,
    'address': getAddressFromPrivateKey(process.env.N_01_PRIVATE_KEY)
  },
  'forbidden': {
    'address': getAddressFromPrivateKey(process.env.N_02_PRIVATE_KEY),
    'privateKey': process.env.N_02_PRIVATE_KEY
  }
}

let fixedPriceAddress;
let nftTokenAddress;
let allowlistAddress;

async function createCollectionItemParam(
    collectionContractAddress,
    tokenAddress, 
    tokenId, 
    collection_id, 
  ) {
  return {
    constructor: `${collectionContractAddress.toLowerCase()}.CollectionItemParam`,
    argtypes: [],
    arguments: [tokenAddress.toLowerCase(), tokenId, collection_id]
  }
}

async function createPairADT(address, string) {
  return {
    constructor: "Pair",
    argtypes: ["ByStr20", "String"],
    arguments: [address, string],
  }
}

beforeAll(async () => {
  await setupBalancesOnAccounts(accounts)
})

afterAll(async () => {
  await clearBalancesOnAccounts(accounts)
})

beforeEach(async () => {
  globalBNum = await getBlockNumber(zilliqa);

  const [collectionContract] = await deployCollectionContract(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address
    }
  )
  collectionContractAddress = collectionContract.address
  if (collectionContractAddress === undefined) {
    throw new Error();
  }

  const [allowlistContract] = await deployAllowlistContract(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address
    }
  )
  allowlistAddress = allowlistContract.address
  if (allowlistAddress === undefined) {
    throw new Error();
  }

  const nonFungibleTokenDeployParams = {
    name: 'TestNFTToken1',
    symbol: null,
    baseURI: 'https://ipfs.io/ipfs/'
  }
  const [nftContract] = await deployNonFungibleToken(
    accounts.nftSeller.privateKey,
    nonFungibleTokenDeployParams,
    accounts.nftSeller.address,
  )
  nftTokenAddress = nftContract.address
  if (nftTokenAddress === undefined) {
    throw new Error();
  }

  // ACCOUNT PREP

  // Whitelist addresses
  await callContract(
    accounts.contractOwner.privateKey,
    allowlistContract,
    'Allow',
    [
      {
        vname: 'address_list',
        type: 'List (ByStr20)',
        value: [
          accounts.contractOwner.address,
          accounts.nftSeller.address,
          accounts.nftBuyer.address,
          accounts.stranger.address,
        ],
      }
    ],
    0,
    false,
    false
  )

  // Set the allowlist Contract
  await callContract(
    accounts.contractOwner.privateKey,
    collectionContract,
    'SetAllowlist',
    [
      {
        vname: 'address',
        type: "ByStr20",
        value: allowlistAddress,
      }
    ],
    0,
    false,
    false
  )
    
  // Batch-mint some NFTs
  const pair = await createPairADT(accounts.nftSeller.address, "")

  await callContract(
    accounts.nftSeller.privateKey,
    nftContract,
    'BatchMint',
    [
      {
        vname: 'to_token_uri_pair_list',
        type: "List (Pair (ByStr20) (String))",
        value: [pair, pair, pair],
      }
    ],
    0,
    false,
    false
  )
  
  // only token_id 1 to make tests run faster
  await callContract(
    accounts.nftSeller.privateKey,
    nftContract,
    'SetSpender',
    [
      {
        vname: 'spender',
        type: "ByStr20",
        value: fixedPriceAddress,
      },
      {
        vname: 'token_id',
        type: "Uint256",
        value: String(1),
      }
    ],
    0,
    false,
    false
  )
})


describe('User Transitions', () => {
  beforeEach(async () => {

    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const tx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'CreateCollection',
      [
        {
          vname: 'commission_fee',
          type: "Uint128",
          value: "200"
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)
    
  })

  test('CreateCollection: throws NotAllowedUserError', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const tx = await callContract(
      accounts.forbidden.privateKey,
      collectionContract,
      'CreateCollection',
      [
        {
          vname: 'commission_fee',
          type: "Uint128",
          value: "200"
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -15))])'
      },
      { line: 1, message: 'Raised from CreateCollection' }
    ])

    // Add validation for correct state changes
  })

  test('CreateCollection: throws CommissionFeeTooHigh', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const tx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'CreateCollection',
      [
        {
          vname: 'commission_fee',
          type: "Uint128",
          value: "2500"
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -5))])'
      },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from CreateCollection' }
    ])

    // Add validation for correct state changes
  })

  test('CreateCollection: Brand creates a collection', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const tx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'CreateCollection',
      [
        {
          vname: 'commission_fee',
          type: "Uint128",
          value: "200"
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)

    // Add validation for event
    // Add validation for correct state changes
  })
  
  test('RequestTokenToCollection: Brand sends a single request', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)
    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    console.log(collectionItem)

    const tx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)

    // Add validation for event
    // Add validation for correct state changes
  })

  test('RequestTokenToCollection: throws SenderIsNotBrandOwner', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)
    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    console.log(collectionItem)

    const tx = await callContract(
      accounts.forbidden.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -7))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequestTokenToCollection' }
    ])
  })

  test('RequestTokenToCollection: throws CollectionIdDoesNotExist', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)
    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "999"
    )

    const tx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -8))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequestTokenToCollection' }
    ])
  })
  // test.only('RequestTokenToCollection: throws RequireTokenNotInCollection', async () => {})

  test('RequestTokenToCollection: throws RequireNotPaused', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)
    const tx01 = await callContract(
      accounts.contractOwner.privateKey,
      collectionContract,
      'Pause',
      [],
      0,
      false,
      false
    )
    expect(tx01.receipt.success).toEqual(true)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const tx02 = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(tx02.receipt.success).toEqual(false)
    expect(tx02.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -13))])'
      },
      { line: 1, message: 'Raised from RequestTokenToCollection' }
    ])
  })
  // test.only('BatchRequestTokenToCollection: Brand sends multiple requests', async () => {})
  

  test('DeleteRequestTokenToCollection: Brand deletes a request', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(sendRequestTx.receipt.success).toEqual(true)

    const deleteRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'DeleteRequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(deleteRequestTx.receipt.success).toEqual(true)
  })

  test('DeleteRequestTokenToCollection: throws SenderIsNotBrandOwner', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(sendRequestTx.receipt.success).toEqual(true)


    const deleteRequestTx = await callContract(
      accounts.nftBuyer.privateKey,
      collectionContract,
      'DeleteRequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    console.log(deleteRequestTx.receipt.exceptions)
    expect(deleteRequestTx.receipt.success).toEqual(false)
    expect(deleteRequestTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -7))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from DeleteRequestTokenToCollection' }
    ])
  })


  test('DeleteRequestTokenToCollection: throws RequireNotPaused', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(sendRequestTx.receipt.success).toEqual(true)

    const pauseContractTx = await callContract(
      accounts.contractOwner.privateKey,
      collectionContract,
      'Pause',
      [],
      0,
      false,
      false
    )

    expect(pauseContractTx.receipt.success).toEqual(true)
    // Check Event
    // Check State

    const deleteRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'DeleteRequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(deleteRequestTx.receipt.success).toEqual(false)
    expect(deleteRequestTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -13))])'
      },
      { line: 1, message: 'Raised from DeleteRequestTokenToCollection' }
    ])
  })

  test('DeleteRequestTokenToCollection: throws RequestDoesNotExist', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(sendRequestTx.receipt.success).toEqual(true)

    const nonExistantCollectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "999"
    )

    const deleteRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'DeleteRequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: nonExistantCollectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(deleteRequestTx.receipt.success).toEqual(false)
    expect(deleteRequestTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -8))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from DeleteRequestTokenToCollection' }
    ])


  })
  // test.only('BatchDeleteRequestTokenToCollection: Brand owner deletes multiple requests', async () => {})

  test('AcceptCollectionRequest: throws SenderIsNotTokenOwner', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(sendRequestTx.receipt.success).toEqual(true)

    const acceptRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'AcceptCollectionRequest',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )


    expect(acceptRequestTx.receipt.success).toEqual(false)
    expect(acceptRequestTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -4))])'
      },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from AcceptCollectionRequest' }
    ])
  })

  // test.only('AcceptCollectionRequest: throws RequireTokenNotInCollection', async () => {}) // not sure if this error is even reachable

  // test.only('AcceptCollectionRequest: throws RequireAllowedUser', async () => {})
  test('AcceptCollectionRequest: throws RequireNotPaused', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(sendRequestTx.receipt.success).toEqual(true)

    const pauseContractTx = await callContract(
      accounts.contractOwner.privateKey,
      collectionContract,
      'Pause',
      [],
      0,
      false,
      false
    )
    expect(pauseContractTx.receipt.success).toEqual(true)


    const acceptRequestTx = await callContract(
      accounts.nftSeller.privateKey,
      collectionContract,
      'AcceptCollectionRequest',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(acceptRequestTx.receipt.success).toEqual(false)
    expect(acceptRequestTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -13))])'
      },
      { line: 1, message: 'Raised from AcceptCollectionRequest' }
    ])
  })

  test('AcceptCollectionRequest: NFT owner accepts a collection request', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    expect(sendRequestTx.receipt.success).toEqual(true)

    const acceptRequestTx = await callContract(
      accounts.nftSeller.privateKey,
      collectionContract,
      'AcceptCollectionRequest',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(acceptRequestTx.receipt.success).toEqual(true)
  })

  // test.only('BatchAcceptCollectionRequest: NFT owner accepts multiple collection requests', async () => {})
  // test.only('BatchAcceptCollectionRequest: NFT owner can not accept colliding requests', async () => {})

  test('RemoveTokenFromCollection: Brand removes NFT from their collection', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    
    expect(sendRequestTx.receipt.success).toEqual(true)

    const acceptRequestTx = await callContract(
      accounts.nftSeller.privateKey,
      collectionContract,
      'AcceptCollectionRequest',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(acceptRequestTx.receipt.success).toEqual(true)

    const removeFromCollectionTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RemoveTokenFromCollection',
      [
        {
          vname: 'token',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(removeFromCollectionTx.receipt.success).toEqual(true)
  })

  // test.only('RemoveTokenFromCollection: throws RequireAllowedUser', async () => {})

  test('RemoveTokenFromCollection: throws RequireBrandOwner', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )

    
    expect(sendRequestTx.receipt.success).toEqual(true)

    const acceptRequestTx = await callContract(
      accounts.nftSeller.privateKey,
      collectionContract,
      'AcceptCollectionRequest',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(acceptRequestTx.receipt.success).toEqual(true)

    const removeFromCollectionTx = await callContract(
      accounts.nftBuyer.privateKey,
      collectionContract,
      'RemoveTokenFromCollection',
      [
        {
          vname: 'token',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
      expect(removeFromCollectionTx.receipt.success).toEqual(false)
    expect(removeFromCollectionTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -7))])'
      },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RemoveTokenFromCollection' }
    ])
  })

  test('RemoveTokenFromCollection: throws RequireNotPaused', async () => {
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress, 
      nftTokenAddress, 
      "1", 
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RequestTokenToCollection',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(sendRequestTx.receipt.success).toEqual(true)

    const acceptRequestTx = await callContract(
      accounts.nftSeller.privateKey,
      collectionContract,
      'AcceptCollectionRequest',
      [
        {
          vname: 'request',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
    expect(acceptRequestTx.receipt.success).toEqual(true)

    const pauseTx = await callContract(
      accounts.contractOwner.privateKey,
      collectionContract,
      'Pause',
      [],
      0,
      false,
      false
    )
    expect(pauseTx.receipt.success).toEqual(true)


    const removeFromCollectionTx = await callContract(
      accounts.stranger.privateKey,
      collectionContract,
      'RemoveTokenFromCollection',
      [
        {
          vname: 'token',
          type: `${collectionContractAddress}.CollectionItemParam`,
          value: collectionItem
        }
      ],
      0,
      false,
      false
    )
  
    expect(removeFromCollectionTx.receipt.success).toEqual(false)
    expect(removeFromCollectionTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -13))])'
      },
      { line: 1, message: 'Raised from RemoveTokenFromCollection' }
    ])
  })

  // test.only('BatchRemoveTokenFromCollection: Brand removes multiple NFTs from their collection', async () => {})

})


// describe('Admin Transitions', () => {
  // beforeEach(async () => {})


// })