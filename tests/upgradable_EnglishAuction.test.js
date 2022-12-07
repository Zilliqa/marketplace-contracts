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
    privateKey: process.env.N_01_PRIVATE_KEY,
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

async function createPairADT(address, string) {
  return {
    constructor: "Pair",
    argtypes: ["ByStr20", "String"],
    arguments: [address, string],
  };
}

describe("Native ZIL", () => {
  beforeEach(async () => {
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

  test("Cancel: Cancel Sell order by Seller & withdraw assert", async () => {
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
      "Cancel: Cancel Sell order by Seller withdraw assert",
      withdrawTx.receipt
    );
    expect(withdrawTx.receipt.success).toEqual(true);
    const getOwnerOfNFT = await getZRC6TokenOwner(nftTokenAddress, tokenId);
    expect(getOwnerOfNFT).toEqual(accounts.nftSeller.address.toLowerCase());
  });

  // can withdraw assert without cancelling?

  test("Bid: Place a bid for Auction", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
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
    console.log("Bid: Place a bid for Auction", bidTx.receipt);
    expect(bidTx.receipt.success).toEqual(true);
  });

  // can withdraw payment without cancelling?

  test("Bid: WithdrawPaymentTokens", async () => {
    const englishAuctionContract = zilliqa.contracts.at(englishAuctionAddress);
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
    console.log("Bid: Place a bid for Auction", bidTx.receipt);
    expect(bidTx.receipt.success).toEqual(true);

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
    console.log("Bid: WithdrawPaymentTokens receipt", withdrawTx.receipt);
    console.log("Bid: WithdrawPaymentTokens", withdrawTx);
    expect(withdrawTx.receipt.success).toEqual(true);
  });
});
