/* eslint-disable no-undef */
require('dotenv').config({ path: './.env' })
const { BN } = require('@zilliqa-js/util')
const { scillaJSONVal } = require("@zilliqa-js/scilla-json-utils");
const { getAddressFromPrivateKey, schnorr } = require('@zilliqa-js/crypto')
const { deployAllowlistContract } = require('../scripts/marketplace/deployAllowlistContract.js')
const { deployFixedPriceContract } = require('../scripts/marketplace/deployFixedPriceContract.js')
const { deployFungibleToken } = require('../scripts/deployFungibleToken.js')
const { deployCollectionContract } = require('../scripts/marketplace/deployCollectionContract.js')
const { addTokenToCollection } = require('../scripts/marketplace/addTokenToCollection')

const { deployNonFungibleToken } = require('../scripts/deployNonFungibleToken.js')
const { setupBalancesOnAccounts, clearBalancesOnAccounts, } = require('../scripts/utils/call.js')

const { callContract, getBalance, getZRC2State } = require('../scripts/utils/call.js')
const { getBlockNumber } = require('../scripts/utils/helper')
const { zilliqa } = require('../scripts/utils/zilliqa.js');

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
  },
  'address01': {
    'address': getAddressFromPrivateKey(process.env.TOKEN1_PRIVATE_KEY),
    'privateKey': process.env.N_01_PRIVATE_KEY
  },
  'address02': {
    'address': getAddressFromPrivateKey(process.env.TOKEN2_PRIVATE_KEY),
    'privateKey': process.env.N_02_PRIVATE_KEY
  },
  'address03': {
    'address': getAddressFromPrivateKey(process.env.N_03_PRIVATE_KEY),
    'privateKey': process.env.N_03_PRIVATE_KEY
  },
  'address04': {
    'address': getAddressFromPrivateKey(process.env.N_04_PRIVATE_KEY),
    'privateKey': process.env.N_04_PRIVATE_KEY
  },
}

let paymentTokenAddress;
let fixedPriceAddress;
let nftTokenAddress;
let allowlistAddress;
let notAllowedpaymentTokenAddress;
let collectionContractAddress;
let paymentTokenAddress1;
let paymentTokenAddress2;

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

beforeAll(async () => {
  await setupBalancesOnAccounts(accounts)
})

afterAll(async () => {
  await clearBalancesOnAccounts(accounts)
})

beforeEach(async () => {
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

  const notAllowedfungibleTokenDeployParams = {
    name: 'wYIL',
    symbol: null,
    decimals: 12,
    supply: new BN('10000000000000000'),
    dexCheck: 'True'
  }
  const [notAllowedpaymentToken] = await deployFungibleToken(
    accounts.contractOwner.privateKey,
    notAllowedfungibleTokenDeployParams,
    accounts.contractOwner.address
  )
  notAllowedpaymentTokenAddress = notAllowedpaymentToken.address
  if (notAllowedpaymentTokenAddress === undefined) {
    throw new Error();
  }

  const fungibleTokenDeployParams1 = {
    name: 'xSGD',
    symbol: 'xSGD',
    decimals: 6,
    supply: new BN('10000000000000000'),
    dexCheck: 'True'
  }
  const [paymentToken1] = await deployFungibleToken(
    accounts.contractOwner.privateKey,
    fungibleTokenDeployParams1,
    accounts.contractOwner.address
  )
  paymentTokenAddress1 = paymentToken1.address
  if (paymentTokenAddress1 === undefined) {
    throw new Error();
  }

  const fungibleTokenDeployParams2 = {
    name: 'xIDR',
    symbol: 'xIDR',
    decimals: 6,
    supply: new BN('10000000000000000'),
    dexCheck: 'True'
  }
  const [paymentToken2] = await deployFungibleToken(
    accounts.contractOwner.privateKey,
    fungibleTokenDeployParams2,
    accounts.contractOwner.address
  )
  paymentTokenAddress2 = paymentToken2.address
  if (paymentTokenAddress2 === undefined) {
    throw new Error();
  }

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


  const [fixedPriceContract] = await deployFixedPriceContract(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address,
      collectionContract: collectionContract.address.toLowerCase()
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

  // Set xSGD as an allowed payment token
  await callContract(
    accounts.contractOwner.privateKey,
    fixedPriceContract,
    'AllowPaymentTokenAddress',
    [
      {
        vname: 'address',
        type: "ByStr20",
        value: paymentTokenAddress1,
      }
    ],
    0,
    false,
    false
  )

  // Set xIDR as an allowed payment token
  await callContract(
    accounts.contractOwner.privateKey,
    fixedPriceContract,
    'AllowPaymentTokenAddress',
    [
      {
        vname: 'address',
        type: "ByStr20",
        value: paymentTokenAddress2,
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

  // Increasing the amount of xSGD the fixedPriceContract can spend
  await callContract(
    accounts.nftBuyer.privateKey,
    paymentToken1,
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

  // Increasing the amount of xIDR the fixedPriceContract can spend
  await callContract(
    accounts.nftBuyer.privateKey,
    paymentToken2,
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

  // set spender for token_id 2
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
        value: String(2),
      }
    ],
    0,
    false,
    false
  )

  const tx = await callContract(
    accounts.contractOwner.privateKey,
    collectionContract,
    'RegisterMarketplaceAddress',
    [
      {
        vname: 'address',
        type: "ByStr20",
        value: fixedPriceAddress.toLowerCase(),
      }
    ],
    0,
    false,
    false
  )
  expect(tx.receipt.success).toEqual(true)
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

async function createOrder(_tokenId, _salePrice, _side, _expiryBlock, _paymentToken) {
  const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
  const formattedAdtOrder = await createFixedPriceOrder(
    fixedPriceAddress,
    nftTokenAddress,
    _tokenId,
    _paymentToken,
    _salePrice,
    _side,
    _expiryBlock
  )

  const tx = await callContract(
    accounts.nftSeller.privateKey,
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

  expect(tx.receipt.success).toEqual(true)
  return tx;
}

describe('Native ZIL', () => {
  beforeEach(async () => {
    // First we succesfully create a sell order
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const sellOrderParams = {
      tokenId: String(1),
      paymentToken: '0x0000000000000000000000000000000000000000',
      //price: new BN("10000"),
      price: "10000",
      side: "0",
      expiryBlock: String(globalBNum + 20)
    }

    const buyOrderParams = {
      tokenId: String(1),
      paymentToken: '0x0000000000000000000000000000000000000000',
      price: "10000",
      side: "1",
      expiryBlock: String(globalBNum + 20)
    }

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedSaleAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      sellOrderParams.tokenId,
      sellOrderParams.paymentToken,
      sellOrderParams.price,
      sellOrderParams.side,
      sellOrderParams.expiryBlock
    )

    const txSellOrder = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'SetOrder',
      [
        {
          vname: 'order',
          type: `${fixedPriceAddress}.OrderParam`,
          value: formattedSaleAdtOrder
        }
      ],
      0,
      false,
      false
    )

    const txEvent = txSellOrder.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'SetOrder'
    )[0]


    // console.log(txSellOrder.receipt)
    // expect(txSellOrder.receipt.success).toEqual(true)

    const contractState = await fixedPriceContract.getState()
    const sellOrders = contractState.sell_orders

    const newSellOrder = Object.keys(sellOrders).filter(
      (order) =>
        order.includes(1)
    )


    // Then a buy order for the same token_id
    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedBuyAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      buyOrderParams.tokenId,
      buyOrderParams.paymentToken,
      buyOrderParams.price,
      buyOrderParams.side,
      buyOrderParams.expiryBlock
    )

    const txBuyOrder = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'SetOrder',
      [
        {
          vname: 'order',
          type: `${fixedPriceAddress}.OrderParam`,
          value: formattedBuyAdtOrder
        }
      ],
      buyOrderParams.price,
      false,
      false
    )

    // const event = txBuyOrder.receipt.event_logs.filter(
    //   (e) =>
    //     e._eventname === 'DeleteDis'
    // )[0]

    // console.log('event', event)

    // console.dir(txBuyOrder, { depth: null })
    expect(txBuyOrder.receipt.success).toEqual(true)
  })

  test('SetOrder: throws NotAllowedUserError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      '0x0000000000000000000000000000000000000000',
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

    console.log(tx.receipt.exceptions)
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

  test('SetOrder: throws NotTokenOwnerError (stranger creates sell order for token #1)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      zero_address,
      '20000',
      '0',
      String(globalBNum + 35)
    )

    const tx = await callContract(
      accounts.stranger.privateKey,
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

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -9))])'
      },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: throws TokenOwnerError (seller creates buy order for token #1)', async () => {

    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      zero_address,
      '20000',
      '1',
      String(globalBNum + 35)
    )

    const tx = await callContract(
      accounts.nftSeller.privateKey,
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

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -10))])'
      },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])

  })

  test('SetOrder: throws NotSelfError (stranger must not update the order)', async () => {
    // tx pass when it maybe shouldnt? Is a stranger allowed to do a SetOrder (buy) on a token not his?  

    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      zero_address,
      '10000',
      '1',
      String(globalBNum + 35)
    )

    const tx = await callContract(
      accounts.stranger.privateKey,
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

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -13))])'
      },
      { line: 1, message: 'Raised from RequireSenderNotToBeTokenOwner' },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])


  })

  test('SetOrder: buyer updates expiration_bnum of buy order', async () => {
    // This is not updating an order, simply setting the value on the first order. Should be Changed

    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)
    const newExpiryBlock = String(globalBNum + 99999)


    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      salePrice,
      side,
      newExpiryBlock
    )

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
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

    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'SetOrder'
    )[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(newExpiryBlock)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceContract.getState()
    console.log(contractState.buy_orders)

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [zero_address.toLowerCase()]: {
              [10000]: scillaJSONVal(
                `${fixedPriceAddress}.Order.Order.of.ByStr20.BNum`,
                [accounts.nftBuyer.address, newExpiryBlock]
              ),
            },
          },
        },
      })
    );
  })

  test('SetOrder: Seller creates sell order for token #1', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(20000)
    const side = String(0)
    const expiryBlock = String(globalBNum + 35)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      salePrice,
      side,
      expiryBlock
    )

    const tx = await callContract(
      accounts.nftSeller.privateKey,
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


    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'SetOrder'
    )[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(expiryBlock)
  })

  test('SetOrder: Buyer creates buy order for token #1', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const fixedPriceStartingBalance = await getBalance(fixedPriceAddress)
    const buyerStartingBalance = await getBalance(accounts.nftBuyer.address)

    const tokenId = String(1)
    const salePrice = String(20000)
    const side = String(1)
    const expiryBlock = String(globalBNum + 35)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      salePrice,
      side,
      expiryBlock
    )

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'SetOrder',
      [
        {
          vname: 'order',
          type: `${fixedPriceAddress}.OrderParam`,
          value: formattedAdtOrder
        }
      ],
      salePrice,
      false,
      false
    )

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'SetOrder'
    )[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(expiryBlock)

    // Confirming that the token balance of buyer and contract updated correctly
    const fixedPriceEndingBalance = await getBalance(fixedPriceAddress)
    const buyerEndingBalance = await getBalance(accounts.nftBuyer.address)

    const txFee = parseInt(tx.receipt.cumulative_gas) * parseInt(tx.gasPrice);
    // const bid = new BN(salePrice
    const totalExpense = parseInt(salePrice + txFee)

    console.log('starting Balance:', buyerStartingBalance)
    console.log('ending balance:', buyerEndingBalance)
    console.log('gas total cost:', txFee)
    console.log('buy offer + gas total cost:', parseInt(salePrice) + txFee)

    expect(parseInt(fixedPriceEndingBalance)).toBe(parseInt(fixedPriceStartingBalance) + parseInt(salePrice))
    // expect(parseInt(buyerEndingBalance)).toBe((totalExpense) - parseInt(buyerStartingBalance))

    // Confirming that our buy order was executed correctly by reading the contract state
    const contractState = await fixedPriceContract.getState();

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [zero_address]: {
              [10000]: scillaJSONVal(
                `${fixedPriceAddress}.Order.Order.of.ByStr20.BNum`,
                [accounts.nftBuyer.address, contractState.buy_orders[nftTokenAddress.toLowerCase()][1][zero_address.toLowerCase()][10000].arguments[1]]
              ),
              [salePrice]: scillaJSONVal(
                `${fixedPriceAddress}.Order.Order.of.ByStr20.BNum`,
                [accounts.nftBuyer.address, expiryBlock]
              ),
            },
          },
        },
      })
    );
  })

  test('SetBatchOrder: throws PausedError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const orderList = []

    const tokenId = String(1)
    const salePrice = String(20000)
    const side = String(0)
    const expiryBlock = String(globalBNum + 35)

    const pauseTx = await callContract(
      accounts.contractOwner.privateKey,
      fixedPriceContract,
      "Pause",
      [],
      0,
      false,
      false
    );

    expect(pauseTx.receipt.success).toEqual(true);

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      salePrice,
      side,
      expiryBlock
    )

    for (let i = 1; i < 4; i++) {
      orderList.push(formattedAdtOrder)
    }

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'SetBatchOrder',
      [
        {
          vname: 'order_list',
          type: `List ${fixedPriceAddress}.OrderParam`,
          value: orderList
        }
      ],
      0,
      false,
      false
    )


    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
  })

  test('FulfillOrder: throws NotAllowedUserError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.forbidden.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
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
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: throws SellOrderNotFoundError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(999)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual(
      [
        {
          line: 1,
          message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -6))])'
        },
        { line: 1, message: 'Raised from RequireValidDestination' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireNotPaused' },
        { line: 1, message: 'Raised from FulfillOrder' }
      ]
    )
  })

  test('FulfillOrder: throws BuyOrderNotFoundError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(999)
    const salePrice = String(10000)
    const side = String(1)

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual(
      [
        {
          line: 1,
          message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -7))])'
        },
        { line: 1, message: 'Raised from RequireValidDestination' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireNotPaused' },
        { line: 1, message: 'Raised from FulfillOrder' }
      ]
    )
  })

  test('FulfillOrder: throws ExpiredError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    await zilliqa.provider.send("IncreaseBlocknum", 1000);

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: zero_address
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    console.log("FulfillOrder: throws ExpiredError", tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -11))])'
      },
      { line: 1, message: 'Raised from RequireValidDestination' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: throws NotEqualAmountError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    console.log('buy balance')
    console.log(await getBalance(accounts.nftBuyer.address))

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)
    const txAmount = 100 // this is less than the order amount, so expected to fail

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: zero_address
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      txAmount,
      false,
      false
    )

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual(
      [
        {
          line: 1,
          message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -17))])'
        },
        { line: 1, message: 'Raised from RequireNotSelf' },
        { line: 1, message: 'Raised from RequireNotExpired' },
        { line: 1, message: 'Raised from RequireValidDestination' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireNotPaused' },
        { line: 1, message: 'Raised from FulfillOrder' }
      ]
    )
  })

  test('FulfillOrder: Buyer fullfills sell order (not collection item)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    const nftContract = await zilliqa.contracts.at(nftTokenAddress)

    const setRoyaltyFee = await callContract(
      accounts.nftSeller.privateKey,
      nftContract,
      'SetRoyaltyFeeBPS',
      [
        {
          vname: 'fee_bps',
          type: 'Uint128',
          value: "2211"
        }
      ],
      0,
      false,
      false
    )

    console.log(setRoyaltyFee.receipt)
    expect(setRoyaltyFee.receipt.success).toEqual(true)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress.toLowerCase()
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: '0x0000000000000000000000000000000000000000'
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    const event = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'FulfillOrder'
    )[0]

    console.log(event)
  })

  test('FulfillOrder: Buyer fullfills sell order (IS collection item)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const createCollectionTx = await callContract(
      accounts.address01.privateKey,
      collectionContract,
      'CreateCollection',
      [
        {
          vname: "commission_fee",
          type: "Uint128",
          value: "129"
        }
      ],
      0,
      false,
      false
    )
    expect(createCollectionTx.receipt.success).toEqual(true)




    const collectionItem = await createCollectionItemParam(
      collectionContractAddress,
      nftTokenAddress,
      "1",
      "1"
    )

    // await addTokenToCollection(
    //   collectionContract,
    //   accounts.nftSeller.privateKey,
    //   accounts.address01.privateKey,
    //   collectionItem
    // )

    const sendRequestTx = await callContract(
      accounts.address01.privateKey,
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

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress.toLowerCase()
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: '0x0000000000000000000000000000000000000000'
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    const eventFulfillOrder = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'FulfillOrder'
    )[0]

    const eventCommissionFeePaid = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'CommissionFeePaid'
    )[0]

    console.log('FulfillOrder event', eventFulfillOrder)
    console.log('CommissionFeePaid event', eventCommissionFeePaid)

    // console.log(tx.receipt)
    console.log(tx.receipt.transitions)
    expect(tx.receipt.success).toEqual(true)

  })

  test('FulfillOrder: Seller fullfills buy order', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: zero_address
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)

  })

  test('CancelOrder: throws NotAllowedToCancelOrder by stranger', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)

    const tx = await callContract(
      accounts.stranger.privateKey,
      fixedPriceContract,
      'CancelOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: zero_address
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        }
      ],
      0,
      false,
      false
    )

    //console.log(tx)
    //console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -12))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from CancelOrder' }
    ])

  })

  test('CancelOrder: Buyer cancels buy order', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const fixedPriceStartingBalance = await getBalance(fixedPriceAddress)
    const buyerStartingBalance = await getBalance(accounts.nftBuyer.address)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'CancelOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: zero_address
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        }
      ],
      0,
      false,
      false
    )

    //console.log(tx)
    //console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'CancelOrder'
    )[0]

    //let tokenAddress = txEvent.params[2].value
    //tokenAddress = tokenAddress.toLowerCase()

    console.log(txEvent)

    expect(txEvent.params[0].value).toEqual(accounts.nftBuyer.address.toLowerCase())
    expect(txEvent.params[5].value).toEqual(salePrice)

    const fixedPriceEndingBalance = await getBalance(fixedPriceAddress)
    const buyerEndingBalance = await getBalance(accounts.nftBuyer.address)

    console.log(fixedPriceStartingBalance, fixedPriceEndingBalance, salePrice);
    console.log(buyerStartingBalance, buyerEndingBalance, salePrice);

    expect(parseInt(fixedPriceEndingBalance)).toBe(parseInt(fixedPriceStartingBalance) - parseInt(salePrice))
    // expect(parseInt(buyerEndingBalance)).toBe((salePrice) + parseInt(buyerStartingBalance))

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceContract.getState()

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: { [zero_address.toLowerCase()]: {} },
        },
      })
    );

  })

  test('CancelOrder: Seller cancels sell order', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'CancelOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: zero_address
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        }
      ],
      0,
      false,
      false
    )

    //console.log(tx)
    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'CancelOrder'
    )[0]

    //let tokenAddress = txEvent.params[2].value
    //tokenAddress = tokenAddress.toLowerCase()

    console.log(txEvent)

    expect(txEvent.params[0].value).toEqual(accounts.nftSeller.address.toLowerCase())
    expect(txEvent.params[5].value).toEqual(salePrice)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceContract.getState()

    expect(JSON.stringify(contractState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: { [zero_address.toLowerCase()]: {} },
        },
      })
    );

  })

})

describe('Wrapped ZIL', () => {
  beforeEach(async () => {
    // First we succesfully create a sell order
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    const paymentTokenContract = await zilliqa.contracts.at(paymentTokenAddress)
    const notAllowedpaymentTokenContract = await zilliqa.contracts.at(notAllowedpaymentTokenAddress)

    // Transfer some wZIL to nftBuyer
    const tx = await callContract(
      accounts.contractOwner.privateKey,
      paymentTokenContract,
      'Transfer',
      [
        {
          vname: 'to',
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
        {
          vname: 'amount',
          type: "Uint128",
          value: String(1000000),
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)

    // Transfer some wYIL to nftBuyer - not allowed payment token
    const txNotAllowedPaymentToken = await callContract(
      accounts.contractOwner.privateKey,
      notAllowedpaymentTokenContract,
      'Transfer',
      [
        {
          vname: 'to',
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
        {
          vname: 'amount',
          type: "Uint128",
          value: String(1000000),
        }
      ],
      0,
      false,
      false
    )

    expect(txNotAllowedPaymentToken.receipt.success).toEqual(true)

    const sellOrderParams = {
      tokenId: String(1),
      paymentToken: paymentTokenAddress,
      price: "10000",
      side: "0",
      expiryBlock: String(globalBNum + 20)
    }

    const buyOrderParams = {
      tokenId: String(1),
      paymentToken: paymentTokenAddress,
      price: "10000",
      side: "1",
      expiryBlock: String(globalBNum + 20)
    }

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedSaleAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      sellOrderParams.tokenId,
      sellOrderParams.paymentToken,
      sellOrderParams.price,
      sellOrderParams.side,
      sellOrderParams.expiryBlock
    )

    const txSellOrder = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'SetOrder',
      [
        {
          vname: 'order',
          type: `${fixedPriceAddress}.OrderParam`,
          value: formattedSaleAdtOrder
        }
      ],
      0,
      false,
      false
    )

    const txEvent = txSellOrder.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'SetOrder'
    )[0]


    // console.log(txSellOrder.receipt)
    // expect(txSellOrder.receipt.success).toEqual(true)

    const contractState = await fixedPriceContract.getState()
    const sellOrders = contractState.sell_orders

    // expect(JSON.stringify(contractState.sell_orders)).toBe(
    //   JSON.stringify({
    //     [nftTokenAddress.toLowerCase()]: {
    //       [1]: { [zero_address.toLowerCase()]: {} },
    //     },
    //   })
    // );


    const newSellOrder = Object.keys(sellOrders).filter(
      (order) =>
        order.includes(1)
    )


    // Then a buy order for the same token_id
    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedBuyAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      buyOrderParams.tokenId,
      buyOrderParams.paymentToken,
      buyOrderParams.price,
      buyOrderParams.side,
      buyOrderParams.expiryBlock
    )

    const txBuyOrder = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'SetOrder',
      [
        {
          vname: 'order',
          type: `${fixedPriceAddress}.OrderParam`,
          value: formattedBuyAdtOrder
        }
      ],
      0,
      false,
      false
    )

    // const event = txBuyOrder.receipt.event_logs.filter(
    //   (e) =>
    //     e._eventname === 'DeleteDis'
    // )[0]

    // console.log('event', event)

    // console.dir(txBuyOrder, { depth: null })
    expect(txBuyOrder.receipt.success).toEqual(true)
  });

  test('SetOrder: throws NotAllowedPaymentToken', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      notAllowedpaymentTokenAddress,
      '20000',
      '0',
      String(globalBNum + 35)
    )

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
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

    console.log("SetOrder: throws NotAllowedPaymentToken", tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -15))])'
      },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: throws NotTokenOwnerError (stranger creates sell order for token #1)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      paymentTokenAddress,
      '20000',
      '0',
      String(globalBNum + 35)
    )

    const tx = await callContract(
      accounts.stranger.privateKey,
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
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -9))])'
      },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: throws TokenOwnerError (seller must not create a buy order for token #1)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      paymentTokenAddress,
      '20000',
      '1',
      String(globalBNum + 35)
    )

    const tx = await callContract(
      accounts.nftSeller.privateKey,
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
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -10))])'
      },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: throws NotSelfError (stranger must not update the order)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '1',
      paymentTokenAddress,
      '10000',
      '1',
      String(globalBNum + 35)
    )

    const tx = await callContract(
      accounts.stranger.privateKey,
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

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -13))])'
      },
      { line: 1, message: 'Raised from RequireSenderNotToBeTokenOwner' },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: buyer updates expiration_bnum of buy order', async () => {
    // This is not updating an order, simply setting the value on the first order. Should be Changed

    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)
    const newExpiryBlock = String(globalBNum + 99999)


    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      tokenId,
      paymentTokenAddress,
      salePrice,
      side,
      newExpiryBlock
    )

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
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

    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'SetOrder'
    )[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(newExpiryBlock)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceContract.getState()
    console.log(contractState.buy_orders)

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [paymentTokenAddress.toLowerCase()]: {
              [10000]: scillaJSONVal(
                `${fixedPriceAddress}.Order.Order.of.ByStr20.BNum`,
                [accounts.nftBuyer.address, newExpiryBlock]
              ),
            },
          },
        },
      })
    );
  })

  test('SetOrder: Seller creates sell order for token #1', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    const contractStateStart = await fixedPriceContract.getState()
    console.log("contractStateStart", JSON.stringify(contractStateStart.sell_orders));
    let oldExpiryBlock = contractStateStart.sell_orders[nftTokenAddress.toLowerCase()][1][paymentTokenAddress.toLowerCase()]["10000"].arguments[1]
    console.log("oldExpiryBlock", oldExpiryBlock)

    const tokenId = String(1)
    const salePrice = String(20000)
    const side = String(0)
    const expiryBlock = String(globalBNum + 35)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      tokenId,
      paymentTokenAddress,
      salePrice,
      side,
      expiryBlock
    )

    const tx = await callContract(
      accounts.nftSeller.privateKey,
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

    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(expiryBlock)

    // Confirming that our sell order was executed correctly by reading the contract state
    const contractState = await fixedPriceContract.getState()
    const sellOrders = contractState.sell_orders
    const newBuyOrder = Object.keys(sellOrders).filter((order) => order.includes(2))
    console.log(newBuyOrder)

    expect(JSON.stringify(contractState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [paymentTokenAddress.toLowerCase()]: {
              [String(10000)]: scillaJSONVal(
                `${fixedPriceAddress}.Order.Order.of.ByStr20.BNum`,
                [accounts.nftSeller.address, oldExpiryBlock]
              ),
              [salePrice]: scillaJSONVal(
                `${fixedPriceAddress}.Order.Order.of.ByStr20.BNum`,
                [accounts.nftSeller.address, expiryBlock]
              ),
            },
          }
        },
      })
    );
  })

  test('SetOrder: Buyer creates buy order for token #1', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const fixedPriceStartingBalance = await getZRC2State(fixedPriceAddress, paymentTokenAddress)
    console.log(fixedPriceStartingBalance, "fixedPriceStartingBalance");

    const buyerStartBalance = await getZRC2State(accounts.nftBuyer.address, paymentTokenAddress)
    console.log(buyerStartBalance, "buyerStartBalance");

    const contractStateStart = await fixedPriceContract.getState()
    console.log("contractStateStart", JSON.stringify(contractStateStart.sell_orders));

    let oldExpiryBlock = contractStateStart.buy_orders[nftTokenAddress.toLowerCase()][1][paymentTokenAddress.toLowerCase()]["10000"].arguments[1]
    console.log("oldExpiryBlock", oldExpiryBlock)

    const tokenId = String(1)
    const salePrice = String(20000)
    const side = String(1)
    const expiryBlock = String(globalBNum + 35)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      tokenId,
      paymentTokenAddress,
      salePrice,
      side,
      expiryBlock
    )

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
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

    console.log("SetOrder: Buyer creates buy order for token", tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'SetOrder'
    )[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(expiryBlock)

    const fixedPriceEndingBalance = await getZRC2State(fixedPriceAddress, paymentTokenAddress)
    console.log(fixedPriceEndingBalance, "fixedPriceEndingBalance");

    const buyerEndBalance = await getZRC2State(accounts.nftBuyer.address, paymentTokenAddress)
    console.log(buyerEndBalance, "buyerEndBalance");

    expect(parseInt(fixedPriceEndingBalance)).toBe(parseInt(fixedPriceStartingBalance) + parseInt(salePrice))
    expect(parseInt(buyerEndBalance)).toBe(parseInt(buyerStartBalance) - parseInt(salePrice))

    // Confirming that our buy order was executed correctly by reading the contract state
    const contractState = await fixedPriceContract.getState()

    let __buyerAddress = accounts.nftBuyer.address;

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [paymentTokenAddress.toLowerCase()]: {
              [10000]: scillaJSONVal(
                `${fixedPriceAddress.toLowerCase()}.Order.Order.of.ByStr20.BNum`,
                [__buyerAddress.toLowerCase(), oldExpiryBlock]
              ),
              [salePrice]: scillaJSONVal(
                `${fixedPriceAddress.toLowerCase()}.Order.Order.of.ByStr20.BNum`,
                [__buyerAddress.toLowerCase(), expiryBlock]
              ),
            },
          },
        },
      })
    );
  })

  test('SetBatchOrder: throws PausedError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const orderList = []

    const tokenId = String(1)
    const salePrice = String(20000)
    const side = String(0)
    const expiryBlock = String(globalBNum + 35)

    const pauseTx = await callContract(
      accounts.contractOwner.privateKey,
      fixedPriceContract,
      "Pause",
      [],
      0,
      false,
      false
    );

    expect(pauseTx.receipt.success).toEqual(true);

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      tokenId,
      paymentTokenAddress,
      salePrice,
      side,
      expiryBlock
    )

    for (let i = 1; i < 4; i++) {
      orderList.push(formattedAdtOrder)
    }

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'SetBatchOrder',
      [
        {
          vname: 'order_list',
          type: `List ${fixedPriceAddress}.OrderParam`,
          value: orderList
        }
      ],
      0,
      false,
      false
    )
    console.log("SetBatchOrder: throws PausedError",tx.receipt)
    expect(tx.receipt.success).toEqual(false)
  })

  test('FulfillOrder: throws NotAllowedUserError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.forbidden.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
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
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: throws SellOrderNotFoundError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(999)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual(
      [
        {
          line: 1,
          message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -6))])'
        },
        { line: 1, message: 'Raised from RequireValidDestination' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireNotPaused' },
        { line: 1, message: 'Raised from FulfillOrder' }
      ]
    )
  })

  test('FulfillOrder: throws BuyOrderNotFoundError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(999)
    const salePrice = String(10000)
    const side = String(1)

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual(
      [
        {
          line: 1,
          message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -7))])'
        },
        { line: 1, message: 'Raised from RequireValidDestination' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireAllowedUser' },
        { line: 1, message: 'Raised from RequireNotPaused' },
        { line: 1, message: 'Raised from FulfillOrder' }
      ]
    )
  })

  test('FulfillOrder: throws ExpiredError', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    await zilliqa.provider.send("IncreaseBlocknum", 1000);

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    console.log("FulfillOrder: throws ExpiredError", tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -11))])'
      },
      { line: 1, message: 'Raised from RequireValidDestination' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: Buyer fullfills sell order (not collection item)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress.toLowerCase()
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

  })

  test('FulfillOrder: Buyer fullfills sell order (IS collection item)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const createCollectionTx = await callContract(
      accounts.address01.privateKey,
      collectionContract,
      'CreateCollection',
      [
        {
          vname: "commission_fee",
          type: "Uint128",
          value: "129"
        }
      ],
      0,
      false,
      false
    )
    expect(createCollectionTx.receipt.success).toEqual(true)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress,
      nftTokenAddress,
      "1",
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.address01.privateKey,
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

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress.toLowerCase()
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    // const eventFulfillOrder = tx.receipt.event_logs.filter(
    //   (e) =>
    //     e._eventname === 'FulfillOrder'
    // )[0]

    // const eventCommissionFeePaid = tx.receipt.event_logs.filter(
    //   (e) =>
    //     e._eventname === 'CommissionFeePaid'
    // )[0]

    // console.log('FulfillOrder event', eventFulfillOrder)
    // console.log('CommissionFeePaid event', eventCommissionFeePaid)

    console.log(tx.receipt)
    console.log(tx.receipt.transitions)
    expect(tx.receipt.success).toEqual(true)

  })

  test('FulfillOrder: Seller fullfills buy order (not collection item)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)
  })

  test('FulfillOrder: Seller fullfills buy order (IS collection item)', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)

    const createCollectionTx = await callContract(
      accounts.address01.privateKey,
      collectionContract,
      'CreateCollection',
      [
        {
          vname: "commission_fee",
          type: "Uint128",
          value: "129"
        }
      ],
      0,
      false,
      false
    )
    expect(createCollectionTx.receipt.success).toEqual(true)

    const collectionItem = await createCollectionItemParam(
      collectionContractAddress,
      nftTokenAddress,
      "1",
      "1"
    )

    const sendRequestTx = await callContract(
      accounts.address01.privateKey,
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



    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)
  })

  test('CancelOrder: throws NotAllowedToCancelOrder by stranger', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)

    const tx = await callContract(
      accounts.stranger.privateKey,
      fixedPriceContract,
      'CancelOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        }
      ],
      0,
      false,
      false
    )

    //console.log(tx)
    //console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -12))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from CancelOrder' }
    ])

  })

  test('CancelOrder: Buyer cancels buy order', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const fixedPriceStartingBalance = await getZRC2State(fixedPriceAddress, paymentTokenAddress)
    console.log(fixedPriceStartingBalance, "fixedPriceStartingBalance");

    const buyerStartBalance = await getZRC2State(accounts.nftBuyer.address, paymentTokenAddress)
    console.log(buyerStartBalance, "buyerStartBalance");

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(1)

    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'CancelOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        }
      ],
      0,
      false,
      false
    )

    //console.log(tx)
    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    const fixedPriceEndingBalance = await getZRC2State(fixedPriceAddress, paymentTokenAddress)
    console.log(fixedPriceEndingBalance, "fixedPriceEndingBalance");

    const buyerEndBalance = await getZRC2State(accounts.nftBuyer.address, paymentTokenAddress)
    console.log(buyerEndBalance, "buyerEndBalance");

    expect(parseInt(fixedPriceEndingBalance)).toBe(parseInt(fixedPriceStartingBalance) - parseInt(salePrice))
    expect(parseInt(buyerEndBalance)).toBe(parseInt(buyerStartBalance) + parseInt(salePrice))

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'CancelOrder'
    )[0]

    //let tokenAddress = txEvent.params[2].value
    //tokenAddress = tokenAddress.toLowerCase()

    console.log(txEvent)

    expect(txEvent.params[0].value).toEqual(accounts.nftBuyer.address.toLowerCase())
    expect(txEvent.params[5].value).toEqual(salePrice)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceContract.getState()

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: { [paymentTokenAddress.toLowerCase()]: {} },
        },
      })
    );

  })

  test('CancelOrder: Seller cancels sell order', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = String(10000)
    const side = String(0)

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      fixedPriceContract,
      'CancelOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        }
      ],
      0,
      false,
      false
    )

    //console.log(tx)
    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'CancelOrder'
    )[0]

    //let tokenAddress = txEvent.params[2].value
    //tokenAddress = tokenAddress.toLowerCase()

    console.log(txEvent)

    expect(txEvent.params[0].value).toEqual(accounts.nftSeller.address.toLowerCase())
    expect(txEvent.params[5].value).toEqual(salePrice)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceContract.getState()

    expect(JSON.stringify(contractState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: { [paymentTokenAddress.toLowerCase()]: {} },
        },
      })
    );

  })
})

describe('Native ZIL & ZRC2', () => {
  beforeEach(async () => {
    const paymentTokenContract = await zilliqa.contracts.at(paymentTokenAddress)
    const notAllowedpaymentTokenContract = await zilliqa.contracts.at(notAllowedpaymentTokenAddress)
    const paymentTokenContract1 = await zilliqa.contracts.at(paymentTokenAddress1)
    const paymentTokenContract2 = await zilliqa.contracts.at(paymentTokenAddress2)

    // Transfer some wZIL to nftBuyer
    const tx = await callContract(
      accounts.contractOwner.privateKey,
      paymentTokenContract,
      'Transfer',
      [
        {
          vname: 'to',
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
        {
          vname: 'amount',
          type: "Uint128",
          value: String(1000000),
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)

    // Transfer some xSGD to nftBuyer
    const txTransferxSGD = await callContract(
      accounts.contractOwner.privateKey,
      paymentTokenContract1,
      'Transfer',
      [
        {
          vname: 'to',
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
        {
          vname: 'amount',
          type: "Uint128",
          value: String(1000000),
        }
      ],
      0,
      false,
      false
    )

    expect(txTransferxSGD.receipt.success).toEqual(true)

    // Transfer some xIDR to nftBuyer
    const txTransferxIDR = await callContract(
      accounts.contractOwner.privateKey,
      paymentTokenContract2,
      'Transfer',
      [
        {
          vname: 'to',
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
        {
          vname: 'amount',
          type: "Uint128",
          value: String(1000000),
        }
      ],
      0,
      false,
      false
    )

    expect(txTransferxIDR.receipt.success).toEqual(true)

    // Transfer some wYIL to nftBuyer - not allowed payment token
    const txNotAllowedPaymentToken = await callContract(
      accounts.contractOwner.privateKey,
      notAllowedpaymentTokenContract,
      'Transfer',
      [
        {
          vname: 'to',
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
        {
          vname: 'amount',
          type: "Uint128",
          value: String(1000000),
        }
      ],
      0,
      false,
      false
    )

    expect(txNotAllowedPaymentToken.receipt.success).toEqual(true)
  });

  test('SetOrder: Seller creates multiple sell order for token #1 with Native ZIL & ZRC2', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)
    const contractStateStart = await fixedPriceContract.getState()
    console.log("contractStateStart", JSON.stringify(contractStateStart.sell_orders));

    const tokenId = String(1)
    const side = String(0)
    const expiryBlock = String(globalBNum + 35)

    // create sell order with ZIL
    const txZil = await createOrder(tokenId, "10000", side, expiryBlock, zero_address);
    console.log(txZil.receipt);

    const txZilEvent = txZil.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txZilEvent);

    let _zero_address = txZilEvent.params[4].value;
    _zero_address = _zero_address.toLowerCase()

    expect(txZilEvent.params[1].value).toEqual(side)
    expect(txZilEvent.params[3].value).toEqual(tokenId)
    expect(_zero_address).toEqual(zero_address.toLowerCase())
    expect(txZilEvent.params[5].value).toEqual("10000")
    expect(txZilEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with wZIL
    const txwZil = await createOrder(tokenId, "20000", side, expiryBlock, paymentTokenAddress);
    console.log(txwZil.receipt);

    const txwZilEvent = txwZil.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txwZilEvent);

    let _paymentToken = txwZilEvent.params[4].value;
    _paymentToken = _paymentToken.toLowerCase()

    expect(txwZilEvent.params[1].value).toEqual(side)
    expect(txwZilEvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken).toEqual(paymentTokenAddress.toLowerCase())
    expect(txwZilEvent.params[5].value).toEqual("20000")
    expect(txwZilEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with xSGD
    const txSGD = await createOrder(tokenId, "30000", side, expiryBlock, paymentTokenAddress1);
    console.log(txSGD.receipt);

    const txSGDEvent = txSGD.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txSGDEvent);

    let _paymentToken1 = txSGDEvent.params[4].value;
    _paymentToken1 = _paymentToken1.toLowerCase()

    expect(txSGDEvent.params[1].value).toEqual(side)
    expect(txSGDEvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken1).toEqual(paymentTokenAddress1.toLowerCase())
    expect(txSGDEvent.params[5].value).toEqual("30000")
    expect(txSGDEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with xIDR
    const txIDR = await createOrder(tokenId, "40000", side, expiryBlock, paymentTokenAddress2);
    console.log(txIDR.receipt);

    const txIDREvent = txIDR.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txIDREvent);

    let _paymentToken2 = txIDREvent.params[4].value;
    _paymentToken2 = _paymentToken2.toLowerCase()

    expect(txIDREvent.params[1].value).toEqual(side)
    expect(txIDREvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken2).toEqual(paymentTokenAddress2.toLowerCase())
    expect(txIDREvent.params[5].value).toEqual("40000")
    expect(txIDREvent.params[6].value).toEqual(expiryBlock)
  })

  test('SetOrder: Buyer buys token #1 with Native ZIL and rest of sell orders should be deleted', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = "10000";
    const side = String(0)
    const expiryBlock = String(globalBNum + 35)

    // create sell order with ZIL
    const txZil = await createOrder(tokenId, salePrice, side, expiryBlock, zero_address);
    console.log(txZil.receipt);

    const txZilEvent = txZil.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txZilEvent);

    let _zero_address = txZilEvent.params[4].value;
    _zero_address = _zero_address.toLowerCase()

    expect(txZilEvent.params[1].value).toEqual(side)
    expect(txZilEvent.params[3].value).toEqual(tokenId)
    expect(_zero_address).toEqual(zero_address.toLowerCase())
    expect(txZilEvent.params[5].value).toEqual(salePrice)
    expect(txZilEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with wZIL
    const txwZil = await createOrder(tokenId, "20000", side, expiryBlock, paymentTokenAddress);
    console.log(txwZil.receipt);

    const txwZilEvent = txwZil.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txwZilEvent);

    let _paymentToken = txwZilEvent.params[4].value;
    _paymentToken = _paymentToken.toLowerCase()

    expect(txwZilEvent.params[1].value).toEqual(side)
    expect(txwZilEvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken).toEqual(paymentTokenAddress.toLowerCase())
    expect(txwZilEvent.params[5].value).toEqual("20000")
    expect(txwZilEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with xSGD
    const txSGD = await createOrder(tokenId, "30000", side, expiryBlock, paymentTokenAddress1);
    console.log(txSGD.receipt);

    const txSGDEvent = txSGD.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txSGDEvent);

    let _paymentToken1 = txSGDEvent.params[4].value;
    _paymentToken1 = _paymentToken1.toLowerCase()

    expect(txSGDEvent.params[1].value).toEqual(side)
    expect(txSGDEvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken1).toEqual(paymentTokenAddress1.toLowerCase())
    expect(txSGDEvent.params[5].value).toEqual("30000")
    expect(txSGDEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with xIDR
    const txIDR = await createOrder(tokenId, "40000", side, expiryBlock, paymentTokenAddress2);
    console.log(txIDR.receipt);

    const txIDREvent = txIDR.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txIDREvent);

    let _paymentToken2 = txIDREvent.params[4].value;
    _paymentToken2 = _paymentToken2.toLowerCase()

    expect(txIDREvent.params[1].value).toEqual(side)
    expect(txIDREvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken2).toEqual(paymentTokenAddress2.toLowerCase())
    expect(txIDREvent.params[5].value).toEqual("40000")
    expect(txIDREvent.params[6].value).toEqual(expiryBlock)

    // buyer fullfil buy order
    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress.toLowerCase()
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: zero_address
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: salePrice
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    const contractStart = await fixedPriceContract.getState()
    console.log("contractStart", JSON.stringify(contractStart.sell_orders));

    expect(JSON.stringify(contractStart.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {}
      })
    );

  })

  test('SetOrder: Buyer buys token #1 with ZRC2 and rest of sell orders should be deleted', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const tokenId = String(1)
    const salePrice = "10000";
    const side = String(0)
    const expiryBlock = String(globalBNum + 35)

    // create sell order with ZIL
    const txZil = await createOrder(tokenId, salePrice, side, expiryBlock, zero_address);
    console.log(txZil.receipt);

    const txZilEvent = txZil.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txZilEvent);

    let _zero_address = txZilEvent.params[4].value;
    _zero_address = _zero_address.toLowerCase()

    expect(txZilEvent.params[1].value).toEqual(side)
    expect(txZilEvent.params[3].value).toEqual(tokenId)
    expect(_zero_address).toEqual(zero_address.toLowerCase())
    expect(txZilEvent.params[5].value).toEqual(salePrice)
    expect(txZilEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with wZIL
    const txwZil = await createOrder(tokenId, "20000", side, expiryBlock, paymentTokenAddress);
    console.log(txwZil.receipt);

    const txwZilEvent = txwZil.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txwZilEvent);

    let _paymentToken = txwZilEvent.params[4].value;
    _paymentToken = _paymentToken.toLowerCase()

    expect(txwZilEvent.params[1].value).toEqual(side)
    expect(txwZilEvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken).toEqual(paymentTokenAddress.toLowerCase())
    expect(txwZilEvent.params[5].value).toEqual("20000")
    expect(txwZilEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with xSGD
    const txSGD = await createOrder(tokenId, "30000", side, expiryBlock, paymentTokenAddress1);
    console.log(txSGD.receipt);

    const txSGDEvent = txSGD.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txSGDEvent);

    let _paymentToken1 = txSGDEvent.params[4].value;
    _paymentToken1 = _paymentToken1.toLowerCase()

    expect(txSGDEvent.params[1].value).toEqual(side)
    expect(txSGDEvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken1).toEqual(paymentTokenAddress1.toLowerCase())
    expect(txSGDEvent.params[5].value).toEqual("30000")
    expect(txSGDEvent.params[6].value).toEqual(expiryBlock)

    // create sell order with xIDR
    const txIDR = await createOrder(tokenId, "40000", side, expiryBlock, paymentTokenAddress2);
    console.log(txIDR.receipt);

    const txIDREvent = txIDR.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txIDREvent);

    let _paymentToken2 = txIDREvent.params[4].value;
    _paymentToken2 = _paymentToken2.toLowerCase()

    expect(txIDREvent.params[1].value).toEqual(side)
    expect(txIDREvent.params[3].value).toEqual(tokenId)
    expect(_paymentToken2).toEqual(paymentTokenAddress2.toLowerCase())
    expect(txIDREvent.params[5].value).toEqual("40000")
    expect(txIDREvent.params[6].value).toEqual(expiryBlock)

    // buyer fullfil buy order
    const tx = await callContract(
      accounts.nftBuyer.privateKey,
      fixedPriceContract,
      'FulfillOrder',
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress.toLowerCase()
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentTokenAddress1
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: '30000'
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'dest',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    const contractStart = await fixedPriceContract.getState()
    console.log("contractStart", JSON.stringify(contractStart.sell_orders));

    expect(JSON.stringify(contractStart.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {}
      })
    );

  })
})