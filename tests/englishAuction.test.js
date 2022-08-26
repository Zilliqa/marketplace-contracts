/* eslint-disable no-undef */
require('dotenv').config({ path: './.env' })
const { BN } = require('@zilliqa-js/util')
const { scillaJSONVal } = require("@zilliqa-js/scilla-json-utils");
const { getAddressFromPrivateKey, schnorr } = require('@zilliqa-js/crypto')
const { deployAllowlistContract } = require('../scripts/marketplace/deployAllowlistContract.js')
const { deployEnglishAuctionContract } = require('../scripts/marketplace/deployEnglishAuctionContract.js')
const { deployFungibleToken } = require('../scripts/deployFungibleToken.js')
const { deployCollectionContract } = require('../scripts/marketplace/deployCollectionContract.js')
const { addTokenToCollection } = require('../scripts/marketplace/addTokenToCollection')

const { deployNonFungibleToken } = require('../scripts/deployNonFungibleToken.js')
 const {
   setupBalancesOnAccounts,
   clearBalancesOnAccounts,
} = require('../scripts/utils/call.js')

// const { getContractState } = require('../scripts/utils/deploy.js')
const { callContract, getBalance } = require('../scripts/utils/call.js')
const { getBlockNumber } = require('../scripts/utils/helper')
const { zilliqa } = require('../scripts/utils/zilliqa.js')

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

async function createOrderParam(
  englishAuctionAddress,
  tokenAddress, 
  tokenId, 
  payment_token_address, 
  start_amount, 
  expiration_block_number, 
) {
return {
  constructor: `${englishAuctionAddress.toLowerCase()}.OrderParam`,
  argtypes: [],
  arguments: [
    tokenAddress.toLowerCase(), 
    tokenId, 
    payment_token_address, 
    start_amount, 
    expiration_block_number
  ]
}
}

beforeAll(async () => {
  await clearBalancesOnAccounts(accounts)
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
  // const [paymentToken] = await deployFungibleToken(
  //   accounts.contractOwner.privateKey,
  //   fungibleTokenDeployParams,
  //   accounts.contractOwner.address
  // )
  // paymentTokenAddress = paymentToken.address
  // if (paymentTokenAddress === undefined) {
  //   throw new Error();
  // }

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


  const [englishAuctionContract] = await deployEnglishAuctionContract(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address,
      collectionContract: collectionContract.address.toLowerCase()
    }
  ) 
  englishAuctionAddress = englishAuctionContract.address
  console.log('englishAuctionContract =', englishAuctionContract.address)
  if (englishAuctionAddress === undefined) {
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
    englishAuctionContract,
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
  // await callContract(
  //   accounts.contractOwner.privateKey,
  //   englishAuctionContract,
  //   'AllowPaymentTokenAddress',
  //   [
  //     {
  //       vname: 'address',
  //       type: "ByStr20",
  //       value: paymentTokenAddress,
  //     }
  //   ],
  //   0,
  //   false,
  //   false
  // )
/* 
  await callContract(
    accounts.contractOwner.privateKey,
    fixedPriceContract,
    'AllowPaymentTokenAddress',
    [
      {
        vname: 'address',
        type: "ByStr20",
        value: zero_address,
      }
    ],
    0,
    false,
    false
  ) */

  // Increasing the amount of wZIL the fixedPriceContract can spend
  // await callContract(
  //   accounts.nftBuyer.privateKey,
  //   paymentToken,
  //   'IncreaseAllowance',
  //   [
  //     {
  //       vname: 'spender',
  //       type: "ByStr20",
  //       value: englishAuctionAddress,
  //     },
  //     {
  //       vname: 'amount',
  //       type: "Uint128",
  //       value: String(100 * 1000),
  //     }
  //   ],
  //   0,
  //   false,
  //   false
  // )

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
        value: englishAuctionAddress,
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
  


  // const tx = await callContract(
  //   accounts.contractOwner.privateKey,
  //   collectionContract,
  //   'RegisterMarketplaceAddress',
  //   [
  //     {
  //       vname: 'address',
  //       type: "ByStr20",
  //       value: englishAuctionAddress.toLowerCase(),
  //     }
  //   ],
  //   0,
  //   false,
  //   false
  // )
  // expect(tx.receipt.success).toEqual(true)
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
    const englishAuctionContract = await zilliqa.contracts.at(englishAuctionAddress)
    let globalBNum = await getBlockNumber(zilliqa);

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      String(1),
      zero_address,
      String(1000),
      String(globalBNum + 2)
    )

    const startTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      'Start',
      [
        {
          vname: 'order',
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam
        }
      ],
      0,
      false,
      false
    )
    console.log(startTx.receipt)
    expect(startTx.receipt.success).toEqual(true)

    const bidAmount = String(10000)

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      'Bid',
      [
        {
          vname: 'token_address',
          type: "ByStr20",
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: "Uint256",
          value: String(1)
        },
        {
          vname: 'amount',
          type: "Uint128",
          value: bidAmount
        },
        {
          vname: 'dest',
          type: "ByStr20",
          value: accounts.nftBuyer.address
        }
      ],
      bidAmount,
      false,
      false
    )
    console.log(bidTx.receipt)
    const v = await zilliqa.provider.send("IncreaseBlocknum", 1000);
    const xcwe = await zilliqa.provider.send("GetBlocknum", "");
    console.log(v)
    expect(bidTx.receipt.success).toEqual(true)

    

  })

  test('FulfillOrder: Seller fullfills buy order (is not collection item)', async () => {
    const englishAuctionContract = await zilliqa.contracts.at(englishAuctionAddress)
    const nftContract = await zilliqa.contracts.at(nftTokenAddress)
    const bnum = await zilliqa.provider.send("GetBlocknum", "");
    console.log(bnum)
    const v = await zilliqa.provider.send("IncreaseBlocknum", 30);
    const xcwe = await zilliqa.provider.send("GetBlocknum", "");
    console.log(v)

    const pair = await createPairADT(accounts.nftSeller.address, "")

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      'End',
      [
        {
          vname: 'token_address',
          type: "ByStr20",
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: "Uint256",
          value: String(1)
        }
      ],
      0,
      false,
      false
    )
    console.log(tx.receipt)
    console.log(tx.transitions)

    const event = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'End'
    )[0]

    console.log(event)

    expect(tx.receipt.success).toEqual(true)
  })

  test.only('FulfillOrder: Seller fullfills buy order (is a collection item)', async () => {
    const englishAuctionContract = await zilliqa.contracts.at(englishAuctionAddress)
    const collectionContract = await zilliqa.contracts.at(collectionContractAddress)
    const nftContract = await zilliqa.contracts.at(nftTokenAddress)

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
      "2", 
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

    

    await callContract(
      accounts.nftSeller.privateKey,
      nftContract,
      'SetSpender',
      [
        {
          vname: 'spender',
          type: "ByStr20",
          value: englishAuctionAddress,
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

    let globalBNum = await getBlockNumber(zilliqa);

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      String(2),
      zero_address,
      String(1000),
      String(globalBNum + 1)
    )

    const startTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      'Start',
      [
        {
          vname: 'order',
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam
        }
      ],
      0,
      false,
      false
    )

    console.log(startTx.receipt)
    expect(startTx.receipt.success).toEqual(true)

    const bidAmount = String(10000)

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      'Bid',
      [
        {
          vname: 'token_address',
          type: "ByStr20",
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: "Uint256",
          value: String(2)
        },
        {
          vname: 'amount',
          type: "Uint128",
          value: bidAmount
        },
        {
          vname: 'dest',
          type: "ByStr20",
          value: accounts.nftBuyer.address
        }
      ],
      bidAmount,
      false,
      false
    )
    console.log('bid', bidTx.receipt)
    expect(bidTx.receipt.success).toEqual(true)

    const registerMarketplaceContracttx = await callContract(
      accounts.contractOwner.privateKey,
      collectionContract,
      'RegisterMarketplaceAddress',
      [
        {
          vname: 'address',
          type: "ByStr20",
          value: englishAuctionAddress.toLowerCase(),
        }
      ],
      0,
      false,
      false
    )

    expect(registerMarketplaceContracttx.receipt.success).toEqual(true)

    const tx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      'End',
      [
        {
          vname: 'token_address',
          type: "ByStr20",
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: "Uint256",
          value: String(2)
        }
      ],
      0,
      false,
      false
    )
    console.log(tx.receipt)
    console.log(tx.transitions)

    const event = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'End'
    )[0]

    const event02 = tx.receipt.event_logs.filter(
      (e) =>
        e._eventname === 'CommissionFeePaid'
    )[0]

    console.log(event02)
    const contractState = await collectionContract.getState()
    console.log('collection', contractState)
    const contractState02 = await englishAuctionContract.getState()
    console.log('auction', contractState02)

    console.log(tx.receipt)
    console.log(tx.receipt.transitions)
    expect(tx.receipt.success).toEqual(true)
    
  })
})