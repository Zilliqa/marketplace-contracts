import { Zilliqa } from "@zilliqa-js/zilliqa";
import { expect } from "@jest/globals";
import fs from "fs";
import { getAddressFromPrivateKey, schnorr } from "@zilliqa-js/crypto";

import {
  getBNum,
  getUsrDefADTValue,
  increaseBNum,
  getErrorMsg,
  getJSONParam,
  useContractInfo,
  verifyEvents,
  getJSONValue,
} from "./testutil";

import {
  CONTAINER,
  API,
  TX_PARAMS,
  CONTRACTS,
  GAS_LIMIT,
  FAUCET_PARAMS,
  ENG_AUC_ERROR,
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
const BUYER_A = 1;
const BUYER_B = 2;
const MARKETPLACE_CONTRACT_OWNER = 3;
const STRANGER = 4;
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
    BUYER_A: getTestAddr(BUYER_A),
    BUYER_B: getTestAddr(BUYER_B),
    MARKETPLACE_CONTRACT_OWNER: getTestAddr(MARKETPLACE_CONTRACT_OWNER),
    STRANGER: getTestAddr(STRANGER),
  });

  const asyncFns = [
    CONTRACTS.zrc6.path,
    CONTRACTS.wzil.path,
    CONTRACTS.english_auction.path,
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

  // BUYER_A is the WZIL contract owner
  zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
  init = globalZRC2ContractInfo.getInitParams(
    getTestAddr(BUYER_A),
    CONTRACTS.wzil.name,
    CONTRACTS.wzil.symbol,
    CONTRACTS.wzil.decimal,
    // Mint wZIL for the BUYER_A with initial supply
    CONTRACTS.wzil.initial_supply
  );
  [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.wzil.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalZRC2ContractAddress = contract.address;

  if (globalZRC2ContractAddress === undefined) {
    throw new Error();
  }

  // BUYER_A transfers 100k WZIL to BUYER_B
  zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
  tx = await globalZRC2ContractInfo.callGetter(
    zilliqa.contracts.at(globalZRC2ContractAddress),
    TX_PARAMS
  )("Transfer", getTestAddr(BUYER_B), Number(100 * 1000).toString());

  if (!tx.receipt.success) {
    throw new Error();
  }

  // MARKETPLACE_CONTRACT_OWNER is the zrc6 marketplace contract owner
  zilliqa.wallet.setDefault(getTestAddr(MARKETPLACE_CONTRACT_OWNER));
  init = globalZRC6MarketplaceContractInfo.getInitParams(
    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
    globalZRC2ContractAddress // WZIL
  );
  [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.english_auction.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalZRC6MarketplaceContractAddress = contract.address;

  if (globalZRC6MarketplaceContractAddress === undefined) {
    throw new Error();
  }

  // BUYER_A sets marketplace as spender for ZRC2
  zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
  tx = await globalZRC2ContractInfo.callGetter(
    zilliqa.contracts.at(globalZRC2ContractAddress),
    TX_PARAMS
  )(
    "IncreaseAllowance",
    globalZRC6MarketplaceContractAddress,
    Number(100 * 1000).toString()
  );

  if (!tx.receipt.success) {
    throw new Error();
  }

  // BUYER_B sets marketplace as spender for ZRC2
  zilliqa.wallet.setDefault(getTestAddr(BUYER_B));
  tx = await globalZRC2ContractInfo.callGetter(
    zilliqa.contracts.at(globalZRC2ContractAddress),
    TX_PARAMS
  )(
    "IncreaseAllowance",
    globalZRC6MarketplaceContractAddress,
    Number(100 * 1000).toString()
  );

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

describe("Auction", () => {
  beforeEach(async () => {
    // Add marketplace contract as spender for the tokens as SELLER
    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    let tx = await globalZRC6MarketplaceContractInfo.callGetter(
      zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
      TX_PARAMS
    )(
      "Start",
      globalZRC6ContractAddress,
      "1",
      globalZRC2ContractAddress,
      "1000",
      (globalBNum + 5).toString()
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
    tx = await globalZRC6MarketplaceContractInfo.callGetter(
      zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
      TX_PARAMS
    )("Bid", globalZRC6ContractAddress, "1", "10000", getTestAddr(BUYER_A));

    if (!tx.receipt.success) {
      throw new Error();
    }
  });

  const testCases = [
    {
      name: "throws NotAllowedPaymentToken",
      transition: "Start",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: globalNotAllowedZRC2ContractAddress,
        start_amount: 1000,
        expiration_bnum: globalBNum + 5,
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotAllowedPaymentToken,
      want: undefined,
    },
    {
      name: "throws SellOrderFoundError",
      transition: "Start",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        payment_token_address: globalZRC2ContractAddress,
        start_amount: 1000,
        expiration_bnum: globalBNum + 5,
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.SellOrderFoundError,
      want: undefined,
    },
    {
      name: "Seller creates sell order for token #2",
      transition: "Start",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 2,
        payment_token_address: globalZRC2ContractAddress,
        start_amount: 1000,
        expiration_bnum: globalBNum + 5,
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "Start",
            getParams: () => [
              getJSONParam("ByStr20", getTestAddr(SELLER), "maker"),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "token_address"
              ),
              getJSONParam("Uint256", "2", "token_id"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "payment_token_address"
              ),
              getJSONParam("Uint128", "1000", "start_amount"),
              getJSONParam(
                "BNum",
                (globalBNum + 5).toString(),
                "expiration_bnum"
              ),
            ],
          },
          {
            name: "TransferFrom",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                getTestAddr(SELLER).toLowerCase(),
                "from"
              ),
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress.toLowerCase(),
                "to"
              ),
              getJSONParam("Uint256", "2", "token_id"),
            ],
          },
        ],
        verifyState: (state) => {
          return (
            JSON.stringify(state.sell_orders) ===
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":${getUsrDefADTValue(
              globalZRC6MarketplaceContractAddress,
              "SellOrder",
              [
                getTestAddr(SELLER).toLowerCase(),
                (globalBNum + 5).toString(),
                globalZRC2ContractAddress.toLowerCase(),
                "1000",
              ]
            )},"2":${getUsrDefADTValue(
              globalZRC6MarketplaceContractAddress,
              "SellOrder",
              [
                getTestAddr(SELLER).toLowerCase(),
                (globalBNum + 5).toString(),
                globalZRC2ContractAddress.toLowerCase(),
                "1000",
              ]
            )}}}`
          );
        },
      },
    },
    {
      name: "throws SellOrderNotFoundError",
      transition: "Bid",
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 999,
        amount: 1000,
        dest: getTestAddr(BUYER_B),
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.SellOrderNotFoundError,
      want: undefined,
    },
    {
      name: "throws InsufficientAllowanceError",
      transition: "Bid",
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        amount: Number(100 * 1000) + 1,
        dest: getTestAddr(BUYER_B),
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.InsufficientAllowanceError,
      want: undefined,
    },
    {
      name: "throws ExpiredError",
      transition: "Bid",
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        amount: 10000,
        dest: getTestAddr(BUYER_B),
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: ENG_AUC_ERROR.ExpiredError,
      want: undefined,
    },
    {
      name: "throws LessThanMinBidError",
      transition: "Bid",
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        amount: 10000 - 1,
        dest: getTestAddr(BUYER_B),
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.LessThanMinBidError,
      want: undefined,
    },
    {
      name: "BuyerB bids for token #1",
      transition: "Bid",
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
        amount: 11001,
        dest: getTestAddr(BUYER_B),
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "Bid",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                getTestAddr(BUYER_B).toLowerCase(),
                "maker"
              ),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "token_address"
              ),
              getJSONParam("Uint256", "1", "token_id"),
              getJSONParam("Uint128", "11001", "amount"),
              getJSONParam("ByStr20", getTestAddr(BUYER_B), "dest"),
            ],
          },
          {
            name: "TransferFromSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress.toLowerCase(),
                "initiator"
              ),
              getJSONParam(
                "ByStr20",
                getTestAddr(BUYER_B).toLowerCase(),
                "sender"
              ),
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress.toLowerCase(),
                "recipient"
              ),
              getJSONParam("Uint128", "11001", "amount"),
            ],
          },
        ],
        verifyState: (state) => {
          // Buyer A  can withdraw bid
          state.payment_tokens[getTestAddr(BUYER_A).toLowerCase()][
            globalZRC2ContractAddress.toLowerCase()
          ] !== "10000";

          if (
            JSON.stringify(state.buy_orders) !==
            `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":${getUsrDefADTValue(
              globalZRC6MarketplaceContractAddress,
              "BuyOrder",
              [
                getTestAddr(BUYER_B).toLowerCase(),
                "11001",
                getTestAddr(BUYER_B).toLowerCase(),
                "2",
              ]
            )}}}`
          ) {
            return false;
          }

          return true;
        },
      },
    },

    {
      name: "throws NotSelf",
      transition: "Cancel",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotSelfError,
      want: undefined,
    },
    {
      name: "throws SellOrderNotFoundError",
      transition: "Cancel",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 999,
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.SellOrderNotFoundError,
      want: undefined,
    },
    {
      name: "throws ExpiredError",
      transition: "Cancel",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: ENG_AUC_ERROR.ExpiredError,
      want: undefined,
    },
    {
      name: "Seller cancels a auction",
      transition: "Cancel",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "Cancel",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "token_address"
              ),
              getJSONParam("Uint256", "1", "token_id"),
            ],
          },
        ],
        verifyState: (state) => {
          if (
            JSON.stringify(
              state.sell_orders[globalZRC6ContractAddress.toLowerCase()]
            ) !== "{}" ||
            JSON.stringify(
              state.buy_orders[globalZRC6ContractAddress.toLowerCase()]
            ) !== "{}"
          ) {
            return false;
          }
          if (
            JSON.stringify(
              state.assets[getTestAddr(SELLER).toLowerCase()][
                globalZRC6ContractAddress.toLowerCase()
              ]["1"]
            ) !== JSON.stringify(getJSONValue(true))
          ) {
            return false;
          }
          if (
            state.payment_tokens[getTestAddr(BUYER_A).toLowerCase()][
              globalZRC2ContractAddress.toLowerCase()
            ] !== "10000"
          ) {
            return false;
          }

          return true;
        },
      },
    },

    {
      name: "throws SellOrderNotFoundError",
      transition: "End",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 999,
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: ENG_AUC_ERROR.SellOrderNotFoundError,
      want: undefined,
    },
    {
      name: "throws NotAllowedToEndError",
      transition: "End",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: ENG_AUC_ERROR.NotAllowedToEndError,
      want: undefined,
    },
    {
      name: "throws NotExpiredError",
      transition: "End",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotExpiredError,
      want: undefined,
    },
    {
      name: "Seller finalizes the auction",
      transition: "End",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        events: [
          {
            name: "End",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "token_address"
              ),
              getJSONParam("Uint256", "1", "token_id"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "payment_token_address"
              ),
              getJSONParam("Uint128", "10000", "sale_price"),
              getJSONParam("ByStr20", getTestAddr(SELLER), "seller"),
              getJSONParam("ByStr20", getTestAddr(BUYER_A), "buyer"),
              getJSONParam("ByStr20", getTestAddr(BUYER_A), "asset_recipient"),
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
            name: "TransferSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress.toLowerCase(),
                "sender"
              ),
              getJSONParam("ByStr20", getTestAddr(SELLER), "recipient"), // SELLER is the ZRC6 contract owner
              getJSONParam("Uint128", "1000", "amount"),
            ],
          },

          // service fee
          {
            name: "TransferSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress.toLowerCase(),
                "sender"
              ),
              getJSONParam(
                "ByStr20",
                getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                "recipient"
              ),
              getJSONParam("Uint128", "250", "amount"),
            ],
          },
        ],
        verifyState: (state) => {
          if (
            JSON.stringify(
              state.sell_orders[globalZRC6ContractAddress.toLowerCase()]
            ) !== "{}" ||
            JSON.stringify(
              state.buy_orders[globalZRC6ContractAddress.toLowerCase()]
            ) !== "{}"
          ) {
            return false;
          }

          if (
            JSON.stringify(
              state.assets[getTestAddr(BUYER_A).toLowerCase()][
                globalZRC6ContractAddress.toLowerCase()
              ]["1"]
            ) !== JSON.stringify(getJSONValue(true))
          ) {
            return false;
          }

          if (
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              globalZRC2ContractAddress.toLowerCase()
            ] !== "8750"
          ) {
            return false;
          }

          return true;
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      let state = await zilliqa.contracts
        .at(globalZRC6MarketplaceContractAddress)
        .getState();

      expect(JSON.stringify(state.buy_orders)).toBe(
        `{"${globalZRC6ContractAddress.toLowerCase()}":{"1":${getUsrDefADTValue(
          globalZRC6MarketplaceContractAddress,
          "BuyOrder",
          [
            getTestAddr(BUYER_A).toLowerCase(),
            "10000",
            getTestAddr(BUYER_A).toLowerCase(),
            "1",
          ]
        )}}}`
      );

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

describe("Withdraw", () => {
  beforeEach(async () => {
    // Add marketplace contract as spender for the tokens as SELLER
    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    let tx = await globalZRC6MarketplaceContractInfo.callGetter(
      zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
      TX_PARAMS
    )(
      "Start",
      globalZRC6ContractAddress,
      "1",
      globalZRC2ContractAddress,
      "1000",
      (globalBNum + 5).toString()
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
    tx = await globalZRC6MarketplaceContractInfo.callGetter(
      zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
      TX_PARAMS
    )("Bid", globalZRC6ContractAddress, "1", "10000", getTestAddr(BUYER_A));

    if (!tx.receipt.success) {
      throw new Error();
    }

    await increaseBNum(zilliqa, 5);

    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    tx = await globalZRC6MarketplaceContractInfo.callGetter(
      zilliqa.contracts.at(globalZRC6MarketplaceContractAddress),
      TX_PARAMS
    )("End", globalZRC6ContractAddress, "1");

    if (!tx.receipt.success) {
      throw new Error();
    }
  });

  const testCases = [
    {
      name: "throws AccountNotFoundError",
      transition: "WithdrawPaymentTokens",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        payment_token_address: globalZRC2ContractAddress,
        amount: 1000,
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.AccountNotFoundError,
      want: undefined,
    },
    {
      name: "throws InsufficientPaymentTokenError",
      transition: "WithdrawPaymentTokens",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        payment_token_address: globalZRC2ContractAddress,
        amount: 10000,
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.InsufficientPaymentTokenError,
      want: undefined,
    },
    {
      name: "Seller withdraws payment tokens",
      transition: "WithdrawPaymentTokens",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        payment_token_address: globalZRC2ContractAddress,
        amount: 1000,
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "WithdrawPaymentTokens",
            getParams: () => [
              getJSONParam("ByStr20", getTestAddr(SELLER), "recipient"),
              getJSONParam(
                "ByStr20",
                globalZRC2ContractAddress,
                "payment_token_address"
              ),
              getJSONParam("Uint128", "1000", "amount"),
            ],
          },
          {
            name: "TransferSuccess",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress.toLowerCase(),
                "sender"
              ),
              getJSONParam("ByStr20", getTestAddr(SELLER), "recipient"),
              getJSONParam("Uint128", "1000", "amount"),
            ],
          },
        ],
        verifyState: (state) => {
          if (
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              globalZRC2ContractAddress.toLowerCase()
            ] !== "7750"
          ) {
            return false;
          }

          return true;
        },
      },
    },
    {
      name: "throws InvalidClaimForAsset",
      transition: "WithdrawAsset",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.AssetNotFoundError,
      want: undefined,
    },
    {
      name: "BuyerA withdraws asset",
      transition: "WithdrawAsset",
      getSender: () => getTestAddr(BUYER_A),
      getParams: () => ({
        token_address: globalZRC6ContractAddress,
        token_id: 1,
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        events: [
          {
            name: "WithdrawAsset",
            getParams: () => [
              getJSONParam("ByStr20", getTestAddr(BUYER_A), "recipient"),
              getJSONParam(
                "ByStr20",
                globalZRC6ContractAddress,
                "token_address"
              ),
              getJSONParam("Uint256", "1", "token_id"),
            ],
          },
          {
            name: "TransferFrom",
            getParams: () => [
              getJSONParam(
                "ByStr20",
                globalZRC6MarketplaceContractAddress.toLowerCase(),
                "from"
              ),
              getJSONParam("ByStr20", getTestAddr(BUYER_A), "to"),
              getJSONParam("Uint256", "1", "token_id"),
            ],
          },
        ],
        verifyState: (state) => {
          if (
            JSON.stringify(
              state.assets[getTestAddr(BUYER_A).toLowerCase()][
                globalZRC6ContractAddress.toLowerCase()
              ]
            ) !== "{}"
          ) {
            return false;
          }

          return true;
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      let state = await zilliqa.contracts
        .at(globalZRC6MarketplaceContractAddress)
        .getState();

      expect(
        JSON.stringify(
          state.assets[getTestAddr(BUYER_A).toLowerCase()][
            globalZRC6ContractAddress.toLowerCase()
          ]["1"]
        )
      ).toBe(JSON.stringify(getJSONValue(true)));

      expect(
        state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
          globalZRC2ContractAddress.toLowerCase()
        ]
      ).toBe("8750");

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
