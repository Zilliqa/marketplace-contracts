/* eslint-disable no-undef */
require('dotenv').config({ path: './.env' })
const { BN } = require('@zilliqa-js/util')
const BigNumber = require('bignumber.js')
const { scillaJSONVal } = require("@zilliqa-js/scilla-json-utils");
const { getAddressFromPrivateKey, schnorr } = require('@zilliqa-js/crypto')
const { deployAllowlistContract } = require('../scripts/marketplace/deployAllowlistContract.js')
// const { deployFixedPriceContract } = require('../scripts/marketplace/deployFixedPriceContract.js')
const { deployFungibleToken } = require('../scripts/deployFungibleToken.js')
const { deployCollectionContract } = require('../scripts/marketplace/deployCollectionContract.js')
const { addTokenToCollection } = require('../scripts/marketplace/addTokenToCollection')

const { deployNonFungibleToken } = require('../scripts/deployNonFungibleToken.js')
const { setupBalancesOnAccounts, clearBalancesOnAccounts } = require('../scripts/utils/call.js')

// support upgradable contracts
const { deployTransferProxyContract } = require("../scripts/marketplace/deployTransferProxyContract.js");
const { deployFixedPriceContractProxy } = require("../scripts/marketplace/deployFixedPriceContractProxy.js");
const { deployFixedPriceContractState } = require("../scripts/marketplace/deployFixedPriceContractState.js");
const { deployFixedPriceContractLogic } = require("../scripts/marketplace/deployFixedPriceContractLogic.js");
const { updateLogicContractInTransferProxy } = require("../scripts/marketplace/updateLogicContractInTransferProxy.js");
const { updateLogicContractInStateProxy } = require("../scripts/marketplace/updateLogicContractInStateProxy.js");
const { setOrder } = require("../scripts/marketplace/setOrder");

// const { getContractState } = require('../scripts/utils/deploy.js')
const { callContract, getBalance, getZRC2State } = require('../scripts/utils/call.js')
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
let notAcceptedPaymentTokenAddress;
let fixedPriceAddress;
let nftTokenAddress;
let allowlistAddress;
let collectionContractAddress;
let _transferProxyContract;
let _fixedPriceProxy;
let _fixedPriceState;
let _fixedPriceLogic;

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

beforeAll(async () => {
  await setupBalancesOnAccounts(accounts)
})

afterAll(async () => {
  await clearBalancesOnAccounts(accounts)
})

beforeEach(async () => {
  globalBNum = await getBlockNumber(zilliqa);

  // Contract Deployments
  // accepted payment token
  const fungibleTokenDeployParams = {
    name: "wZIL",
    symbol: null,
    decimals: 12,
    supply: new BN("10000000000000000"),
    dexCheck: "True",
  };
  const [paymentToken] = await deployFungibleToken(
    accounts.contractOwner.privateKey,
    fungibleTokenDeployParams,
    accounts.contractOwner.address
  );
  paymentTokenAddress = paymentToken.address;
  if (paymentTokenAddress === undefined) {
    throw new Error();
  }

  // not accepted payment token
  const nonAcceptedfungibleTokenDeployParams = {
    name: "zUSD",
    symbol: null,
    decimals: 12,
    supply: new BN("10000000000000000"),
    dexCheck: "True",
  };
  const [paymentToken2] = await deployFungibleToken(
    accounts.contractOwner.privateKey,
    nonAcceptedfungibleTokenDeployParams,
    accounts.contractOwner.address
  );
  notAcceptedPaymentTokenAddress = paymentToken2.address;
  if (notAcceptedPaymentTokenAddress === undefined) {
    throw new Error();
  }

  // deploy collection contract
  const [collectionContract] = await deployCollectionContract(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address,
    }
  );
  collectionContractAddress = collectionContract.address;
  if (collectionContractAddress === undefined) {
    throw new Error();
  }

  // deploy transfer proxy
  const [transferProxyContract] = await deployTransferProxyContract(
    accounts.contractOwner.privateKey,
    { initialOwnerAddress: accounts.contractOwner.address }
  );
  _transferProxyContract = transferProxyContract.address;
  console.log("transferProxyContract =", _transferProxyContract);
  if (_transferProxyContract === undefined) {
    throw new Error();
  }

  // deploy fixed price proxy
  const [fixedPriceContract] = await deployFixedPriceContractProxy(
    accounts.contractOwner.privateKey,
    { initialOwnerAddress: accounts.contractOwner.address }
  );
  _fixedPriceProxy = fixedPriceContract.address;
  fixedPriceAddress = fixedPriceContract.address
  console.log("fixedPriceProxy =", _fixedPriceProxy);
  if (_fixedPriceProxy === undefined) {
    throw new Error();
  }

  // deploy fixed price state
  const [fixedPriceState] = await deployFixedPriceContractState(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address,
      collectionContract: collectionContractAddress,
    }
  );
  _fixedPriceState = fixedPriceState.address;
  console.log("fixedPriceState =", _fixedPriceState);
  if (_fixedPriceState === undefined) {
    throw new Error();
  }

  // deploy fixed price logic
  const [fixedPriceLogic] = await deployFixedPriceContractLogic(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address,
      state: _fixedPriceState,
      proxy: _fixedPriceProxy,
      transfer_proxy: _transferProxyContract,
    }
  );
  _fixedPriceLogic = fixedPriceLogic.address;
  console.log("fixedPriceLogic =", _fixedPriceLogic);
  if (_fixedPriceLogic === undefined) {
    throw new Error();
  }

  const _updateLogicContractInTransferProxy = await updateLogicContractInTransferProxy(accounts.contractOwner.privateKey, _transferProxyContract, _fixedPriceLogic, "updateOperator", "to", "status", "True");
  console.log("Update Logic Contract In TransferProxy", _updateLogicContractInTransferProxy.success);
  if (_updateLogicContractInTransferProxy.success === false) {
    throw new Error();
  }
  
  const _updateLogicContractInState = await updateLogicContractInStateProxy(accounts.contractOwner.privateKey, _fixedPriceState, _fixedPriceLogic, "UpdateLogic", "new_logic_contract");
  console.log("Update Logic Contract In State", _updateLogicContractInState.success);
  if (_updateLogicContractInState.success === false) {
    throw new Error();
  }

  const _updateLogicContractInProxy = await updateLogicContractInStateProxy(accounts.contractOwner.privateKey, _fixedPriceProxy, _fixedPriceLogic, "UpdateLogic", "to");
  console.log("Update LogicContract In Proxy", _updateLogicContractInProxy.success);
  if (_updateLogicContractInProxy.success === false) {
    throw new Error();
  }

  const _updateStateContractInProxy = await updateLogicContractInStateProxy(accounts.contractOwner.privateKey, _fixedPriceProxy, _fixedPriceState, "UpdateState", "to");
  console.log("Update State Contract In Proxy", _updateStateContractInProxy.success);
  if (_updateStateContractInProxy.success === false) {
    throw new Error();
  }

  const [allowlistContract] = await deployAllowlistContract(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address,
    }
  );
  allowlistAddress = allowlistContract.address;
  if (allowlistAddress === undefined) {
    throw new Error();
  }

  const nonFungibleTokenDeployParams = {
    name: "TestNFTToken1",
    symbol: null,
    baseURI: "https://ipfs.io/ipfs/",
  };

  const [nftContract] = await deployNonFungibleToken(
    accounts.nftSeller.privateKey,
    nonFungibleTokenDeployParams,
    accounts.nftSeller.address
  );
  nftTokenAddress = nftContract.address;
  if (nftTokenAddress === undefined) {
    throw new Error();
  }

  // ACCOUNT PREP

  // Whitelist addresses
  await callContract(
    accounts.contractOwner.privateKey,
    allowlistContract,
    "Allow",
    [
      {
        vname: "address_list",
        type: "List (ByStr20)",
        value: [
          accounts.contractOwner.address,
          accounts.nftSeller.address,
          accounts.nftBuyer.address,
          accounts.stranger.address,
        ],
      },
    ],
    0,
    false,
    false
  );

  // Set the allowlist Contract - in fixed price state
  await callContract(
    accounts.contractOwner.privateKey,
    fixedPriceState,
    "SetAllowlist",
    [
      {
        vname: "allowed_addresses",
        type: "ByStr20",
        value: allowlistAddress,
      },
    ],
    0,
    false,
    false
  );

  // Batch-mint some NFTs
  const pair = await createPairADT(accounts.nftSeller.address, "");

  await callContract(
    accounts.nftSeller.privateKey,
    nftContract,
    "BatchMint",
    [
      {
        vname: "to_token_uri_pair_list",
        type: "List (Pair (ByStr20) (String))",
        value: [pair, pair, pair],
      },
    ],
    0,
    false,
    false
  );

  // Set wZil as an allowed payment token - in Fixed Price State
  await callContract(
    accounts.contractOwner.privateKey,
    fixedPriceState,
    "AllowPaymentTokenAddress",
    [
      {
        vname: "address",
        type: "ByStr20",
        value: paymentTokenAddress,
      },
    ],
    0,
    false,
    false
  );

  // Increasing the amount of wZIL the fixedPriceContract can spend
  await callContract(
    accounts.nftBuyer.privateKey,
    paymentToken,
    "IncreaseAllowance",
    [
      {
        vname: "spender",
        type: "ByStr20",
        value: _transferProxyContract,
      },
      {
        vname: "amount",
        type: "Uint128",
        value: String(100 * 1000),
      },
    ],
    0,
    false,
    false
  );

  // only token_id 1 to make tests run faster
  await callContract(
    accounts.nftSeller.privateKey,
    nftContract,
    "SetSpender",
    [
      {
        vname: "spender",
        type: "ByStr20",
        value: _transferProxyContract,
      },
      {
        vname: "token_id",
        type: "Uint256",
        value: String(1),
      },
    ],
    0,
    false,
    false
  );

  // this is for not accepted payment token
  await callContract(
    accounts.nftSeller.privateKey,
    nftContract,
    "SetSpender",
    [
      {
        vname: "spender",
        type: "ByStr20",
        value: _transferProxyContract,
      },
      {
        vname: "token_id",
        type: "Uint256",
        value: String(2),
      },
    ],
    0,
    false,
    false
  );
  
  // add proxy contract as RegisterMarketplaceAddress in collection - not actually needed
  const txRegisterMarketplaceAddressProxy = await callContract(
    accounts.contractOwner.privateKey,
    collectionContract,
    "RegisterMarketplaceAddress",
    [
      {
        vname: "address",
        type: "ByStr20",
        value: fixedPriceAddress.toLowerCase(),
      },
    ],
    0,
    false,
    false
  );

  expect(txRegisterMarketplaceAddressProxy.receipt.success).toEqual(true);

  // add logic contract as RegisterMarketplaceAddress in collection
  const txRegisterMarketplaceAddressLogic = await callContract(
    accounts.contractOwner.privateKey,
    collectionContract,
    "RegisterMarketplaceAddress",
    [
      {
        vname: "address",
        type: "ByStr20",
        value: _fixedPriceLogic.toLowerCase(),
      },
    ],
    0,
    false,
    false
  );

  expect(txRegisterMarketplaceAddressLogic.receipt.success).toEqual(true);
})

describe('Native ZIL', () => {
  beforeEach(async () => {
    // First we succesfully create a sell order

    const sellOrderParams = {
      tokenId: String(1),
      paymentToken: '0x0000000000000000000000000000000000000000',
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

    const txSellOrder = await setOrder(
      accounts.nftSeller.privateKey,
      _fixedPriceProxy,
      nftTokenAddress,
      sellOrderParams.tokenId,
      sellOrderParams.paymentToken,
      sellOrderParams.price,
      sellOrderParams.side,
      sellOrderParams.expiryBlock
    );

    expect(txSellOrder.success).toEqual(true)
    console.log("Seller: Set Order", txSellOrder.success);

    const txBuyOrder = await setOrder(
      accounts.nftBuyer.privateKey,
      _fixedPriceProxy,
      nftTokenAddress,
      buyOrderParams.tokenId,
      buyOrderParams.paymentToken,
      buyOrderParams.price,
      buyOrderParams.side,
      buyOrderParams.expiryBlock
    );

    expect(txBuyOrder.success).toEqual(true)
    console.log("Buyer: Set Order", txBuyOrder.success);
  })

  test('SetOrder: throws NotAllowedUserError', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
    );
    console.log("SetOrder: throws NotAllowedUserError", tx.receipt)
    expect(tx.receipt.success).toEqual(false);
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -19))])'
      },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: throws NotTokenOwnerError (stranger creates sell order for token #1)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -9))])'
      },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: throws TokenOwnerError (seller creates buy order for token #1)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -10))])'
      },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: buyer updates expiration_bnum of buy order', async () => {
    // This is not updating an order, simply setting the value on the first order. Should be Changed

    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

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
    
    console.log(tx.receipt);
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

    // // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceState.getState()
    console.log(contractState.buy_orders)

    let __buyerAddress = accounts.nftBuyer.address

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [zero_address.toLowerCase()]: {
              "10000" : {
                [__buyerAddress.toLowerCase()] : `${newExpiryBlock}`
              }
            },
          },
        },
      })
    );
  })

  test('SetOrder: Seller creates sell order for token #1', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

    const contractStateStart = await fixedPriceState.getState()
    const contractStateStartSellOrders = contractStateStart.sell_orders;

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
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(expiryBlock)

    // Confirming that our sell order was executed correctly by reading the contract state

    const contractState = await fixedPriceState.getState()
    const sellOrders = contractState.sell_orders

    const newBuyOrder = Object.keys(sellOrders).filter((order) =>  order.includes(2))
    console.log(newBuyOrder)
    
    let __sellerAddress = accounts.nftSeller.address;

    expect(JSON.stringify(contractState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [zero_address]: {
              "10000" : {
                [__sellerAddress.toLowerCase()] : contractStateStartSellOrders[nftTokenAddress.toLowerCase()][1][zero_address.toLowerCase()][10000][__sellerAddress.toLowerCase()]
              },
              [salePrice] : {
                [__sellerAddress.toLowerCase()] : `${expiryBlock}`
              }
            },
          }
        },
      })
    );
  })

  test('SetOrder: Buyer creates buy order for token #1', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

    const contractStateStart = await fixedPriceState.getState()
    const contractStateStartBuyOrders = contractStateStart.buy_orders;

    const transferProxyStartBalance = await getBalance(_transferProxyContract)
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
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(expiryBlock)

    // Confirming that the token balance of buyer and contract updated correctly
    const transferProxyEndBalance = await getBalance(_transferProxyContract)
    const buyerEndingBalance = await getBalance(accounts.nftBuyer.address)

    const txFee = parseInt(tx.receipt.cumulative_gas) * parseInt(tx.gasPrice);
    // const bid = new BN(salePrice
    const totalExpense = parseInt(salePrice + txFee)

    console.log('starting Balance:', buyerStartingBalance)
    console.log('ending balance:', buyerEndingBalance)
    console.log('gas total cost:', txFee)
    console.log('sale price:', salePrice)
    console.log('buy offer + gas total cost:', parseInt(salePrice) + txFee)

    console.log("Transfer Proxy Start Balance: ", transferProxyStartBalance)
    console.log("Transfer Proxy End Balance: ", transferProxyEndBalance)

    expect(parseInt(transferProxyEndBalance)).toBe(parseInt(transferProxyStartBalance) + parseInt(salePrice))
    // expect(parseInt(buyerEndingBalance)).toBe((totalExpense) - parseInt(buyerStartingBalance))

    // Confirming that our buy order was executed correctly by reading the contract state
    const contractState = await fixedPriceState.getState()

    let __buyerAddress = accounts.nftBuyer.address;

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [zero_address]: {
              "10000" : {
                [__buyerAddress.toLowerCase()] : contractStateStartBuyOrders[nftTokenAddress.toLowerCase()][1][zero_address.toLowerCase()][10000][__buyerAddress.toLowerCase()]
              },
              [salePrice]: {
                [__buyerAddress.toLowerCase()] : `${expiryBlock}`
              },
            },
          },
        },
      })
    );
  })

  test('BatchSetOrder: throws PausedError Proxy', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

    const orderList = []

    const tokenId = String(1)
    const salePrice = String(20000)
    const side = String(0)
    const expiryBlock = String(globalBNum + 35)

    // Pause Contract
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
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "proxy")) ; (code : (Int32 -3))])'
      },
      { line: 1, message: 'Raised from SetBatchOrder' }
    ])
  })

  test('FulfillOrder: throws NotAllowedUserError', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )

    console.log("FulfillOrder: throws NotAllowedUserError", tx.receipt);
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -19))])'
      },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: throws SellOrderNotFoundError', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )
    console.log(tx.receipt);
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -6))])'
      },
      { line: 1, message: 'Raised from RequireSameAddress' },
      { line: 1, message: 'Raised from RequireValidDestination' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })
  
  test('FulfillOrder: throws BuyOrderNotFoundError', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )
    console.log(tx.receipt);
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -7))])'
      },
      { line: 1, message: 'Raised from RequireSameAddress' },
      { line: 1, message: 'Raised from RequireValidDestination' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: throws ExpiredError', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -11))])'
      },
      { line: 1, message: 'Raised from RequireSameAddress' },
      { line: 1, message: 'Raised from RequireValidDestination' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })
  
  test('FulfillOrder: Buyer fullfills sell order (not collection item)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const nftContract = zilliqa.contracts.at(nftTokenAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
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
    const event = tx.receipt.event_logs.filter((e) => e._eventname === 'FulfillOrder')[0]
    console.log(event)
  })

  test('FulfillOrder: Buyer fullfills sell order (IS collection item)', async () => {
    const collectionContract = zilliqa.contracts.at(collectionContractAddress)

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

    await addTokenToCollection(
      collectionContract,
      accounts.nftSeller.privateKey,
      accounts.address01.privateKey,
      collectionItem
    )

    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      salePrice,
      false,
      false
    )

    console.log(tx.receipt)
    // console.log(tx.receipt.transitions)
    expect(tx.receipt.success).toEqual(true)

    // const eventFulfillOrder = tx.receipt.event_logs.filter((e) => e._eventname === 'FulfillOrder')[0]
    // const eventCommissionFeePaid = tx.receipt.event_logs.filter((e) => e._eventname === 'CommissionFeePaid')[0]

    // console.log('FulfillOrder event', eventFulfillOrder)
    // console.log('CommissionFeePaid event', eventCommissionFeePaid)

  })

  test('FulfillOrder: Seller fullfills buy order', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
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

  test('CancelOrder: throws BuyOrderNotFoundError by stranger', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
    console.log("CancelOrder: throws NotAllowedToCancelOrder by stranger", tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -7))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequireProxy' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireProxy' },
      { line: 1, message: 'Raised from CancelOrder' }
    ])
  })

  test('CancelOrder: Buyer cancels buy order', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

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
    console.log("CancelOrder: Buyer cancels buy order", tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'CancelOrder')[0]

    //let tokenAddress = txEvent.params[2].value
    //tokenAddress = tokenAddress.toLowerCase()

    console.log(txEvent)

    expect(txEvent.params[0].value).toEqual(accounts.nftBuyer.address.toLowerCase())
    expect(txEvent.params[5].value).toEqual(salePrice)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceState.getState()
    console.log("contractState.buy_orders", contractState.buy_orders);

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: { [zero_address.toLowerCase()]: {} },
        },
      })
    );
  })

  test('CancelOrder: Seller cancels sell order', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

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
    console.log("CancelOrder: Seller cancels sell order", tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'CancelOrder')[0]

    //let tokenAddress = txEvent.params[2].value
    //tokenAddress = tokenAddress.toLowerCase()

    console.log(txEvent)

    expect(txEvent.params[0].value).toEqual(accounts.nftSeller.address.toLowerCase())
    expect(txEvent.params[5].value).toEqual(salePrice)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceState.getState()
    console.log("contractState.sell_orders",contractState.sell_orders);

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
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const paymentTokenContract = zilliqa.contracts.at(paymentTokenAddress)

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

    console.log(txSellOrder.receipt)
    expect(txSellOrder.receipt.success).toEqual(true)

    const txSellOrderEvent = txSellOrder.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txSellOrderEvent);

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

    console.log(txBuyOrder.receipt)
    expect(txBuyOrder.receipt.success).toEqual(true)

    const txBuyOrderEvent = txBuyOrder.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]
    console.log(txBuyOrderEvent);
  })

  test('SetOrder: throws NotTokenOwnerError (stranger creates sell order for token #1)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
    
    console.log(tx.receipt);
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -9))])'
      },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: throws NotAllowedPaymentToken (seller creates sell order for token #2)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

    // The 'SetOrder' takes in an ADT called 'OrderParam' so need to construct it first
    const formattedAdtOrder = await createFixedPriceOrder(
      fixedPriceAddress,
      nftTokenAddress,
      '2',
      notAcceptedPaymentTokenAddress,
      '20000',
      '0',
      String(globalBNum + 35)
    )

    console.log(formattedAdtOrder, "formattedAdtOrder");

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
    
    console.log(tx.receipt);
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -15))])'
      },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: throws TokenOwnerError (seller must not create a buy order for token #1)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
    
    console.log("SetOrder: throws TokenOwnerError", tx.receipt);
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -10))])'
      },
      { line: 1, message: 'Raised from RequireValidTotalFees' },
      { line: 1, message: 'Raised from RequireThisToBeSpender' },
      { line: 1, message: 'Raised from RequireAllowedPaymentToken' },
      { line: 1, message: 'Raised from RequireNotExpired' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from SetOrder' }
    ])
  })

  test('SetOrder: buyer updates expiration_bnum of buy order', async () => {
    // This is not updating an order, simply setting the value on the first order. Should be Changed

    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

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
    
    console.log("SetOrder: buyer updates expiration_bnum of buy order",tx.receipt);
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(newExpiryBlock)

    // // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceState.getState()
    console.log(contractState.buy_orders)

    let __buyerAddress = accounts.nftBuyer.address

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [paymentTokenAddress.toLowerCase()]: {
              "10000" : {
                [__buyerAddress.toLowerCase()] : `${newExpiryBlock}`
              }
            },
          },
        },
      })
    );
  })

  test('SetOrder: Seller creates sell order for token #1', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

    const contractStateStart = await fixedPriceState.getState()
    const contractStateStartSellOrders = contractStateStart.sell_orders;

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
    const contractStateEnd = await fixedPriceState.getState()
    console.log(contractStateEnd, "contractStateEnd");

    let __sellerAddress = accounts.nftSeller.address;

    expect(JSON.stringify(contractStateEnd.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [paymentTokenAddress.toLowerCase()]: {
              "10000" : {
                [__sellerAddress.toLowerCase()] : contractStateStartSellOrders[nftTokenAddress.toLowerCase()][1][paymentTokenAddress.toLowerCase()][10000][__sellerAddress.toLowerCase()]
              },
              [salePrice] : {
                [__sellerAddress.toLowerCase()] : `${expiryBlock}`
              }
            },
          }
        },
      })
    );
  })

  test('SetOrder: Buyer creates buy order for token #1', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

    const contractStateStart = await fixedPriceState.getState()
    const contractStateStartBuyOrders = contractStateStart.buy_orders;

    const trasferProxyStartBalance = await getZRC2State(_transferProxyContract, paymentTokenAddress)
    console.log(trasferProxyStartBalance, "trasferProxyStartBalance");

    const buyerStartBalance = await getZRC2State(accounts.nftBuyer.address, paymentTokenAddress)
    console.log(buyerStartBalance, "buyerStartBalance");

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

    console.log(tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'SetOrder')[0]

    let tokenAddress = txEvent.params[2].value
    tokenAddress = tokenAddress.toLowerCase()

    expect(txEvent.params[1].value).toEqual(side)
    expect(txEvent.params[3].value).toEqual(tokenId)
    expect(txEvent.params[5].value).toEqual(salePrice)
    expect(txEvent.params[6].value).toEqual(expiryBlock)

    const trasferProxybeEndBalance = await getZRC2State(_transferProxyContract, paymentTokenAddress)
    console.log(trasferProxybeEndBalance, "trasferProxybeEndBalance");

    const buyerEndBalance = await getZRC2State(accounts.nftBuyer.address, paymentTokenAddress)
    console.log(buyerEndBalance, "buyerEndBalance");

    expect(parseInt(trasferProxybeEndBalance)).toBe(parseInt(trasferProxyStartBalance) + parseInt(salePrice))
    expect(parseInt(buyerEndBalance)).toBe(parseInt(buyerStartBalance) - parseInt(salePrice))

    // Confirming that our buy order was executed correctly by reading the contract state
    const contractStateEnd = await fixedPriceState.getState()
    console.log(contractStateEnd.buy_orders, "contractStateEnd.buy_orders");

    let __buyerAddress = accounts.nftBuyer.address;

    expect(JSON.stringify(contractStateEnd.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [paymentTokenAddress.toLowerCase()]: {
              "10000" : {
                [__buyerAddress.toLowerCase()] : contractStateStartBuyOrders[nftTokenAddress.toLowerCase()][1][paymentTokenAddress.toLowerCase()][10000][__buyerAddress.toLowerCase()]
              },
              [salePrice]: {
                [__buyerAddress.toLowerCase()] : `${expiryBlock}`
              },
            },
          },
        },
      })
    );
  })

  test('FulfillOrder: throws SellOrderNotFoundError', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )
    
    console.log("FulfillOrder: throws SellOrderNotFoundError", tx.receipt);
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -6))])'
      },
      { line: 1, message: 'Raised from RequireSameAddress' },
      { line: 1, message: 'Raised from RequireValidDestination' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: throws BuyOrderNotFoundError', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )
    console.log("FulfillOrder: throws BuyOrderNotFoundError", tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -7))])'
      },
      { line: 1, message: 'Raised from RequireSameAddress' },
      { line: 1, message: 'Raised from RequireValidDestination' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: Buyer fullfills sell order (not collection item)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
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
  })

  test('FulfillOrder: Buyer fullfills sell order (IS collection item)', async () => {
    const collectionContract = zilliqa.contracts.at(collectionContractAddress)

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

    await addTokenToCollection(
      collectionContract,
      accounts.nftSeller.privateKey,
      accounts.address01.privateKey,
      collectionItem
    )

    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )

    const eventFulfillOrder = tx.receipt.event_logs.filter((e) => e._eventname === 'FulfillOrder')[0]
    const eventCommissionFeePaid = tx.receipt.event_logs.filter((e) => e._eventname === 'CommissionFeePaid')[0]

    console.log('FulfillOrder event', eventFulfillOrder)
    console.log('CommissionFeePaid event', eventCommissionFeePaid)

    console.log("FulfillOrder: Buyer fullfills sell order (IS collection item)",tx.receipt)
    console.log(tx.receipt.transitions)
    expect(tx.receipt.success).toEqual(true)
  })

  test('FulfillOrder: throws ExpiredError', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
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
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -11))])'
      },
      { line: 1, message: 'Raised from RequireSameAddress' },
      { line: 1, message: 'Raised from RequireValidDestination' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequireAllowedUser' },
      { line: 1, message: 'Raised from FulfillOrder' }
    ])
  })

  test('FulfillOrder: Seller fullfills buy order (not collection item)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)
  })

  test('FulfillOrder: Seller fullfills buy order (IS collection item)', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const collectionContract = zilliqa.contracts.at(collectionContractAddress)

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
        },
        {
          vname: 'seller',
          type: 'ByStr20',
          value: accounts.nftSeller.address
        },
        {
          vname: 'buyer',
          type: 'ByStr20',
          value: accounts.nftBuyer.address
        }
      ],
      0,
      false,
      false
    )

    expect(tx.receipt.success).toEqual(true)
  })

  test('CancelOrder: throws BuyOrderNotFoundError by stranger', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)

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
    console.log("CancelOrder: throws NotAllowedToCancelOrder by stranger", tx.receipt)
    expect(tx.receipt.success).toEqual(false)
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message: 'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (Int32 -7))])'
      },
      { line: 1, message: 'Raised from RequireNotPaused' },
      { line: 1, message: 'Raised from RequireProxy' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireNonZeroAddress' },
      { line: 1, message: 'Raised from RequireProxy' },
      { line: 1, message: 'Raised from CancelOrder' }
    ])
  })

  test('CancelOrder: Buyer cancels buy order', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

    const trasferProxyStartBalance = await getZRC2State(_transferProxyContract, paymentTokenAddress)
    console.log(trasferProxyStartBalance, "trasferProxyStartBalance");

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
    console.log("CancelOrder: Buyer cancels buy order", tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'CancelOrder')[0]

    //let tokenAddress = txEvent.params[2].value
    //tokenAddress = tokenAddress.toLowerCase()

    console.log(txEvent)

    expect(txEvent.params[0].value).toEqual(accounts.nftBuyer.address.toLowerCase())
    expect(txEvent.params[5].value).toEqual(salePrice)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceState.getState()
    console.log("contractState.buy_orders", contractState.buy_orders);

    const trasferProxybeEndBalance = await getZRC2State(_transferProxyContract, paymentTokenAddress)
    console.log(trasferProxybeEndBalance, "trasferProxybeEndBalance");

    const buyerEndBalance = await getZRC2State(accounts.nftBuyer.address, paymentTokenAddress)
    console.log(buyerEndBalance, "buyerEndBalance");

    expect(parseInt(trasferProxybeEndBalance)).toBe(parseInt(trasferProxyStartBalance) - parseInt(salePrice))
    expect(parseInt(buyerEndBalance)).toBe(parseInt(buyerStartBalance) + parseInt(salePrice))

    expect(JSON.stringify(contractState.buy_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: { [paymentTokenAddress.toLowerCase()]: {} },
        },
      })
    );
  })

  test('CancelOrder: Seller cancels sell order', async () => {
    const fixedPriceContract = zilliqa.contracts.at(fixedPriceAddress)
    const fixedPriceState = zilliqa.contracts.at(_fixedPriceState)

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
    console.log("CancelOrder: Seller cancels sell order", tx.receipt)
    expect(tx.receipt.success).toEqual(true)

    // Confirming that the order was executed correctly based on the emitted event
    const txEvent = tx.receipt.event_logs.filter((e) => e._eventname === 'CancelOrder')[0]

    //let tokenAddress = txEvent.params[2].value
    //tokenAddress = tokenAddress.toLowerCase()

    console.log(txEvent)

    expect(txEvent.params[0].value).toEqual(accounts.nftSeller.address.toLowerCase())
    expect(txEvent.params[5].value).toEqual(salePrice)

    // Confirming that our buy order was in fact updated correctly 
    const contractState = await fixedPriceState.getState()
    console.log("contractState.sell_orders",contractState.sell_orders);

    expect(JSON.stringify(contractState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: { [paymentTokenAddress.toLowerCase()]: {} },
        },
      })
    );
  })

})