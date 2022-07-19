/* eslint-disable no-undef */
require('dotenv').config({ path: './.env' })
const { BN, bytes, units } = require('@zilliqa-js/util')
const { scillaJSONParams, scillaJSONVal } = require("@zilliqa-js/scilla-json-utils");
const { default: BigNumber } = require('bignumber.js')
const { getAddressFromPrivateKey, schnorr } = require('@zilliqa-js/crypto')
const { deployAllowlistContract } = require('../scripts/marketplace/deployAllowlistContract.js')
const { deployFixedPriceContract } = require('../scripts/marketplace/deployFixedPriceContract.js')
const { deployFungibleToken } = require('../scripts/deployFungibleToken.js')

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

/* beforeAll(async () => {
  console.log(await getBalance(accounts.nftBuyer.address))
  const address01Balance = await getBalance(accounts.address01.address)
  const address02Balance = await getBalance(accounts.address02.address)
  const address03Balance = await getBalance(accounts.address03.address)
  const address04Balance = await getBalance(accounts.address04.address)

  await transfer(
    accounts.address01.privateKey, 
    accounts.contractOwner.address,
    address01Balance
  )
  
  await transfer(
    accounts.address02.privateKey, 
    accounts.contractOwner.address,
    address02Balance
  )

  await transfer(
    accounts.address03.privateKey, 
    accounts.nftBuyer.address,
    address03Balance
  )

  await transfer(
    accounts.address04.privateKey, 
    accounts.nftBuyer.address,
    address04Balance
  )
}) */

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
  // for (let i = 1; i < 4; i++) {
  //   await callContract(
  //     accounts.nftSeller.privateKey,
  //     nftContract,
  //     'SetSpender',
  //     [
  //       {
  //         vname: 'spender',
  //         type: "ByStr20",
  //         value: fixedPriceAddress,
  //       },
  //       {
  //         vname: 'token_id',
  //         type: "Uint256",
  //         value: String(i),
  //       }
  //     ],
  //     0,
  //     false,
  //     false
  // )}
  
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
  beforeEach(async () => {
    // First we succesfully create a sell order
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const sellOrderParams = {
      tokenId: String(1),
      salePrice: new BN("10000"),
      side: String(0),
      expiryBlock: String(globalBNum + 20)
    }

    const buyOrderParams = {
      tokenId: String(1),
      salePrice: new BN("10000"),
      side: String(1),
      expiryBlock: String(globalBNum + 20)
    }
    

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedSaleAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      sellOrderParams.tokenId,
      '0x0000000000000000000000000000000000000000',
      sellOrderParams.salePrice,
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

    console.log(txSellOrder.receipt)
    expect(txSellOrder.receipt.success).toEqual(true)

    // Then a buy order for the same token_id
    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedBuyAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      buyOrderParams.tokenId,
      '0x0000000000000000000000000000000000000000',
      buyOrderParams.salePrice,
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
      new BN(buyOrderParams.salePrice),
      false,
      false
    )

    console.log(txBuyOrder)
    console.log(txBuyOrder.receipt)
    expect(txBuyOrder.receipt.success).toEqual(true)
  })

  test.only('SetOrder: throws NotAllowedUserError', async () => {
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
      ZERO_ADDRESS,
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
      ZERO_ADDRESS,
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

    // Confirming that our sell order was executed correctly by reading the contract state
    /* 
    const contractState = await fixedPriceContract.getState()


    const sellOrders = contractState.sell_orders

    const newBuyOrder = Object.keys(sellOrders).filter(
      (order) => 
      order.includes(2)
    )
    console.log(newBuyOrder)
    
    expect(JSON.stringify(contractState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [ZERO_ADDRESS]: {
              [String(10000)]: scillaJSONVal(
                `${fixedPriceAddress}.Order.Order.of.ByStr20.BNum`,
                [accounts.nftSeller.address, expiryBlock]
              ),
            },
          },
          [2]: 
          {
            [ZERO_ADDRESS]: {
              [salePrice]: scillaJSONVal(
                `${fixedPriceAddress}.Order.Order.of.ByStr20.BNum`,
                [accounts.nftSeller.address, expiryBlock]
              ),
            },
          },
        },
      })
    );*/
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
    console.log('ending balance:',buyerEndingBalance)
    console.log('gas total cost:', txFee)
    console.log('buy offer + gas total cost:', parseInt(salePrice) + txFee)

    //expect(parseInt(fixedPriceEndingBalance)).toBe(parseInt(fixedPriceStartingBalance) + parseInt(salePrice))
    expect(parseInt(buyerEndingBalance)).toBe((totalExpense) - parseInt(buyerStartingBalance))

    // Confirming that our buy order was executed correctly by reading the contract state
    const contractState = await fixedPriceContract.getState()

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [paymentTokenAddress]: {
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

    await zilliqa.provider.send("IncreaseBlocknum", 100);

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
      0,
      false,
      false
    )

    console.log(tx.receipt.exceptions)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual(
      [
        {
          line: 1,
          message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -2))])'
        },
        { line: 1, message: 'Raised from TransferFrom' }
    ]
    )
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
      txAmount,
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
  
  test('FulfillOrder: Buyer fullfills sell order', async () => {
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

    console.log(tx)
    console.log(tx.receipt)
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

    console.log(tx)
    console.log(tx.receipt)
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
describe('Wrapped ZIL', () => {
  beforeEach(async () => {
    // First we succesfully create a sell order
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

    const sellOrderParams = {
      tokenId: String(1),
      salePrice: String(10000),
      side: String(0),
      expiryBlock: String(globalBNum + 20)
    }

    const buyOrderParams = {
      tokenId: String(1),
      salePrice: String(10000),
      side: String(1),
      expiryBlock: String(globalBNum + 20)
    }
    

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedSaleAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      sellOrderParams.tokenId,
      paymentTokenAddress,
      sellOrderParams.salePrice,
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

    expect(txSellOrder.receipt.success).toEqual(true)

    // Then a buy order for the same token_id
    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedBuyAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      buyOrderParams.tokenId,
      paymentTokenAddress,
      buyOrderParams.salePrice,
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

    expect(txSellOrder.receipt.success).toEqual(true)
    expect(txBuyOrder.receipt.success).toEqual(true)
  })
  // test('SetOrder: throws NotAllowedPaymentToken', async () => {})
  // test('SetOrder: throws NotTokenOwnerError (stranger creates sell order for token #1)', async () => {})
  // test('SetOrder: throws TokenOwnerError (seller must not create a buy order for token #1)', async () => {})
  // test('SetOrder: throws NotSelfError (stranger must not update the order)', async () => {})
  // test('SetOrder: buyer updates expiration_bnum of buy order', async () => {})
  // test('SetOrder: Seller creates sell order for token #1', async () => {})
  // test('SetOrder: Buyer creates buy order for token #1', async () => {})
  // test('FulfillOrder: throws SellOrderNotFoundError', async () => {})
  // test('FulfillOrder: throws BuyOrderNotFoundError', async () => {})
  // test('FulfillOrder: throws ExpiredError', async () => {})
  // test('FulfillOrder: Buyer fullfills sell order', async () => {})
  // test('FulfillOrder: Seller fullfills buy order', async () => {})
  // test('CancelOrder: throws NotAllowedToCancelOrder by stranger', async () => {})
  test('CancelOrder: Buyer cancels buy order', async () => {
    const fixedPriceContract = await zilliqa.contracts.at(fixedPriceAddress)

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
  // test('CancelOrder: Seller cancels sell order', async () => {})
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