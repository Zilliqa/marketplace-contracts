import { Zilliqa } from "@zilliqa-js/zilliqa";
import { expect } from "@jest/globals";
import fs from "fs";
import { getAddressFromPrivateKey, schnorr } from "@zilliqa-js/crypto";

import {
  getBNum,
  getUsrDefADTValue,
  increaseBNum,
  getErrorMsg,
  useContractInfo,
  verifyEvents,
  verifyTransitions,
  getContractInfo,
} from "./testutil";

import {
  CONTAINER,
  API,
  TX_PARAMS,
  CONTRACTS,
  FAUCET_PARAMS,
  asyncNoop,
  ZERO_ADDRESS,
  FIXED_PRICE_ERROR,
} from "./config";

import { BN } from "@zilliqa-js/util";

const JEST_WORKER_ID = Number(process.env["JEST_WORKER_ID"]);
const GENESIS_PRIVATE_KEY = global.GENESIS_PRIVATE_KEYS[JEST_WORKER_ID - 1];

const zilliqa = new Zilliqa(API);
zilliqa.wallet.addByPrivateKey(GENESIS_PRIVATE_KEY);

let globalBNum;

let globalZRC6ContractInfo;
let globalZRC6ContractAddress;

let globalZRC6MarketplaceContractInfo;
let globalZRC6MarketplaceContractAddress;

let globalTestAccounts: Array<{
  privateKey: string;
  address: string;
}> = [];
const SELLER = 0;
const BUYER = 1;
const MARKETPLACE_CONTRACT_OWNER = 2;
const STRANGER = 3;
const getTestAddr = (index) => globalTestAccounts[index]?.address as string;

beforeAll(async () => {
  const accounts = Array.from({ length: 5 }, schnorr.generatePrivateKey).map(
    (privateKey) => ({
      privateKey,
      address: getAddressFromPrivateKey(privateKey),
    })
  );

  for (const { privateKey, address } of accounts) {
    zilliqa.wallet.addByPrivateKey(privateKey);
    const tx = await zilliqa.blockchain.createTransaction(
      zilliqa.transactions.new(
        {
          ...FAUCET_PARAMS,
          toAddr: address,
        },
        false
      )
    );
    if (!tx.getReceipt()?.success) {
      throw new Error();
    }
  }
  globalTestAccounts = accounts;

  console.table({
    GENESIS_PRIVATE_KEY,
    SELLER: getTestAddr(SELLER),
    BUYER: getTestAddr(BUYER),
    MARKETPLACE_CONTRACT_OWNER: getTestAddr(MARKETPLACE_CONTRACT_OWNER),
    STRANGER: getTestAddr(STRANGER),
  });

  const asyncFns = await [CONTRACTS.zrc6.path, CONTRACTS.fixed_price.path].map(
    async (path) =>
      useContractInfo(await getContractInfo(path, { container: CONTAINER }))
  );

  [globalZRC6ContractInfo, globalZRC6MarketplaceContractInfo] =
    await Promise.all(asyncFns);
});

beforeEach(async () => {
  globalBNum = await getBNum(zilliqa);

  // SELLER is the zrc6 contract owner
  zilliqa.wallet.setDefault(getTestAddr(SELLER));
  let init = globalZRC6ContractInfo.getInitParams(
    getTestAddr(SELLER),
    CONTRACTS.zrc6.baseURI,
    CONTRACTS.zrc6.name,
    CONTRACTS.zrc6.symbol
  );
  let [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.zrc6.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalZRC6ContractAddress = contract.address;

  if (globalZRC6ContractAddress === undefined) {
    throw new Error();
  }

  // SELLER mints 3 tokens for self
  let tx = await globalZRC6ContractInfo.callGetter(
    zilliqa.contracts.at(globalZRC6ContractAddress),
    TX_PARAMS
  )(
    "BatchMint",
    Array.from({ length: CONTRACTS.zrc6.initial_total_supply }, () =>
      getTestAddr(SELLER)
    )
  );
  if (!tx.receipt.success) {
    throw new Error();
  }

  // MARKETPLACE_CONTRACT_OWNER is the zrc6 marketplace contract owner
  zilliqa.wallet.setDefault(getTestAddr(MARKETPLACE_CONTRACT_OWNER));
  init = globalZRC6MarketplaceContractInfo.getInitParams(
    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
    ZERO_ADDRESS
  );
  [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.fixed_price.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalZRC6MarketplaceContractAddress = contract.address;

  if (globalZRC6MarketplaceContractAddress === undefined) {
    throw new Error();
  }

  // SELLER sets marketplace as spender for ZRC6
  zilliqa.wallet.setDefault(getTestAddr(SELLER));
  for (let i = 1; i <= CONTRACTS.zrc6.initial_total_supply; i++) {
    const tx = await globalZRC6ContractInfo.callGetter(
      zilliqa.contracts.at(globalZRC6ContractAddress),
      TX_PARAMS
    )("SetSpender", globalZRC6MarketplaceContractAddress, i.toString());
    if (!tx.receipt.success) {
      throw new Error();
    }
  }
});

describe("Fixed Price Listings and Offers", () => {
  beforeEach(async () => {
    // Add marketplace contract as spender for the tokens as SELLER
    zilliqa.wallet.setDefault(getTestAddr(SELLER));

    let tx = await globalZRC6MarketplaceContractInfo.callGetter(
      zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
      TX_PARAMS
    )(
      "CreateOrder",
      globalZRC6ContractAddress,
      "1",
      ZERO_ADDRESS,
      "10000",
      "0",
      (globalBNum + 5).toString()
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER));
    tx = await globalZRC6MarketplaceContractInfo.callGetter(
      zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
      { ...TX_PARAMS, amount: new BN(10000) }
    )(
      "CreateOrder",
      globalZRC6ContractAddress,
      "1",
      ZERO_ADDRESS,
      "0",
      "1",
      (globalBNum + 5).toString()
    );

    if (!tx.receipt.success) {
      throw new Error();
    }
  });

  const testCases = [
    {
      name: "Seller creates sell order for token #1",
      transition: "CreateOrder",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: ZERO_ADDRESS,
        sale_price: 20000,
        side: 0, // 0 is sell, 1 is buy,
        expiration_bnum: globalBNum + 5,
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "CreateOrder",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER).toLowerCase(), "maker"],
              ["Uint32", 0, "side"],
              ["ByStr20", globalZRC6ContractAddress, "token_address"],
              ["Uint256", 1, "token_id"],
              ["ByStr20", ZERO_ADDRESS, "payment_token_address"],
              ["Uint128", 20000, "sale_price"],
              ["BNum", (globalBNum + 5).toString(), "expiration_bnum"],
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.sell_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${ZERO_ADDRESS}":{"10000":${getUsrDefADTValue(
              globalZRC6MarketplaceContractAddress,
              "Order",
              [getTestAddr(SELLER).toLowerCase(), (globalBNum + 5).toString()]
            )},"20000":${getUsrDefADTValue(
              globalZRC6MarketplaceContractAddress,
              "Order",
              [getTestAddr(SELLER).toLowerCase(), (globalBNum + 5).toString()]
            )}}}}}`
          );
        },
      },
    },
    {
      name: "Buyer creates buy order for token #1",
      transition: "CreateOrder",
      txAmount: 20000,
      getSender: () => getTestAddr(BUYER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: ZERO_ADDRESS,
        sale_price: 0,
        side: 1,
        expiration_bnum: globalBNum + 5,
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "CreateOrder",
            getParams: () => [
              ["ByStr20", getTestAddr(BUYER).toLowerCase(), "maker"],
              ["Uint32", 1, "side"],
              ["ByStr20", globalZRC6ContractAddress, "token_address"],
              ["Uint256", 1, "token_id"],
              ["ByStr20", ZERO_ADDRESS, "payment_token_address"],
              ["Uint128", 20000, "sale_price"],
              ["BNum", (globalBNum + 5).toString(), "expiration_bnum"],
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.buy_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${ZERO_ADDRESS}":{"10000":${getUsrDefADTValue(
              globalZRC6MarketplaceContractAddress,
              "Order",
              [getTestAddr(BUYER).toLowerCase(), (globalBNum + 5).toString()]
            )},"20000":${getUsrDefADTValue(
              globalZRC6MarketplaceContractAddress,
              "Order",
              [getTestAddr(BUYER).toLowerCase(), (globalBNum + 5).toString()]
            )}}}}}`
          );
        },
      },
    },

    {
      name: "throws ExpiredError",
      transition: "FulfillOrder",
      getSender: () => getTestAddr(BUYER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: ZERO_ADDRESS,
        sale_price: 10000,
        side: 0,
        dest: getTestAddr(BUYER),
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: FIXED_PRICE_ERROR.ExpiredError,
      want: undefined,
    },
    {
      name: "Buyer fullfills sell order",
      transition: "FulfillOrder",
      getSender: () => getTestAddr(BUYER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: ZERO_ADDRESS,
        sale_price: 10000,
        side: 0,
        dest: getTestAddr(BUYER),
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "FulfillOrder",
            getParams: () => [
              ["ByStr20", getTestAddr(BUYER), "taker"],
              ["Uint32", 0, "side"],
              ["ByStr20", globalZRC6ContractAddress, "token_address"],
              ["Uint256", 1, "token_id"],
              ["ByStr20", ZERO_ADDRESS, "payment_token_address"],
              ["Uint128", 10000, "sale_price"],
              ["ByStr20", getTestAddr(SELLER), "seller"],
              ["ByStr20", getTestAddr(BUYER), "buyer"],
              ["ByStr20", getTestAddr(BUYER), "asset_recipient"],
              ["ByStr20", getTestAddr(SELLER), "payment_tokens_recipient"],
              ["ByStr20", getTestAddr(SELLER), "royalty_recipient"],
              ["Uint128", 1000, "royalty_amount"],
              ["Uint128", 250, "service_fee"],
            ],
          },
          // NFT transfer
          {
            name: "TransferFrom",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER), "from"],
              ["ByStr20", getTestAddr(BUYER), "to"],
              ["Uint256", 1, "token_id"],
            ],
          },
        ],
        transitions: [
          {
            amount: 1000,
            recipient: getTestAddr(SELLER),
            tag: "TransferNativeZIL",
            getParams: () => [],
          },
          {
            amount: 250,
            recipient: getTestAddr(MARKETPLACE_CONTRACT_OWNER),
            tag: "TransferNativeZIL",
            getParams: () => [],
          },
          {
            amount: 8750,
            recipient: getTestAddr(SELLER),
            tag: "TransferNativeZIL",
            getParams: () => [],
          },
          // NFT transfer
          {
            tag: "TransferFrom",
            getParams: () => [
              ["ByStr20", getTestAddr(BUYER), "to"],
              ["Uint256", 1, "token_id"],
            ],
          },
          {
            tag: "ZRC6_RecipientAcceptTransferFrom",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER), "from"],
              ["ByStr20", getTestAddr(BUYER), "to"],
              ["Uint256", 1, "token_id"],
            ],
          },
          {
            tag: "ZRC6_TransferFromCallback",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER), "from"],
              ["ByStr20", getTestAddr(BUYER), "to"],
              ["Uint256", 1, "token_id"],
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.sell_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{}}`
          );
        },
      },
    },
    {
      name: "Seller fullfills buy order",
      transition: "FulfillOrder",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: ZERO_ADDRESS,
        sale_price: 10000,
        side: 1,
        dest: getTestAddr(SELLER),
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "FulfillOrder",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER), "taker"],
              ["Uint32", 1, "side"],
              ["ByStr20", globalZRC6ContractAddress, "token_address"],
              ["Uint256", 1, "token_id"],
              ["ByStr20", ZERO_ADDRESS, "payment_token_address"],
              ["Uint128", 10000, "sale_price"],
              ["ByStr20", getTestAddr(SELLER), "seller"],
              ["ByStr20", getTestAddr(BUYER), "buyer"],
              ["ByStr20", getTestAddr(BUYER), "asset_recipient"],
              ["ByStr20", getTestAddr(SELLER), "payment_tokens_recipient"],
              ["ByStr20", getTestAddr(SELLER), "royalty_recipient"],
              ["Uint128", 1000, "royalty_amount"],
              ["Uint128", 250, "service_fee"],
            ],
          },

          // NFT transfer
          {
            name: "TransferFrom",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER), "from"],
              ["ByStr20", getTestAddr(BUYER), "to"],
              ["Uint256", 1, "token_id"],
            ],
          },
        ],
        transitions: [
          {
            amount: 1000,
            recipient: getTestAddr(SELLER),
            tag: "TransferNativeZIL",
            getParams: () => [],
          },
          {
            amount: 250,
            recipient: getTestAddr(MARKETPLACE_CONTRACT_OWNER),
            tag: "TransferNativeZIL",
            getParams: () => [],
          },
          {
            amount: 8750,
            recipient: getTestAddr(SELLER),
            tag: "TransferNativeZIL",
            getParams: () => [],
          },
          // NFT transfer
          {
            tag: "TransferFrom",
            getParams: () => [
              ["ByStr20", getTestAddr(BUYER), "to"],
              ["Uint256", 1, "token_id"],
            ],
          },
          {
            tag: "ZRC6_RecipientAcceptTransferFrom",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER), "from"],
              ["ByStr20", getTestAddr(BUYER), "to"],
              ["Uint256", 1, "token_id"],
            ],
          },
          {
            tag: "ZRC6_TransferFromCallback",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER), "from"],
              ["ByStr20", getTestAddr(BUYER), "to"],
              ["Uint256", 1, "token_id"],
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.buy_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${ZERO_ADDRESS}":{}}}}`
          );
        },
      },
    },
    {
      name: "Buyer cancels buy order",
      transition: "CancelOrder",
      getSender: () => getTestAddr(BUYER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: ZERO_ADDRESS,
        sale_price: 10000,
        side: 1,
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "CancelOrder",
            getParams: () => [
              ["ByStr20", getTestAddr(BUYER).toLowerCase(), "maker"],
              ["Uint32", 1, "side"],
              ["ByStr20", globalZRC6ContractAddress, "token_address"],
              ["Uint256", 1, "token_id"],
              ["ByStr20", ZERO_ADDRESS, "payment_token_address"],
              ["Uint128", 10000, "sale_price"],
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.buy_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${ZERO_ADDRESS}":{}}}}`
          );
        },
      },
    },
    {
      name: "Seller cancels sell order",
      transition: "CancelOrder",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: ZERO_ADDRESS,
        sale_price: 10000,
        side: 0,
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "CancelOrder",
            getParams: () => [
              ["ByStr20", getTestAddr(SELLER).toLowerCase(), "maker"],
              ["Uint32", 0, "side"],
              ["ByStr20", globalZRC6ContractAddress, "token_address"],
              ["Uint256", 1, "token_id"],
              ["ByStr20", ZERO_ADDRESS, "payment_token_address"],
              ["Uint128", 10000, "sale_price"],
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.sell_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${ZERO_ADDRESS}":{}}}}`
          );
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      await testCase.beforeTransition();

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx = await globalZRC6MarketplaceContractInfo.callGetter(
        zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
        {
          ...TX_PARAMS,
          amount: new BN(testCase.txAmount || 0),
        }
      )(testCase.transition, ...Object.values(testCase.getParams()));

      if (testCase.want === undefined) {
        // Nagative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expect(verifyEvents(tx.receipt.event_logs, testCase.want.events)).toBe(
          true
        );
        testCase.want.transitions &&
          expect(
            verifyTransitions(tx.receipt.transitions, testCase.want.transitions)
          ).toBe(true);

        const state = await zilliqa.contracts
          .at(globalZRC6MarketplaceContractAddress)
          .getState();

        expect(testCase.want.verifyState(state)).toBe(true);
      }
    });
  }
});
