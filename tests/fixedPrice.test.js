/* eslint-disable no-undef */
require('dotenv').config({ path: './.env' })
const { BN } = require('@zilliqa-js/util')
const { scillaJSONParams } = require("@zilliqa-js/scilla-json-utils");
const { default: BigNumber } = require('bignumber.js')
const { getAddressFromPrivateKey, schnorr } = require('@zilliqa-js/crypto')
const { deployAllowlistContract } = require('../scripts/marketplace/deployAllowlistContract.js')
const { deployFixedPriceContract } = require('../scripts/marketplace/deployFixedPriceContract.js')
const { deployFungibleToken } = require('../scripts/deployFungibleToken.js')

const { deployNonFungibleToken } = require('../scripts/deployNonFungibleToken.js')
 const {
   setupBalancesOnAccounts,
   clearBalancesOnAccounts
} = require('../scripts/utils/call.js')

// const { getContractState } = require('../scripts/utils/deploy.js')
const { callContract, getBalance } = require('../scripts/utils/call.js')
const { getBlockNumber } = require('../scripts/utils/helper')
const { zilliqa } = require('../scripts/utils/zilliqa.js')

const {
  TX_PARAMS,
  asyncNoop,
  ZERO_ADDRESS
} = require("./config");


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
  },
}

let paymentTokenAddress;
let fixedPriceAddress;
let nftTokenAddress;
let allowlistAddress;

beforeEach(async () => {
  await setupBalancesOnAccounts(accounts)
  globalBNum = await getBlockNumber(zilliqa);

  // Contract Deployments
  const fungibleTokenDeployParams = {
    name: 'wZIL',
    symbol: null,
    decimals: 12,
    supply: new BN('10000000000000000'),
    dexCheck: 'True'
  }
  const [paymentToken] = await deployFungibleToken(
    accounts.contractOwner.privateKey,
    fungibleTokenDeployParams,
    accounts.contractOwner.address
  )
  paymentTokenAddress = paymentToken.address
  if (paymentTokenAddress === undefined) {
    throw new Error();
  }

  const [fixedPriceContract] = await deployFixedPriceContract(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address
    }
  ) 
  fixedPriceAddress = fixedPriceContract.address
  console.log('fixedPriceContract =', fixedPriceAddress)
  if (fixedPriceAddress === undefined) {
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
    fixedPriceContract,
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

  // Set wZil as an allowed payment token
  await callContract(
    accounts.contractOwner.privateKey,
    fixedPriceContract,
    'AllowPaymentTokenAddress',
    [
      {
        vname: 'address',
        type: "ByStr20",
        value: paymentTokenAddress,
      }
    ],
    0,
    false,
    false
  )

  // Increasing the amount of wZIL the fixedPriceContract can spend
  await callContract(
    accounts.nftBuyer.privateKey,
    paymentToken,
    'IncreaseAllowance',
    [
      {
        vname: 'spender',
        type: "ByStr20",
        value: fixedPriceAddress,
      },
      {
        vname: 'amount',
        type: "Uint128",
        value: String(100 * 1000),
      }
    ],
    0,
    false,
    false
  )

  // Executing for token_id 1,2,3
  for (let i = 1; i < 4; i++) {
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
          value: String(i),
        }
      ],
      0,
      false,
      false
  )}
})






async function createFixedPriceOrder(
    fixedPriceContractAddress,
    tokenAddress, 
    tokenId, 
    paymentTokenAddress, 
    salePrice, 
    side, 
    expirationBnum
  ) {
  return {
    constructor: `${fixedPriceContractAddress.toLowerCase()}.OrderParam`,
    argtypes: [],
    arguments: [tokenAddress, tokenId, paymentTokenAddress, salePrice, side, expirationBnum]
  }
}

async function createPairADT(address, string) {
  return {
    constructor: "Pair",
    argtypes: ["ByStr20", "String"],
    arguments: [address, string],
  }
}

describe('Native ZIL', () => {
  test('SetOrder: throws NotAllowedUserError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    
    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      paymentTokenAddress.toLowerCase(),
      '10000',
      '0',
      String(globalBNum + 35)
    )

    const tx = await callContract(
      accounts.forbidden.privateKey,
      fixedPriceContract,
      'SetOrder',
      [
        {
          vname: 'order',
          type: `${fixedPriceAddress}.OrderParam`,
          value: formattedAdtOrder
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
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -19))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
    })

  // test('SetOrder: throws NotTokenOwnerError', () => {})
  // test('SetOrder: throws TokenOwnerError', () => {})
  // test('SetOrder: throws NotSelfError (stranger must not update the order)', () => {})
  // test('SetOrder: buyer updates expiration_bnum of buy orde', () => {})
  // test('SetOrder: Seller creates sell order for token #1', () => {})
  // test('SetOrder: Buyer creates buy order for token #1', () => {})
  // test('FulfillOrder: throws NotAllowedUserError', () => {})
  // test('FulfillOrder: throws SellOrderNotFoundError', () => {})
  // test('FulfillOrder: throws BuyOrderNotFoundError', () => {})
  // test('FulfillOrder: throws ExpiredError', () => {})
  // test('FulfillOrder: throws NotEqualAmountError', () => {})
  // test('FulfillOrder: Buyer fullfills sell order', () => {})
  // test('FulfillOrder: Seller fullfills buy order', () => {})
  // test('CancelOrder: throws NotAllowedToCancelOrder by stranger', () => {})
  // test('CancelOrder: Buyer cancels buy order', () => {})
  // test('CancelOrder: Seller cancels sell order', () => {})
})
describe('Wrapped ZIL', () => {
  // test('SetOrder: throws NotAllowedPaymentToken', () => {})
  // test('SetOrder: throws NotTokenOwnerError (stranger creates sell order for token #1)', () => {})
  // test('SetOrder: throws TokenOwnerError (seller must not create a buy order for token #1)', () => {})
  // test('SetOrder: throws NotSelfError (stranger must not update the order)', () => {})
  // test('SetOrder: buyer updates expiration_bnum of buy order', () => {})
  // test('SetOrder: Seller creates sell order for token #1', () => {})
  // test('SetOrder: Buyer creates buy order for token #1', () => {})
  // test('FulfillOrder: throws SellOrderNotFoundError', () => {})
  // test('FulfillOrder: throws BuyOrderNotFoundError', () => {})
  // test('FulfillOrder: throws ExpiredError', () => {})
  // test('FulfillOrder: Buyer fullfills sell order', () => {})
  // test('FulfillOrder: Seller fullfills buy order', () => {})
  // test('CancelOrder: throws NotAllowedToCancelOrder by stranger', () => {})
  // test('CancelOrder: Buyer cancels buy order', () => {})
  // test('CancelOrder: Seller cancels sell order', () => {})
})




// async function setup() {
//   const fungibleTokenDeployParams = {
//     name: 'wZIL',
//     symbol: null,
//     decimals: 12,
//     supply: new BN('10000000000000000'),
//     dexCheck: 'True'
//   }
//   const [paymentToken] = await deployFungibleToken(
//     accounts.nftBuyer.privateKey,
//     fungibleTokenDeployParams,
//     accounts.nftBuyer.address
//   )

//   const [fixedPriceContract] = await deployFixedPriceContract(
//     accounts.contractOwner.privateKey,
//     {
//       initialOwnerAddress: accounts.contractOwner.address
//     }
//   ) 

//   const nonFungibleTokenDeployParams = {
//     name: 'TestNFTToken1',
//     symbol: null,
//     baseURI: 'https://ipfs.io/ipfs/'
//   }
//   const [nftContract] = await deployNonFungibleToken(
//     accounts.nftSeller.privateKey,
//     nonFungibleTokenDeployParams,
//     accounts.nftSeller.address,
//   )
//   return [fixedPriceContract.address, nftContract.address, paymentToken.address]
// }