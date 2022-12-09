/* eslint-disable no-undef */
require("dotenv").config({ path: "./.env" });
const { BN } = require("@zilliqa-js/util");
const { scillaJSONVal } = require("@zilliqa-js/scilla-json-utils");
const { getAddressFromPrivateKey, schnorr } = require("@zilliqa-js/crypto");
const {
  deployAllowlistContract,
} = require("../scripts/marketplace/deployAllowlistContract.js");
// const { deployEnglishAuctionContract } = require('../scripts/marketplace/deployEnglishAuctionContract.js')
const { deployFungibleToken } = require("../scripts/deployFungibleToken.js");
const {
  deployCollectionContract,
} = require("../scripts/marketplace/deployCollectionContract.js");
const {
  addTokenToCollection,
} = require("../scripts/marketplace/addTokenToCollection");

const {
  deployNonFungibleToken,
} = require("../scripts/deployNonFungibleToken.js");
const {
  setupBalancesOnAccounts,
  clearBalancesOnAccounts,
} = require("../scripts/utils/call.js");

// const { getContractState } = require('../scripts/utils/deploy.js')
const {
  callContract,
  getBalance,
  getZRC2State,
  getZRC6TokenOwner,
} = require("../scripts/utils/call.js");
const { getBlockNumber } = require("../scripts/utils/helper");
const { zilliqa } = require("../scripts/utils/zilliqa.js");

const {
  deployTransferProxyContract,
} = require("../scripts/marketplace/deployTransferProxyContract.js");
const {
  deployEnglishAuctionContractProxy,
} = require("../scripts/marketplace/deployEnglishAuctionContractProxy.js");
const {
  deployEnglishAuctionContractState,
} = require("../scripts/marketplace/deployEnglishAuctionContractState.js");
const {
  deployEnglishAuctionContractLogic,
} = require("../scripts/marketplace/deployEnglishAuctionContractLogic.js");
const {
  updateLogicContractInTransferProxy,
} = require("../scripts/marketplace/updateLogicContractInTransferProxy.js");
const {
  updateLogicContractInStateProxy,
} = require("../scripts/marketplace/updateLogicContractInStateProxy.js");

const zero_address = "0x0000000000000000000000000000000000000000";

const accounts = {
  contractOwner: {
    privateKey: process.env.MASTER_PRIVATE_KEY,
    address: getAddressFromPrivateKey(process.env.MASTER_PRIVATE_KEY),
  },
  nftSeller: {
    privateKey: process.env.SELLER_PRIVATE_KEY,
    address: getAddressFromPrivateKey(process.env.SELLER_PRIVATE_KEY),
  },
  nftBuyer: {
    privateKey: process.env.BUYER_PRIVATE_KEY,
    address: getAddressFromPrivateKey(process.env.BUYER_PRIVATE_KEY),
  },
  stranger: {
    privateKey: process.env.N_01_PRIVATE_KEY,
    address: getAddressFromPrivateKey(process.env.N_01_PRIVATE_KEY),
  },
  forbidden: {
    address: getAddressFromPrivateKey(process.env.N_02_PRIVATE_KEY),
    privateKey: process.env.N_02_PRIVATE_KEY,
  },
  address01: {
    address: getAddressFromPrivateKey(process.env.TOKEN1_PRIVATE_KEY),
    privateKey: process.env.TOKEN1_PRIVATE_KEY,
  },
  address02: {
    address: getAddressFromPrivateKey(process.env.TOKEN2_PRIVATE_KEY),
    privateKey: process.env.N_02_PRIVATE_KEY,
  },
  address03: {
    address: getAddressFromPrivateKey(process.env.N_03_PRIVATE_KEY),
    privateKey: process.env.N_03_PRIVATE_KEY,
  },
  address04: {
    address: getAddressFromPrivateKey(process.env.N_04_PRIVATE_KEY),
    privateKey: process.env.N_04_PRIVATE_KEY,
  },
};

console.log("🔥 🔥 🔥 🔥 🔥", accounts);

let paymentTokenAddress;
let notAcceptedPaymentTokenAddress;
let englishAuctionAddress;
let nftTokenAddress;
let allowlistAddress;
let collectionContractAddress;
let _transferProxyContract;
let _englishAuctionProxy;
let _englishAuctionState;
let _englishAuctionLogic;

async function createOrderParam(
  englishAuctionAddress,
  tokenAddress,
  tokenId,
  payment_token_address,
  start_amount,
  expiration_block_number
) {
  return {
    constructor: `${englishAuctionAddress.toLowerCase()}.OrderParam`,
    argtypes: [],
    arguments: [
      tokenAddress.toLowerCase(),
      tokenId,
      payment_token_address,
      start_amount,
      expiration_block_number,
    ],
  };
}

async function createPairADT(address, string) {
  return {
    constructor: "Pair",
    argtypes: ["ByStr20", "String"],
    arguments: [address, string],
  };
}

async function createCollectionItemParam(
  collectionContractAddress,
  tokenAddress,
  tokenId,
  collection_id
) {
  return {
    constructor: `${collectionContractAddress.toLowerCase()}.CollectionItemParam`,
    argtypes: [],
    arguments: [tokenAddress.toLowerCase(), tokenId, collection_id],
  };
}

beforeAll(async () => {
  await setupBalancesOnAccounts(accounts);
});

afterAll(async () => {
  await clearBalancesOnAccounts(accounts);
});

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

  // deploy english auction proxy
  const [englishAuctionContract] = await deployEnglishAuctionContractProxy(
    accounts.contractOwner.privateKey,
    { initialOwnerAddress: accounts.contractOwner.address }
  );
  _englishAuctionProxy = englishAuctionContract.address;
  englishAuctionAddress = englishAuctionContract.address;
  console.log("englishAuctionProxy =", _englishAuctionProxy);
  if (_englishAuctionProxy === undefined) {
    throw new Error();
  }

  // deploy english auction state
  const [englishAuctionState] = await deployEnglishAuctionContractState(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address,
      collectionContract: collectionContractAddress,
    }
  );
  _englishAuctionState = englishAuctionState.address;
  console.log("englishAuctionState =", _englishAuctionState);
  if (_englishAuctionState === undefined) {
    throw new Error();
  }

  // deploy english auction logic
  const [englishAuctionLogic] = await deployEnglishAuctionContractLogic(
    accounts.contractOwner.privateKey,
    {
      initialOwnerAddress: accounts.contractOwner.address,
      state: _englishAuctionState,
      proxy: _englishAuctionProxy,
      transfer_proxy: _transferProxyContract,
    }
  );
  _englishAuctionLogic = englishAuctionLogic.address;
  console.log("englishAuctionLogic =", _englishAuctionLogic);
  if (_englishAuctionLogic === undefined) {
    throw new Error();
  }

  const _updateLogicContractInTransferProxy =
    await updateLogicContractInTransferProxy(
      accounts.contractOwner.privateKey,
      _transferProxyContract,
      _englishAuctionLogic,
      "updateOperator",
      "to",
      "status",
      "True"
    );
  console.log(
    "Update Logic Contract In TransferProxy",
    _updateLogicContractInTransferProxy.success
  );
  if (_updateLogicContractInTransferProxy.success === false) {
    throw new Error();
  }

  const _updateLogicContractInState = await updateLogicContractInStateProxy(
    accounts.contractOwner.privateKey,
    _englishAuctionState,
    _englishAuctionLogic,
    "UpdateLogic",
    "new_logic_contract"
  );
  console.log(
    "Update Logic Contract In State",
    _updateLogicContractInState.success
  );
  if (_updateLogicContractInState.success === false) {
    throw new Error();
  }

  const _updateLogicContractInProxy = await updateLogicContractInStateProxy(
    accounts.contractOwner.privateKey,
    _englishAuctionProxy,
    _englishAuctionLogic,
    "UpdateLogic",
    "to"
  );
  console.log(
    "Update LogicContract In Proxy",
    _updateLogicContractInProxy.success
  );
  if (_updateLogicContractInProxy.success === false) {
    throw new Error();
  }

  const _updateStateContractInProxy = await updateLogicContractInStateProxy(
    accounts.contractOwner.privateKey,
    _englishAuctionProxy,
    _englishAuctionState,
    "UpdateState",
    "to"
  );
  console.log(
    "Update State Contract In Proxy",
    _updateStateContractInProxy.success
  );
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
    englishAuctionState,
    "SetAllowlist",
    [
      {
        vname: "address",
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
    englishAuctionState,
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

  // Increasing the amount of wZIL the englishAuctionContract can spend
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
        value: englishAuctionAddress.toLowerCase(),
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
        value: _englishAuctionLogic.toLowerCase(),
      },
    ],
    0,
    false,
    false
  );

  expect(txRegisterMarketplaceAddressLogic.receipt.success).toEqual(true);
});

describe("Native ZIL", () => {
  beforeEach(async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    let globalBNum = await getBlockNumber(zilliqa);
    let expiration_block_number = String(globalBNum + 100);
    let amount = String(1000);
    let tokenId = String(1);

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      amount,
      expiration_block_number
    );

    const startTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Start",
      [
        {
          vname: "order",
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam,
        },
      ],
      0,
      false,
      false
    );
    expect(startTx.receipt.success).toEqual(true);
    const __englishAuctionState = zilliqa.contracts.at(_englishAuctionState);
    const auctionState = await __englishAuctionState.getState();
    const getOwnerOfNFT = await getZRC6TokenOwner(nftTokenAddress, tokenId);
    expect(getOwnerOfNFT).toEqual(_transferProxyContract.toLowerCase());

    expect(JSON.stringify(auctionState.sell_order_expired_block)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: expiration_block_number,
        },
      })
    );

    expect(JSON.stringify(auctionState.sell_order_payment_token)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: zero_address,
        },
      })
    );

    expect(JSON.stringify(auctionState.sell_order_start_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount,
        },
      })
    );

    expect(JSON.stringify(auctionState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftSeller.address.toLowerCase(),
        },
      })
    );
  });

  test("Start: Create Sell Order when Paused: throws PausedError", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    // Pause contract
    const pauseTx = await callContract(
      accounts.contractOwner.privateKey,
      englishAuctionContract,
      "Pause",
      [],
      0,
      false,
      false
    );
    expect(pauseTx.receipt.success).toEqual(true);
    let globalBNum = await getBlockNumber(zilliqa);
    let expiration_block_number = String(globalBNum + 10000);
    let amount = String(1000);
    let tokenId = String(2);

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      amount,
      expiration_block_number
    );

    const startTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Start",
      [
        {
          vname: "order",
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Start: Create Sell Order when Paused: throws PausedError",
      startTx.receipt
    );
    expect(startTx.receipt.success).toEqual(false);
    expect(startTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "proxy")) ; (code : (String "PausedError"))])',
      },
      { line: 1, message: "Raised from Start" },
    ]);
  });

  test("Start: Create Sell Order by Not Allowed User: throws NotAllowedUserError", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    let globalBNum = await getBlockNumber(zilliqa);
    let expiration_block_number = String(globalBNum + 10000);
    let amount = String(1000);
    let tokenId = String(2);

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      amount,
      expiration_block_number
    );

    const startTx = await callContract(
      accounts.forbidden.privateKey,
      englishAuctionContract,
      "Start",
      [
        {
          vname: "order",
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Start: Create Sell Order by Not Allowed User: throws NotAllowedUserError",
      startTx.receipt
    );
    expect(startTx.receipt.success).toEqual(false);
    expect(startTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "NotAllowedUserError"))])',
      },
      { line: 1, message: "Raised from RequireProxy" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from Start" },
    ]);
  });

  test("Start: Create Sell Order by Allowed User but not Owner: throws NotTokenOwnerError", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    let globalBNum = await getBlockNumber(zilliqa);
    let expiration_block_number = String(globalBNum + 10000);
    let amount = String(1000);
    let tokenId = String(2);

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      amount,
      expiration_block_number
    );

    const startTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Start",
      [
        {
          vname: "order",
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Start: Create Sell Order by Allowed User but not Owner: throws NotTokenOwnerError",
      startTx.receipt
    );
    expect(startTx.receipt.success).toEqual(false);
    expect(startTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "NotTokenOwnerError"))])',
      },
      { line: 1, message: "Raised from RequireValidTotalFees" },
      { line: 1, message: "Raised from RequireAllowedPaymentToken" },
      { line: 1, message: "Raised from RequireNotExpired" },
      { line: 1, message: "Raised from RequireAllowedUser" },
      { line: 1, message: "Raised from RequireProxy" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from Start" },
    ]);
  });

  test("Start: Create Sell Order with not allowed payment token: throws NotAllowedPaymentToken", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    let globalBNum = await getBlockNumber(zilliqa);
    let expiration_block_number = String(globalBNum + 10000);
    let amount = String(1000);
    let tokenId = String(1);

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      tokenId,
      notAcceptedPaymentTokenAddress,
      amount,
      expiration_block_number
    );

    const startTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Start",
      [
        {
          vname: "order",
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Start: Create Sell Order with not allowed payment token: throws NotAllowedPaymentToken",
      startTx.receipt
    );
    expect(startTx.receipt.success).toEqual(false);
    expect(startTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "NotAllowedPaymentToken"))])',
      },
      { line: 1, message: "Raised from RequireNotExpired" },
      { line: 1, message: "Raised from RequireAllowedUser" },
      { line: 1, message: "Raised from RequireProxy" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from Start" },
    ]);
  });

  test("Start: Create duplicate Sell Order: throws SellOrderFoundError", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    let globalBNum = await getBlockNumber(zilliqa);
    let expiration_block_number = String(globalBNum + 10000);
    let amount = String(1000);
    let tokenId = String(1);

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      amount,
      expiration_block_number
    );

    const startTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Start",
      [
        {
          vname: "order",
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Start: Create duplicate Sell Order: throws SellOrderFoundError",
      startTx.receipt
    );
    expect(startTx.receipt.success).toEqual(false);
    expect(startTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "SellOrderFoundError"))])',
      },
      { line: 1, message: "Raised from RequireValidTotalFees" },
      { line: 1, message: "Raised from RequireAllowedPaymentToken" },
      { line: 1, message: "Raised from RequireNotExpired" },
      { line: 1, message: "Raised from RequireAllowedUser" },
      { line: 1, message: "Raised from RequireProxy" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from Start" },
    ]);
  });

  test("Cancel: Cancel Sell order by Seller", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    // cancel sale
    let tokenId = String(1);

    const cancelTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Cancel",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );
    console.log("Cancel: Cancel Sell order by Seller", cancelTx.receipt);
    expect(cancelTx.receipt.success).toEqual(true);

    const __englishAuctionState = zilliqa.contracts.at(_englishAuctionState);
    const auctionState = await __englishAuctionState.getState();
    console.log(auctionState);
    console.log(JSON.stringify(auctionState.assets));

    expect(JSON.stringify(auctionState.assets)).toBe(
      JSON.stringify({
        [accounts.nftSeller.address.toLowerCase()]: {
          [nftTokenAddress.toLowerCase()]: {
            [tokenId]: { argtypes: [], arguments: [], constructor: "True" },
          },
        },
      })
    );

    expect(JSON.stringify(auctionState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_payment_token)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_expired_block)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_start_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );
  });

  test("Cancel: Cancel Sell order by Contract Owner", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    // cancel sale
    let tokenId = String(1);

    const cancelTx = await callContract(
      accounts.contractOwner.privateKey,
      englishAuctionContract,
      "Cancel",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Cancel: Cancel Sell order by Contract Owner",
      cancelTx.receipt
    );
    expect(cancelTx.receipt.success).toEqual(true);

    const __englishAuctionState = zilliqa.contracts.at(_englishAuctionState);
    const auctionState = await __englishAuctionState.getState();
    console.log(auctionState);
    console.log(JSON.stringify(auctionState.assets));

    expect(JSON.stringify(auctionState.assets)).toBe(
      JSON.stringify({
        [accounts.nftSeller.address.toLowerCase()]: {
          [nftTokenAddress.toLowerCase()]: {
            [tokenId]: { argtypes: [], arguments: [], constructor: "True" },
          },
        },
      })
    );

    expect(JSON.stringify(auctionState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_payment_token)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_expired_block)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_start_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );
  });

  test("Cancel: Cancel Sell order by Stranger: throws NotAllowedToCancelOrder", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    // cancel sale
    let tokenId = String(1);

    const cancelTx = await callContract(
      accounts.stranger.privateKey,
      englishAuctionContract,
      "Cancel",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );
    console.log("Cancel: Cancel Sell order by Stranger", cancelTx.receipt);
    expect(cancelTx.receipt.success).toEqual(false);
    expect(cancelTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "NotAllowedToCancelOrder"))])',
      },
      { line: 1, message: "Raised from RequireNotExpired" },
      { line: 1, message: "Raised from RequireProxy" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from Cancel" },
    ]);
  });

  test("Cancel: Cancel Sell order by Seller and WithdrawAsset", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    // cancel sale
    let tokenId = String(1);

    const cancelTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Cancel",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Cancel: Cancel Sell order by Seller and WithdrawAsset: 1",
      cancelTx.receipt
    );
    expect(cancelTx.receipt.success).toEqual(true);

    const __englishAuctionState = zilliqa.contracts.at(_englishAuctionState);
    const auctionState = await __englishAuctionState.getState();
    console.log(auctionState);
    console.log(JSON.stringify(auctionState.assets));

    expect(JSON.stringify(auctionState.assets)).toBe(
      JSON.stringify({
        [accounts.nftSeller.address.toLowerCase()]: {
          [nftTokenAddress.toLowerCase()]: {
            [tokenId]: { argtypes: [], arguments: [], constructor: "True" },
          },
        },
      })
    );

    expect(JSON.stringify(auctionState.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_payment_token)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_expired_block)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState.sell_order_start_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    const withdrawTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "WithdrawAsset",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Cancel: Cancel Sell order by Seller and WithdrawAsset: 2",
      withdrawTx.receipt
    );
    expect(withdrawTx.receipt.success).toEqual(true);
    const getOwnerOfNFT = await getZRC6TokenOwner(nftTokenAddress, tokenId);
    expect(getOwnerOfNFT).toEqual(accounts.nftSeller.address.toLowerCase());
  });

  test("Cancel: WithdrawAsset without cancelling sell order", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);

    // cancel sale
    let tokenId = String(1);

    const withdrawTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "WithdrawAsset",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Cancel: Withdrawasset without cancelling sell order",
      withdrawTx.receipt
    );
    expect(withdrawTx.receipt.success).toEqual(false);
    expect(withdrawTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "AssetNotFoundError"))])',
      },
      { line: 1, message: "Raised from RequireProxy" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireNonZeroAddress" },
      { line: 1, message: "Raised from RequireAllowedUser" },
      { line: 1, message: "Raised from WithdrawAsset" },
    ]);
  });

  test("Bid: Buyer places Bid on Sell Order", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    const transferProxyStartBalance = await getBalance(_transferProxyContract);
    let tokenId = String(1);
    let amount = String(2000);

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount,
      false,
      false
    );

    console.log("Bid: Buyer places Bid on Sell Order", bidTx.receipt);
    expect(bidTx.receipt.success).toEqual(true);

    const transferProxyEndBalance = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance)).toBe(
      parseInt(transferProxyStartBalance) + parseInt(amount)
    );

    const __englishAuctionState = zilliqa.contracts.at(_englishAuctionState);
    const auctionState = await __englishAuctionState.getState();

    expect(JSON.stringify(auctionState.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount,
        },
      })
    );
  });

  test("Bid: Buyer places Bid on Sell Order two times by same Buyer", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    const transferProxyStartBalance1 = await getBalance(_transferProxyContract);
    let tokenId = String(1);
    let amount1 = String(2000);

    const bidTx1 = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount1,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount1,
      false,
      false
    );

    console.log(
      "Bid: Buyer places Bid on Sell Order two times: 1",
      bidTx1.receipt
    );
    expect(bidTx1.receipt.success).toEqual(true);

    const transferProxyEndBalance1 = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance1)).toBe(
      parseInt(transferProxyStartBalance1) + parseInt(amount1)
    );

    const __englishAuctionState1 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState1 = await __englishAuctionState1.getState();

    console.log(JSON.stringify(auctionState1.payment_tokens));

    expect(JSON.stringify(auctionState1.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount1,
        },
      })
    );

    const transferProxyStartBalance2 = await getBalance(_transferProxyContract);
    let amount2 = String(3000);

    const bidTx2 = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount2,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount2,
      false,
      false
    );

    console.log(
      "Bid: Buyer places Bid on Sell Order two times: 2",
      bidTx2.receipt
    );
    expect(bidTx2.receipt.success).toEqual(true);

    const transferProxyEndBalance2 = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance2)).toBe(
      parseInt(transferProxyStartBalance2) + parseInt(amount2)
    );

    const __englishAuctionState2 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState2 = await __englishAuctionState2.getState();
    console.log(JSON.stringify(auctionState2.payment_tokens));

    expect(JSON.stringify(auctionState2.payment_tokens)).toBe(
      JSON.stringify({
        [accounts.nftBuyer.address.toLowerCase()]: {
          [zero_address]: amount1,
        },
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount2,
        },
      })
    );
  });

  test("Bid: Buyers places Bid on Sell Order two times by different Buyer", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    const transferProxyStartBalance1 = await getBalance(_transferProxyContract);
    let tokenId = String(1);
    let amount1 = String(2000);

    const bidTx1 = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount1,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount1,
      false,
      false
    );

    console.log(
      "Bid: Buyers places Bid on Sell Order two times by different Buyer: 1",
      bidTx1.receipt
    );
    expect(bidTx1.receipt.success).toEqual(true);

    const transferProxyEndBalance1 = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance1)).toBe(
      parseInt(transferProxyStartBalance1) + parseInt(amount1)
    );

    const __englishAuctionState1 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState1 = await __englishAuctionState1.getState();

    console.log(JSON.stringify(auctionState1.payment_tokens));

    expect(JSON.stringify(auctionState1.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount1,
        },
      })
    );

    const transferProxyStartBalance2 = await getBalance(_transferProxyContract);
    let amount2 = String(3000);

    const bidTx2 = await callContract(
      accounts.stranger.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount2,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.stranger.address,
        },
      ],
      amount2,
      false,
      false
    );

    console.log(
      "Bid: Buyers places Bid on Sell Order two times by different Buyer: 2",
      bidTx2.receipt
    );
    expect(bidTx2.receipt.success).toEqual(true);

    const transferProxyEndBalance2 = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance2)).toBe(
      parseInt(transferProxyStartBalance2) + parseInt(amount2)
    );

    const __englishAuctionState2 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState2 = await __englishAuctionState2.getState();
    // console.log(JSON.stringify(auctionState2.payment_tokens));
    console.log(JSON.stringify(auctionState2.buy_orders_beneficiary));

    expect(JSON.stringify(auctionState2.payment_tokens)).toBe(
      JSON.stringify({
        [accounts.nftBuyer.address.toLowerCase()]: {
          [zero_address]: amount1,
        },
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.stranger.address.toLowerCase()]:
              accounts.stranger.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.stranger.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount2,
        },
      })
    );
  });

  test("Bid: Buyer places Bid on Sell Order with less amount throw: LessThanMinBidError", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    let tokenId = String(1);
    let amount = String(500);

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount,
      false,
      false
    );

    console.log(
      "Bid: Buyer places Bid on Sell Order with less amount throw: LessThanMinBidError",
      bidTx.receipt
    );
    expect(bidTx.receipt.success).toEqual(false);
    expect(bidTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "LessThanMinBidError"))])',
      },
      { line: 1, message: "Raised from RequireEqualZILAmount" },
      { line: 1, message: "Raised from RequireNotExpired" },
      { line: 1, message: "Raised from RequireAllowedUser" },
      { line: 1, message: "Raised from RequireAllowedUser" },
      { line: 1, message: "Raised from RequireNotPaused" },
      { line: 1, message: "Raised from Bid" },
    ]);
  });

  test("Bid: Buyer places Bid, Cancel Sell Order & WithdrawPaymentTokens", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    const transferProxyStartBalance = await getBalance(_transferProxyContract);

    const buyerStartBalance1 = await getBalance(accounts.nftBuyer.address);

    // Place bid
    let tokenId = String(1);
    let amount = String(1000000000000000);

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount,
      false,
      false
    );

    console.log(
      "Bid: Buyer places Bid, Cancel Sell Order & WithdrawPaymentTokens: 1",
      bidTx.receipt
    );
    expect(bidTx.receipt.success).toEqual(true);

    const transferProxyEndBalance = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance)).toBe(
      parseInt(transferProxyStartBalance) + parseInt(amount)
    );

    const __englishAuctionState = zilliqa.contracts.at(_englishAuctionState);
    const auctionState = await __englishAuctionState.getState();

    expect(JSON.stringify(auctionState.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount,
        },
      })
    );

    // cancel auction
    const cancelTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Cancel",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Bid: Buyer places Bid, Cancel Sell Order & WithdrawPaymentTokens: 2",
      cancelTx.receipt
    );
    expect(cancelTx.receipt.success).toEqual(true);

    const auctionStateUpdated = await __englishAuctionState.getState();
    console.log(JSON.stringify(auctionStateUpdated.assets));

    expect(JSON.stringify(auctionStateUpdated.assets)).toBe(
      JSON.stringify({
        [accounts.nftSeller.address.toLowerCase()]: {
          [nftTokenAddress.toLowerCase()]: {
            [tokenId]: { argtypes: [], arguments: [], constructor: "True" },
          },
        },
      })
    );

    expect(JSON.stringify(auctionStateUpdated.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionStateUpdated.sell_order_payment_token)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionStateUpdated.sell_order_expired_block)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionStateUpdated.sell_order_start_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    const buyerStartBalance2 = await getBalance(accounts.nftBuyer.address);
    const transferProxyBalanceStart = await getBalance(_transferProxyContract);

    // widthdraw tokens
    const withdrawTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "WithdrawPaymentTokens",
      [
        {
          vname: "payment_token_address",
          type: "ByStr20",
          value: zero_address,
        },
      ],
      0,
      false,
      false
    );
    console.log(
      "Bid: Buyer places Bid, Cancel Sell Order & WithdrawPaymentTokens: 3",
      withdrawTx.receipt
    );
    expect(withdrawTx.receipt.success).toEqual(true);

    const buyerStartBalance3 = await getBalance(accounts.nftBuyer.address);

    console.log("buyerStartBalance1", buyerStartBalance1);
    console.log("buyerStartBalance2", buyerStartBalance2);
    console.log("buyerStartBalance3", buyerStartBalance3);

    const transferProxyBalanceEnd = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyBalanceEnd)).toBe(
      parseInt(transferProxyBalanceStart) - parseInt(amount)
    );
  });

  test("End: Seller ends Auction when not expired: throws NotExpiredError", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    const transferProxyStartBalance = await getBalance(_transferProxyContract);
    let tokenId = String(1);
    let amount = String(100000000000000);

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount,
      false,
      false
    );

    console.log("End: Seller ends Auction", bidTx.receipt);
    expect(bidTx.receipt.success).toEqual(true);

    const transferProxyEndBalance = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance)).toBe(
      parseInt(transferProxyStartBalance) + parseInt(amount)
    );

    const __englishAuctionState = zilliqa.contracts.at(_englishAuctionState);
    const auctionState = await __englishAuctionState.getState();

    expect(JSON.stringify(auctionState.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount,
        },
      })
    );

    const endTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "End",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );

    console.log("End: Seller ends Auction", endTx.receipt);
    expect(endTx.receipt.success).toEqual(false);
    expect(endTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "NotExpiredError"))])',
      },
      { line: 1, message: "Raised from End" },
    ]);
  });

  test("End: Stranger ends Auction: throws NotAllowedToEndError", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    const transferProxyStartBalance = await getBalance(_transferProxyContract);
    let tokenId = String(1);
    let amount = String(100000000000000);

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount,
      false,
      false
    );

    console.log("End: Stranger ends Auction: 1", bidTx.receipt);
    expect(bidTx.receipt.success).toEqual(true);

    const transferProxyEndBalance = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance)).toBe(
      parseInt(transferProxyStartBalance) + parseInt(amount)
    );

    const englishAuctionState1 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState1 = await englishAuctionState1.getState();

    expect(JSON.stringify(auctionState1.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount,
        },
      })
    );

    await zilliqa.provider.send("IncreaseBlocknum", 1000);

    const endTx = await callContract(
      accounts.stranger.privateKey,
      englishAuctionContract,
      "End",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );

    console.log("End: Stranger ends Auction: 2", endTx.receipt);
    expect(endTx.receipt.success).toEqual(false);
    expect(endTx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (source : (String "logic")) ; (code : (String "NotAllowedToEndError"))])',
      },
      { line: 1, message: "Raised from RequireExpired" },
      { line: 1, message: "Raised from End" },
    ]);
  });

  test("End: Seller ends Auction when expired (not Collection Item)", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    const transferProxyStartBalance = await getBalance(_transferProxyContract);
    let tokenId = String(1);
    let amount = String(100000000000000);

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount,
      false,
      false
    );

    console.log("End: Seller ends Auction", bidTx.receipt);
    expect(bidTx.receipt.success).toEqual(true);

    const transferProxyEndBalance = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance)).toBe(
      parseInt(transferProxyStartBalance) + parseInt(amount)
    );

    const englishAuctionState1 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState1 = await englishAuctionState1.getState();

    expect(JSON.stringify(auctionState1.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [1]: amount,
        },
      })
    );

    await zilliqa.provider.send("IncreaseBlocknum", 1000);

    const endTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "End",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );

    console.log("End: Seller ends Auction", endTx.receipt);
    expect(endTx.receipt.success).toEqual(true);

    const englishAuctionState2 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState2 = await englishAuctionState2.getState();

    // console.log(JSON.stringify(auctionState2));

    expect(JSON.stringify(auctionState2.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.sell_order_expired_block)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.sell_order_payment_token)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.sell_order_start_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.assets)).toBe(
      JSON.stringify({
        [accounts.nftBuyer.address.toLowerCase()]: {
          [nftTokenAddress.toLowerCase()]: {
            [tokenId]: { argtypes: [], arguments: [], constructor: "True" },
          },
        },
      })
    );

    let service_fee_recipient = auctionState2.service_fee_recipient;
    let service_fee_bps = auctionState2.service_fee_bps;
    let service_fee_recipient_fee = new BN(amount)
      .mul(new BN(service_fee_bps))
      .div(new BN(10000));
    let seller_share = new BN(amount).sub(new BN(service_fee_recipient_fee));

    expect(JSON.stringify(auctionState2.payment_tokens)).toBe(
      JSON.stringify({
        [accounts.nftSeller.address.toLowerCase()]: {
          [zero_address]: seller_share.toString(),
        },
        [service_fee_recipient.toLowerCase()]: {
          [zero_address]: service_fee_recipient_fee.toString(),
        },
      })
    );
  });

  test("End: Seller ends Auction when expired (Collection Item)", async () => {
    const collectionContract = zilliqa.contracts.at(collectionContractAddress)
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
    const transferProxyStartBalance = await getBalance(_transferProxyContract);

    let tokenId = String(2);
    let amount = String(100000000000000);

    const cancelTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Cancel",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: "1",
        },
      ],
      0,
      false,
      false
    );
    console.log("End: Cancel Sell for TokenId: 1", cancelTx.receipt);
    expect(cancelTx.receipt.success).toEqual(true);

    let globalBNum = await getBlockNumber(zilliqa);
    let expiration_block_number = String(globalBNum + 100);

    let commission_fee = "129";

    const createCollectionTx = await callContract(
      accounts.address01.privateKey,
      collectionContract,
      'CreateCollection',
      [
        {
          vname: "commission_fee",
          type: "Uint128",
          value: commission_fee
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

    await addTokenToCollection(
      collectionContract,
      accounts.nftSeller.privateKey,
      accounts.address01.privateKey,
      collectionItem
    )

    const orderParam = await createOrderParam(
      englishAuctionAddress,
      nftTokenAddress,
      tokenId,
      zero_address,
      amount,
      expiration_block_number
    );

    const startTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "Start",
      [
        {
          vname: "order",
          type: `${englishAuctionContract.address}.OrderParam`,
          value: orderParam,
        },
      ],
      0,
      false,
      false
    );
    expect(startTx.receipt.success).toEqual(true);

    const bidTx = await callContract(
      accounts.nftBuyer.privateKey,
      englishAuctionContract,
      "Bid",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
        {
          vname: "amount",
          type: "Uint128",
          value: amount,
        },
        {
          vname: "dest",
          type: "ByStr20",
          value: accounts.nftBuyer.address,
        },
      ],
      amount,
      false,
      false
    );

    console.log("End: Seller ends Auction", bidTx.receipt);
    expect(bidTx.receipt.success).toEqual(true);

    const transferProxyEndBalance = await getBalance(_transferProxyContract);
    expect(parseInt(transferProxyEndBalance)).toBe(
      parseInt(transferProxyStartBalance) + parseInt(amount)
    );

    const englishAuctionState1 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState1 = await englishAuctionState1.getState();

    expect(JSON.stringify(auctionState1.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [tokenId]: "1",
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [tokenId]: {
            [accounts.nftBuyer.address.toLowerCase()]:
              accounts.nftBuyer.address.toLowerCase(),
          },
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [tokenId]: accounts.nftBuyer.address.toLowerCase(),
        },
      })
    );

    expect(JSON.stringify(auctionState1.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {
          [tokenId]: amount,
        },
      })
    );

    await zilliqa.provider.send("IncreaseBlocknum", 1000);
    const address01BalanceBefore = await getBalance(accounts.address01.address);

    const endTx = await callContract(
      accounts.nftSeller.privateKey,
      englishAuctionContract,
      "End",
      [
        {
          vname: "token_address",
          type: "ByStr20",
          value: nftTokenAddress,
        },
        {
          vname: "token_id",
          type: "Uint256",
          value: tokenId,
        },
      ],
      0,
      false,
      false
    );

    console.log("End: Seller ends Auction", endTx.receipt);
    expect(endTx.receipt.success).toEqual(true);

    const englishAuctionState2 = zilliqa.contracts.at(_englishAuctionState);
    const auctionState2 = await englishAuctionState2.getState();

    // console.log(JSON.stringify(auctionState2));

    expect(JSON.stringify(auctionState2.buy_orders_beneficiary)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_count)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_current_bidder)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.buy_orders_current_bid_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.sell_order_expired_block)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.sell_order_payment_token)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.sell_order_start_amount)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.sell_orders)).toBe(
      JSON.stringify({
        [nftTokenAddress.toLowerCase()]: {},
      })
    );

    expect(JSON.stringify(auctionState2.assets)).toBe(
      JSON.stringify({
        [accounts.nftBuyer.address.toLowerCase()]: {
          [nftTokenAddress.toLowerCase()]: {
            [tokenId]: { argtypes: [], arguments: [], constructor: "True" },
          },
        },
        [accounts.nftSeller.address.toLowerCase()]: {
          [nftTokenAddress.toLowerCase()]: {
            [String(1)]: { argtypes: [], arguments: [], constructor: "True" },
          },
        },
      })
    );
    
    let commission_fee_paid = new BN(amount).mul(new BN(commission_fee)).div(new BN(10000));
    // let service_fee_recipient = auctionState2.service_fee_recipient;
    let service_fee_bps = auctionState2.service_fee_bps;
    let service_fee_recipient_fee = new BN(amount).mul(new BN(service_fee_bps)).div(new BN(10000));
    let seller_share = new BN(amount).sub(new BN(service_fee_recipient_fee)).sub(new BN(commission_fee_paid));

    expect(JSON.stringify(auctionState2.payment_tokens)).toBe(
      JSON.stringify({
        [accounts.address01.address.toLowerCase()]: {
          [zero_address]: commission_fee_paid.toString(),
        },
        [accounts.nftSeller.address.toLowerCase()]: {
          [zero_address]: seller_share.toString(),
        },
        [accounts.contractOwner.address.toLowerCase()]: {
          [zero_address]: service_fee_recipient_fee.toString(),
        },
      })
    );

    let total_from_state = new BN(commission_fee_paid).add(new BN(seller_share)).add(new BN(service_fee_recipient_fee));

    expect(total_from_state.toString()).toEqual(amount.toString());
  });
});
