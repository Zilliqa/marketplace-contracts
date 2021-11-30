import { Zilliqa } from "@zilliqa-js/zilliqa";
import { expect } from "@jest/globals";
import fs from "fs";
import { getAddressFromPrivateKey, schnorr } from "@zilliqa-js/crypto";

import {
  getBNum,
  getUsrDefADTValue,
  increaseBNum,
} from "./testutil-experimental";

import {
  getErrorMsg,
  getJSONParam,
  useContractInfo,
  verifyEvents,
} from "./testutil";

import {
  CONTAINER,
  API,
  TX_PARAMS,
  CONTRACTS,
  GAS_LIMIT,
  FAUCET_PARAMS,
  FIXED_PRICE_ERROR,
  asyncNoop,
} from "./config";

const JEST_WORKER_ID = Number(process.env["JEST_WORKER_ID"]);
const GENESIS_PRIVATE_KEY = global.GENESIS_PRIVATE_KEYS[JEST_WORKER_ID - 1];

const zilliqa = new Zilliqa(API);
zilliqa.wallet.addByPrivateKey(GENESIS_PRIVATE_KEY);

let globalBNum;

let globalZRC6ContractInfo;
let globalZRC6ContractAddress;

let globalZRC2ContractInfo;
let globalZRC2ContractAddress;

let globalZRC6MarketplaceContractInfo;
let globalZRC6MarketplaceContractAddress;

let globalNotAllowedZRC2ContractAddress;

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

  const asyncFns = [
    CONTRACTS.zrc6.path,
    CONTRACTS.wzil.path,
    CONTRACTS.fixed_price.path,
  ].map((path) => useContractInfo(CONTAINER, path, GAS_LIMIT));

  [
    globalZRC6ContractInfo,
    globalZRC2ContractInfo,
    globalZRC6MarketplaceContractInfo,
  ] = await Promise.all(asyncFns);

  zilliqa.wallet.setDefault(getTestAddr(STRANGER));
  let init = globalZRC2ContractInfo.getInitParams(
    getTestAddr(STRANGER),
    CONTRACTS.wzil.name,
    CONTRACTS.wzil.symbol,
    CONTRACTS.wzil.decimal,
    CONTRACTS.wzil.initial_supply
  );
  const [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.wzil.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalNotAllowedZRC2ContractAddress = contract.address;
});

beforeEach(async () => {
  globalBNum = Number(await getBNum(zilliqa));

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

  // BUYER is the WZIL contract owner
  zilliqa.wallet.setDefault(getTestAddr(BUYER));
  init = globalZRC2ContractInfo.getInitParams(
    getTestAddr(BUYER),
    CONTRACTS.wzil.name,
    CONTRACTS.wzil.symbol,
    CONTRACTS.wzil.decimal,
    // Mint wZIL for the BUYER with initial supply
    CONTRACTS.wzil.initial_supply
  );
  [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.wzil.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalZRC2ContractAddress = contract.address;

  if (globalZRC2ContractAddress === undefined) {
    throw new Error();
  }

  // MARKETPLACE_CONTRACT_OWNER is the zrc6 marketplace contract owner
  zilliqa.wallet.setDefault(getTestAddr(MARKETPLACE_CONTRACT_OWNER));
  init = globalZRC6MarketplaceContractInfo.getInitParams(
    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
    globalZRC2ContractAddress // WZIL
  );
  [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.fixed_price.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalZRC6MarketplaceContractAddress = contract.address;

  if (globalZRC6MarketplaceContractAddress === undefined) {
    throw new Error();
  }

  // BUYER sets marketplace as spender for ZRC2
  zilliqa.wallet.setDefault(getTestAddr(BUYER));
  tx = await globalZRC2ContractInfo.callGetter(
    zilliqa.contracts.at(globalZRC2ContractAddress),
    TX_PARAMS
  )("IncreaseAllowance", globalZRC6MarketplaceContractAddress, "100000");

  if (!tx.receipt.success) {
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
      globalZRC2ContractAddress,
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
      TX_PARAMS
    )(
      "CreateOrder",
      globalZRC6ContractAddress,
      "1",
      globalZRC2ContractAddress,
      "10000",
      "1",
      (globalBNum + 5).toString()
    );

    if (!tx.receipt.success) {
      throw new Error();
    }
  });

  const testCases = [
    {
      name: "throws NotAllowedPaymentToken",
      transition: "CreateOrder",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        zrc6_contract: globalZRC6ContractAddress,
        token_id: 1,
        zrc2_contract: globalNotAllowedZRC2ContractAddress,
        sale_price: 20000,
        side: 0, // 0 is sell, 1 is buy,
        expiration_bnum: globalBNum + 5,
      }),
      beforeTransition: asyncNoop,
      error: FIXED_PRICE_ERROR.NotAllowedPaymentToken,
      want: undefined,
    },
    {
      name: "Seller creates sell order for token #1",
      transition: "CreateOrder",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        zrc6_contract: globalZRC6ContractAddress,
        token_id: 1,
        zrc2_contract: globalZRC2ContractAddress,
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
              getJSONParam(
                "ByStr20",
                getTestAddr(SELLER).toLowerCase(),
                "maker"
              ),
              getJSONParam("Uint32", "0", "side"),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "zrc6_contract"
              ),
              getJSONParam("Uint256", "1", "token_id"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "zrc2_contract"
              ),
              getJSONParam("Uint128", "20000", "sale_price"),
              getJSONParam(
                "BNum",
                (globalBNum + 5).toString(),
                "expiration_bnum"
              ),
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.sell_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${globalZRC2ContractAddress.toLowerCase()}":{"10000":${getUsrDefADTValue(
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
      getSender: () => getTestAddr(BUYER),
      getParams: () => ({
        zrc6_contract: globalZRC6ContractAddress,
        token_id: 1,
        zrc2_contract: globalZRC2ContractAddress,
        sale_price: 20000,
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
              getJSONParam(
                "ByStr20",
                getTestAddr(BUYER).toLowerCase(),
                "maker"
              ),
              getJSONParam("Uint32", "1", "side"),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "zrc6_contract"
              ),
              getJSONParam("Uint256", "1", "token_id"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "zrc2_contract"
              ),
              getJSONParam("Uint128", "20000", "sale_price"),
              getJSONParam(
                "BNum",
                (globalBNum + 5).toString(),
                "expiration_bnum"
              ),
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.buy_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${globalZRC2ContractAddress.toLowerCase()}":{"10000":${getUsrDefADTValue(
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
        zrc6_contract: globalZRC6ContractAddress,
        token_id: 1,
        zrc2_contract: globalZRC2ContractAddress,
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
        zrc6_contract: globalZRC6ContractAddress,
        token_id: 1,
        zrc2_contract: globalZRC2ContractAddress,
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
              getJSONParam("ByStr20", getTestAddr(BUYER), "taker"),
              getJSONParam("Uint32", "0", "side"),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "zrc6_contract"
              ),
              getJSONParam("Uint256", "1", "token_id"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "zrc2_contract"
              ),
              getJSONParam("Uint128", "10000", "sale_price"),
              getJSONParam("ByStr20", getTestAddr(SELLER), "seller"),
              getJSONParam("ByStr20", getTestAddr(BUYER), "buyer"),
              getJSONParam("ByStr20", getTestAddr(BUYER), "asset_recipient"),
              getJSONParam(
                "ByStr20",
                getTestAddr(SELLER),
                "payment_tokens_recipient"
              ),
              getJSONParam("ByStr20", getTestAddr(SELLER), "royalty_recipient"),
              getJSONParam("Uint128", 1000, "royalty_amount"),
              getJSONParam("Uint128", 250, "service_fee"),
            ],
          },

          // royalty fee
          {
            name: "TransferFromSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress,
                "initiator"
              ),
              getJSONParam("ByStr20", getTestAddr(BUYER), "sender"),
              getJSONParam("ByStr20", getTestAddr(SELLER), "recipient"), // SELLER is the ZRC6 contract owner
              getJSONParam("Uint128", "1000", "amount"),
            ],
          },

          // service fee
          {
            name: "TransferFromSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress,
                "initiator"
              ),
              getJSONParam("ByStr20", getTestAddr(BUYER), "sender"),
              getJSONParam(
                "ByStr20",
                getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                "recipient"
              ),
              getJSONParam("Uint128", "250", "amount"),
            ],
          },

          // seller profit
          {
            name: "TransferFromSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress,
                "initiator"
              ),
              getJSONParam("ByStr20", getTestAddr(BUYER), "sender"),
              getJSONParam("ByStr20", getTestAddr(SELLER), "recipient"), // SELLER is the token owner
              getJSONParam("Uint128", "8750", "amount"),
            ],
          },

          // NFT transfer
          {
            name: "TransferFrom",
            getParams: () => [
              getJSONParam("ByStr20", getTestAddr(SELLER), "from"),
              getJSONParam("ByStr20", getTestAddr(BUYER), "to"),
              getJSONParam("Uint256", "1", "token_id"),
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
        zrc6_contract: globalZRC6ContractAddress,
        token_id: 1,
        zrc2_contract: globalZRC2ContractAddress,
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
              getJSONParam("ByStr20", getTestAddr(SELLER), "taker"),
              getJSONParam("Uint32", "1", "side"),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "zrc6_contract"
              ),
              getJSONParam("Uint256", "1", "token_id"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "zrc2_contract"
              ),
              getJSONParam("Uint128", "10000", "sale_price"),
              getJSONParam("ByStr20", getTestAddr(SELLER), "seller"),
              getJSONParam("ByStr20", getTestAddr(BUYER), "buyer"),
              getJSONParam("ByStr20", getTestAddr(BUYER), "asset_recipient"),
              getJSONParam(
                "ByStr20",
                getTestAddr(SELLER),
                "payment_tokens_recipient"
              ),
              getJSONParam("ByStr20", getTestAddr(SELLER), "royalty_recipient"),
              getJSONParam("Uint128", 1000, "royalty_amount"),
              getJSONParam("Uint128", 250, "service_fee"),
            ],
          },

          // royalty fee
          {
            name: "TransferFromSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress,
                "initiator"
              ),
              getJSONParam("ByStr20", getTestAddr(BUYER), "sender"),
              getJSONParam("ByStr20", getTestAddr(SELLER), "recipient"), // SELLER is the ZRC6 contract owner
              getJSONParam("Uint128", "1000", "amount"),
            ],
          },

          // service fee
          {
            name: "TransferFromSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress,
                "initiator"
              ),
              getJSONParam("ByStr20", getTestAddr(BUYER), "sender"),
              getJSONParam(
                "ByStr20",
                getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                "recipient"
              ),
              getJSONParam("Uint128", "250", "amount"),
            ],
          },

          // seller profit
          {
            name: "TransferFromSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress,
                "initiator"
              ),
              getJSONParam("ByStr20", getTestAddr(BUYER), "sender"),
              getJSONParam("ByStr20", getTestAddr(SELLER), "recipient"), // SELLER is the token owner
              getJSONParam("Uint128", "8750", "amount"),
            ],
          },

          // NFT transfer
          {
            name: "TransferFrom",
            getParams: () => [
              getJSONParam("ByStr20", getTestAddr(SELLER), "from"),
              getJSONParam("ByStr20", getTestAddr(BUYER), "to"),
              getJSONParam("Uint256", "1", "token_id"),
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.buy_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${globalZRC2ContractAddress.toLowerCase()}":{}}}}`
          );
        },
      },
    },
    {
      name: "Buyer cancels buy order",
      transition: "CancelOrder",
      getSender: () => getTestAddr(BUYER),
      getParams: () => ({
        zrc6_contract: globalZRC6ContractAddress,
        token_id: 1,
        zrc2_contract: globalZRC2ContractAddress,
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
              getJSONParam(
                "ByStr20",
                getTestAddr(BUYER).toLowerCase(),
                "maker"
              ),
              getJSONParam("Uint32", "1", "side"),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "zrc6_contract"
              ),
              getJSONParam("Uint256", "1", "token_id"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "zrc2_contract"
              ),
              getJSONParam("Uint128", "10000", "sale_price"),
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.buy_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${globalZRC2ContractAddress.toLowerCase()}":{}}}}`
          );
        },
      },
    },
    {
      name: "Seller cancels sell order",
      transition: "CancelOrder",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        zrc6_contract: globalZRC6ContractAddress,
        token_id: 1,
        zrc2_contract: globalZRC2ContractAddress,
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
              getJSONParam(
                "ByStr20",
                getTestAddr(SELLER).toLowerCase(),
                "maker"
              ),
              getJSONParam("Uint32", "0", "side"),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "zrc6_contract"
              ),
              getJSONParam("Uint256", "1", "token_id"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "zrc2_contract"
              ),
              getJSONParam("Uint128", "10000", "sale_price"),
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.sell_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":{"${globalZRC2ContractAddress.toLowerCase()}":{}}}}`
          );
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      // console.table({
      //   TEST_CASE: testCase.name,
      //   ZRC6: globalZRC6ContractAddress,
      //   WZIL: globalZRC2ContractAddress,
      //   MARKETPLACE: globalZRC6MarketplaceContractAddress,
      // });

      await testCase.beforeTransition();

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx = await globalZRC6MarketplaceContractInfo.callGetter(
        zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
        TX_PARAMS
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

        const state = await zilliqa.contracts
          .at(globalZRC6MarketplaceContractAddress)
          .getState();

        expect(testCase.want.verifyState(state)).toBe(true);
      }
    });
  }
});
