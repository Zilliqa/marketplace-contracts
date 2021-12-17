import { getJSONParams, getJSONValue } from "@zilliqa-js/scilla-json-utils";
import { BN, Zilliqa } from "@zilliqa-js/zilliqa";
import { expect } from "@jest/globals";
import fs from "fs";
import { getAddressFromPrivateKey, schnorr } from "@zilliqa-js/crypto";

import {
  getBNum,
  increaseBNum,
  getErrorMsg,
  expectEvents,
  ZERO_ADDRESS,
  BalanceTracker,
} from "./testutils";

import {
  API,
  TX_PARAMS,
  CONTRACTS,
  FAUCET_PARAMS,
  ENG_AUC_ERROR,
  asyncNoop,
} from "./config";

const JEST_WORKER_ID = Number(process.env["JEST_WORKER_ID"]);
const GENESIS_PRIVATE_KEY = global.GENESIS_PRIVATE_KEYS[JEST_WORKER_ID - 1];

const zilliqa = new Zilliqa(API);
zilliqa.wallet.addByPrivateKey(GENESIS_PRIVATE_KEY);

let globalBNum;
let globalTokenAddress;
let globalPaymentTokenAddress;
let globalMarketplaceAddress;
let globalNotAllowedPaymentTokenAddress;

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

  zilliqa.wallet.setDefault(getTestAddr(STRANGER));
  const init = getJSONParams({
    _scilla_version: ["Uint32", 0],
    contract_owner: ["ByStr20", getTestAddr(STRANGER)],
    name: ["String", CONTRACTS.wzil.name],
    symbol: ["String", CONTRACTS.wzil.symbol],
    decimals: ["Uint32", CONTRACTS.wzil.decimal],
    init_supply: ["Uint128", CONTRACTS.wzil.initial_supply],
  });
  const [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.wzil.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalNotAllowedPaymentTokenAddress = contract.address;
});

beforeEach(async () => {
  globalBNum = await getBNum(zilliqa);

  // SELLER is the zrc6 contract owner
  zilliqa.wallet.setDefault(getTestAddr(SELLER));
  let init = getJSONParams({
    _scilla_version: ["Uint32", 0],
    initial_contract_owner: ["ByStr20", getTestAddr(SELLER)],
    initial_base_uri: ["String", CONTRACTS.zrc6.baseURI],
    name: ["String", CONTRACTS.zrc6.name],
    symbol: ["String", CONTRACTS.zrc6.symbol],
  });
  let [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.zrc6.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalTokenAddress = contract.address;

  if (globalTokenAddress === undefined) {
    throw new Error();
  }

  // SELLER mints 3 tokens for self
  let tx: any = await zilliqa.contracts.at(globalTokenAddress).call(
    "BatchMint",
    getJSONParams({
      to_token_uri_pair_list: [
        "List (Pair (ByStr20) (String))",
        [
          [getTestAddr(SELLER), ""],
          [getTestAddr(SELLER), ""],
          [getTestAddr(SELLER), ""],
        ],
      ],
    }),
    TX_PARAMS
  );

  if (!tx.receipt.success) {
    throw new Error();
  }

  // BUYER_A is the WZIL contract owner
  zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
  init = getJSONParams({
    _scilla_version: ["Uint32", 0],
    contract_owner: ["ByStr20", getTestAddr(BUYER_A)],
    name: ["String", CONTRACTS.wzil.name],
    symbol: ["String", CONTRACTS.wzil.symbol],
    decimals: ["Uint32", CONTRACTS.wzil.decimal],
    init_supply: ["Uint128", CONTRACTS.wzil.initial_supply],
  });
  [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.wzil.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalPaymentTokenAddress = contract.address;

  if (globalPaymentTokenAddress === undefined) {
    throw new Error();
  }

  // BUYER_A transfers 100k WZIL to BUYER_B
  zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
  tx = await zilliqa.contracts.at(globalPaymentTokenAddress).call(
    "Transfer",
    getJSONParams({
      to: ["ByStr20", getTestAddr(BUYER_B)],
      amount: ["Uint128", 100 * 1000],
    }),
    TX_PARAMS
  );

  if (!tx.receipt.success) {
    throw new Error();
  }

  // MARKETPLACE_CONTRACT_OWNER is the zrc6 marketplace contract owner
  zilliqa.wallet.setDefault(getTestAddr(MARKETPLACE_CONTRACT_OWNER));

  init = getJSONParams({
    _scilla_version: ["Uint32", 0],
    initial_contract_owner: [
      "ByStr20",
      getTestAddr(MARKETPLACE_CONTRACT_OWNER),
    ],
  });
  [, contract] = await zilliqa.contracts
    .new(fs.readFileSync(CONTRACTS.english_auction.path).toString(), init)
    .deploy(TX_PARAMS, 33, 1000, true);
  globalMarketplaceAddress = contract.address;

  if (globalMarketplaceAddress === undefined) {
    throw new Error();
  }

  // allow WZIL
  tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
    "AllowPaymentTokenAddress",
    getJSONParams({
      address: ["ByStr20", globalPaymentTokenAddress],
    }),
    TX_PARAMS
  );

  if (!tx.receipt.success) {
    throw new Error();
  }

  // BUYER_A sets marketplace as spender for ZRC2
  zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
  tx = await zilliqa.contracts.at(globalPaymentTokenAddress).call(
    "IncreaseAllowance",
    getJSONParams({
      spender: ["ByStr20", globalMarketplaceAddress],
      amount: ["Uint128", 100 * 1000],
    }),
    TX_PARAMS
  );

  if (!tx.receipt.success) {
    throw new Error();
  }

  // BUYER_B sets marketplace as spender for ZRC2
  zilliqa.wallet.setDefault(getTestAddr(BUYER_B));

  tx = await zilliqa.contracts.at(globalPaymentTokenAddress).call(
    "IncreaseAllowance",
    getJSONParams({
      spender: ["ByStr20", globalMarketplaceAddress],
      amount: ["Uint128", 100 * 1000],
    }),
    TX_PARAMS
  );

  if (!tx.receipt.success) {
    throw new Error();
  }

  // SELLER sets marketplace as spender for ZRC6
  zilliqa.wallet.setDefault(getTestAddr(SELLER));
  for (let i = 1; i <= CONTRACTS.zrc6.initial_total_supply; i++) {
    const tx: any = await zilliqa.contracts.at(globalTokenAddress).call(
      "SetSpender",
      getJSONParams({
        spender: ["ByStr20", globalMarketplaceAddress],
        token_id: ["Uint256", i],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }
  }
});

describe("ZIL - Auction", () => {
  beforeEach(async () => {
    // Add marketplace contract as spender for the tokens as SELLER
    zilliqa.wallet.setDefault(getTestAddr(SELLER));

    let tx: any = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Start",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      { ...TX_PARAMS }
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Bid",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_A)],
      }),
      { ...TX_PARAMS, amount: new BN("10000") }
    );

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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", globalNotAllowedPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.SellOrderFoundError,
      want: undefined,
    },
    {
      name: "Seller creates sell order for token #2",
      transition: "Start",
      txAmount: 0,
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "Start",
            getParams: () => ({
              maker: ["ByStr20", getTestAddr(SELLER)],
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              payment_token_address: ["ByStr20", ZERO_ADDRESS],
              start_amount: ["Uint128", 1000],
              expiration_bnum: ["BNum", globalBNum + 5],
            }),
          },
          {
            name: "TransferFrom",
            getParams: () => ({
              from: ["ByStr20", getTestAddr(SELLER)],
              to: ["ByStr20", globalMarketplaceAddress],
              token_id: ["Uint256", 2],
            }),
          },
        ],
        expectState: (state) => {
          expect(JSON.stringify(state.sell_orders)).toBe(
            JSON.stringify({
              [globalTokenAddress.toLowerCase()]: {
                [1]: getJSONValue(
                  [getTestAddr(SELLER), globalBNum + 5, ZERO_ADDRESS, 1000],
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128`
                ),
                [2]: getJSONValue(
                  [getTestAddr(SELLER), globalBNum + 5, ZERO_ADDRESS, 1000],
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128`
                ),
              },
            })
          );
        },
      },
    },

    {
      name: "throws SellOrderNotFoundError",
      transition: "Bid",
      txAmount: 1000,
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 999],
        amount: ["Uint128", 1000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.SellOrderNotFoundError,
      want: undefined,
    },
    {
      name: "throws ExpiredError",
      transition: "Bid",
      txAmount: 10000,
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: ENG_AUC_ERROR.ExpiredError,
      want: undefined,
    },
    {
      name: "throws NotEqualAmountError",
      transition: "Bid",
      txAmount: 11000,
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 12000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotEqualAmountError,
      want: undefined,
    },
    {
      name: "throws LessThanMinBidError",
      transition: "Bid",
      txAmount: 10000 - 1,
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000 - 1],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.LessThanMinBidError,
      want: undefined,
    },
    {
      name: "BuyerB bids for token #1",
      transition: "Bid",
      txAmount: 11000,
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 11000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 11000,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: -11000,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "Bid",
            getParams: () => ({
              maker: ["ByStr20", getTestAddr(BUYER_B).toLowerCase()],
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 1],
              amount: ["Uint128", 11000],
              dest: ["ByStr20", getTestAddr(BUYER_B)],
            }),
          },
          {
            name: "TransferFromSuccess",
            getParams: () => ({
              initiator: ["ByStr20", globalMarketplaceAddress],
              sender: ["ByStr20", getTestAddr(BUYER_B)],
              recipient: ["ByStr20", globalMarketplaceAddress],
              amount: ["Uint128", 11000],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            state.payment_tokens[getTestAddr(BUYER_A).toLowerCase()][
              ZERO_ADDRESS.toLowerCase()
            ]
          ).toBe("10000");

          expect(JSON.stringify(state.buy_orders)).toBe(
            JSON.stringify({
              [globalTokenAddress.toLowerCase()]: {
                [1]: getJSONValue(
                  [getTestAddr(BUYER_B), 11000, getTestAddr(BUYER_B), 2],
                  `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`
                ),
              },
            })
          );
        },
      },
    },

    {
      name: "throws NotAllowedToCancelOrder",
      transition: "Cancel",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotAllowedToCancelOrder,
      want: undefined,
    },
    {
      name: "throws SellOrderNotFoundError",
      transition: "Cancel",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 999],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "Cancel",
            getParams: () => ({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 1],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(state.sell_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(state.buy_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(
              state.assets[getTestAddr(SELLER).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]["1"]
            )
          ).toBe(JSON.stringify(getJSONValue(true)));

          expect(
            state.payment_tokens[getTestAddr(BUYER_A).toLowerCase()][
              ZERO_ADDRESS
            ]
          ).toBe("10000");
        },
      },
    },

    {
      name: "throws SellOrderNotFoundError",
      transition: "End",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 999],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: -1250,
          [getTestAddr(SELLER)]: 1000,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 250,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "End",
            getParams: () => ({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 1],
              payment_token_address: ["ByStr20", ZERO_ADDRESS],
              sale_price: ["Uint128", 10000],
              seller: ["ByStr20", getTestAddr(SELLER)],
              buyer: ["ByStr20", getTestAddr(BUYER_A)],
              asset_recipient: ["ByStr20", getTestAddr(BUYER_A)],
              payment_tokens_recipient: ["ByStr20", getTestAddr(SELLER)],
              royalty_recipient: ["ByStr20", getTestAddr(SELLER)],
              royalty_amount: ["Uint128", 1000],
              service_fee: ["Uint128", 250],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(state.sell_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(state.buy_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(
              state.assets[getTestAddr(BUYER_A).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]["1"]
            )
          ).toBe(JSON.stringify(getJSONValue(true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              ZERO_ADDRESS.toLowerCase()
            ]
          ).toBe("8750");
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      let state = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .getState();

      expect(JSON.stringify(state.buy_orders)).toBe(
        JSON.stringify({
          [globalTokenAddress.toLowerCase()]: {
            [1]: getJSONValue(
              [getTestAddr(BUYER_A), 10000, getTestAddr(BUYER_A), 1],
              `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`
            ),
          },
        })
      );

      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        const accounts = Object.keys(await testCase.want.getBalanceDeltas());
        balanceTracker = new BalanceTracker(zilliqa, accounts, {});
        await balanceTracker.get();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(testCase.transition, getJSONParams(testCase.getParams()), {
          ...TX_PARAMS,
          amount: new BN(testCase.txAmount || 0),
        });

      if (testCase.want === undefined) {
        // Nagative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);

        const state = await zilliqa.contracts
          .at(globalMarketplaceAddress)
          .getState();

        testCase.want.expectState(state);

        if (balanceTracker) {
          const deltasReceived = await balanceTracker.deltas();
          const deltasExpected = await testCase.want?.getBalanceDeltas();
          deltasReceived.forEach(([account, delta]) => {
            if (
              balanceTracker.zrc2 === undefined &&
              account.toLowerCase() === testCase.getSender().toLowerCase()
            ) {
              const txFee = new BN(tx.receipt.cumulative_gas).mul(tx.gasPrice);
              const deltaWithFee = new BN(delta).add(txFee);
              expect(`${account}:${deltaWithFee.toString()}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            } else {
              expect(`${account}:${delta}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            }
          });
        }
      }
    });
  }
});

describe("WZIL - Auction", () => {
  beforeEach(async () => {
    // Add marketplace contract as spender for the tokens as SELLER
    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    let tx: any = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Start",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Bid",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_A)],
      }),
      TX_PARAMS
    );

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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", globalNotAllowedPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "Start",
            getParams: () => ({
              maker: ["ByStr20", getTestAddr(SELLER)],
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", "2"],
              payment_token_address: ["ByStr20", globalPaymentTokenAddress],
              start_amount: ["Uint128", "1000"],
              expiration_bnum: ["BNum", globalBNum + 5],
            }),
          },
          {
            name: "TransferFrom",
            getParams: () => ({
              from: ["ByStr20", getTestAddr(SELLER)],
              to: ["ByStr20", globalMarketplaceAddress],
              token_id: ["Uint256", "2"],
            }),
          },
        ],
        expectState: (state) => {
          expect(JSON.stringify(state.sell_orders)).toBe(
            JSON.stringify({
              [globalTokenAddress.toLowerCase()]: {
                [1]: getJSONValue(
                  [
                    getTestAddr(SELLER),
                    globalBNum + 5,
                    globalPaymentTokenAddress,
                    1000,
                  ],
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128`
                ),
                [2]: getJSONValue(
                  [
                    getTestAddr(SELLER),
                    globalBNum + 5,
                    globalPaymentTokenAddress,
                    1000,
                  ],
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128`
                ),
              },
            })
          );
        },
      },
    },
    {
      name: "throws SellOrderNotFoundError",
      transition: "Bid",
      getSender: () => getTestAddr(BUYER_B),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 999],
        amount: ["Uint128", 1000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", Number(100 * 1000) + 1],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000 - 1],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 11000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 11000,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: -11000,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "Bid",
            getParams: () => ({
              maker: ["ByStr20", getTestAddr(BUYER_B)],
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", "1"],
              amount: ["Uint128", "11000"],
              dest: ["ByStr20", getTestAddr(BUYER_B)],
            }),
          },
          {
            name: "TransferFromSuccess",
            getParams: () => ({
              initiator: ["ByStr20", globalMarketplaceAddress],
              sender: ["ByStr20", getTestAddr(BUYER_B)],
              recipient: ["ByStr20", globalMarketplaceAddress.toLowerCase()],
              amount: ["Uint128", "11000"],
            }),
          },
        ],
        expectState: (state) => {
          // Buyer A  can withdraw bid
          state.payment_tokens[getTestAddr(BUYER_A).toLowerCase()][
            globalPaymentTokenAddress.toLowerCase()
          ] !== "10000";

          if (
            JSON.stringify(state.buy_orders) !==
            JSON.stringify({
              [globalTokenAddress.toLowerCase()]: {
                [1]: getJSONValue(
                  [getTestAddr(BUYER_B), 11000, getTestAddr(BUYER_B), 2],
                  `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`
                ),
              },
            })
          ) {
            return false;
          }

          return true;
        },
      },
    },

    {
      name: "throws NotAllowedToCancelOrder",
      transition: "Cancel",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotAllowedToCancelOrder,
      want: undefined,
    },
    {
      name: "throws SellOrderNotFoundError",
      transition: "Cancel",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 999],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "Cancel",
            getParams: () => ({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 1],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(state.sell_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");
          expect(
            JSON.stringify(state.buy_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(
              state.assets[getTestAddr(SELLER).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]["1"]
            )
          ).toBe(JSON.stringify(getJSONValue(true)));

          expect(
            state.payment_tokens[getTestAddr(BUYER_A).toLowerCase()][
              globalPaymentTokenAddress.toLowerCase()
            ]
          ).toBe("10000");
        },
      },
    },

    {
      name: "throws SellOrderNotFoundError",
      transition: "End",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 999],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: -1250,
          [getTestAddr(SELLER)]: 1000,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 250,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "End",
            getParams: () => ({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 1],
              payment_token_address: ["ByStr20", globalPaymentTokenAddress],
              sale_price: ["Uint128", 10000],
              seller: ["ByStr20", getTestAddr(SELLER)],
              buyer: ["ByStr20", getTestAddr(BUYER_A)],
              asset_recipient: ["ByStr20", getTestAddr(BUYER_A)],
              payment_tokens_recipient: ["ByStr20", getTestAddr(SELLER)],
              royalty_recipient: ["ByStr20", getTestAddr(SELLER)],
              royalty_amount: ["Uint128", 1000],
              service_fee: ["Uint128", 250],
            }),
          },

          // royalty fee
          {
            name: "TransferSuccess",
            getParams: () => ({
              sender: ["ByStr20", globalMarketplaceAddress],
              recipient: ["ByStr20", getTestAddr(SELLER)], // SELLER is the ZRC6 contract owner
              amount: ["Uint128", 1000],
            }),
          },

          // service fee
          {
            name: "TransferSuccess",
            getParams: () => ({
              sender: ["ByStr20", globalMarketplaceAddress],
              recipient: ["ByStr20", getTestAddr(MARKETPLACE_CONTRACT_OWNER)],
              amount: ["Uint128", 250],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(state.sell_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");
          expect(
            JSON.stringify(state.buy_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(
              state.assets[getTestAddr(BUYER_A).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]["1"]
            )
          ).toBe(JSON.stringify(getJSONValue(true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              globalPaymentTokenAddress.toLowerCase()
            ]
          ).toBe("8750");
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      let state = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .getState();

      expect(JSON.stringify(state.buy_orders)).toBe(
        JSON.stringify({
          [globalTokenAddress.toLowerCase()]: {
            [1]: getJSONValue(
              [getTestAddr(BUYER_A), 10000, getTestAddr(BUYER_A), 1],
              `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`
            ),
          },
        })
      );

      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        const accounts = Object.keys(await testCase.want.getBalanceDeltas());
        balanceTracker = new BalanceTracker(zilliqa, accounts, {
          zrc2: globalPaymentTokenAddress,
        });
        await balanceTracker.get();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(
          testCase.transition,
          getJSONParams(testCase.getParams()),
          TX_PARAMS
        );

      if (testCase.want === undefined) {
        // Nagative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);

        const state = await zilliqa.contracts
          .at(globalMarketplaceAddress)
          .getState();

        testCase.want.expectState(state);

        if (balanceTracker) {
          const deltasReceived = await balanceTracker.deltas();
          const deltasExpected = await testCase.want?.getBalanceDeltas();
          deltasReceived.forEach(([account, delta]) => {
            if (
              balanceTracker.zrc2 === undefined &&
              account.toLowerCase() === testCase.getSender().toLowerCase()
            ) {
              const txFee = new BN(tx.receipt.cumulative_gas).mul(tx.gasPrice);
              const deltaWithFee = new BN(delta).add(txFee);
              expect(`${account}:${deltaWithFee.toString()}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            } else {
              expect(`${account}:${delta}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            }
          });
        }
      }
    });
  }
});
describe("ZIL - Withdraw", () => {
  beforeEach(async () => {
    // Add marketplace contract as spender for the tokens as SELLER
    zilliqa.wallet.setDefault(getTestAddr(SELLER));

    let tx: any = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Start",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      { ...TX_PARAMS }
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Bid",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_A)],
      }),
      { ...TX_PARAMS, amount: new BN("10000") }
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    await increaseBNum(zilliqa, 5);

    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "End",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      TX_PARAMS
    );

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
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        amount: ["Uint128", 1000],
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
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        amount: ["Uint128", 10000],
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
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        amount: ["Uint128", 1000],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: -1000,
          [getTestAddr(SELLER)]: 1000,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "WithdrawPaymentTokens",
            getParams: () => ({
              recipient: ["ByStr20", getTestAddr(SELLER)],
              payment_token_address: ["ByStr20", ZERO_ADDRESS],
              amount: ["Uint128", 1000],
            }),
          },
          {
            name: "TransferSuccess",
            getParams: () => ({
              sender: ["ByStr20", globalMarketplaceAddress],
              recipient: ["ByStr20", getTestAddr(SELLER)],
              amount: ["Uint128", 1000],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              ZERO_ADDRESS.toLowerCase()
            ]
          ).toBe("7750");
        },
      },
    },
    {
      name: "throws InvalidClaimForAsset",
      transition: "WithdrawAsset",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "WithdrawAsset",
            getParams: () => ({
              recipient: ["ByStr20", getTestAddr(BUYER_A)],
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 1],
            }),
          },
          {
            name: "TransferFrom",
            getParams: () => ({
              from: ["ByStr20", globalMarketplaceAddress],
              to: ["ByStr20", getTestAddr(BUYER_A)],
              token_id: ["Uint256", 1],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(
              state.assets[getTestAddr(BUYER_A).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]
            )
          ).toBe("{}");
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      let state = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .getState();

      expect(
        JSON.stringify(
          state.assets[getTestAddr(BUYER_A).toLowerCase()][
            globalTokenAddress.toLowerCase()
          ]["1"]
        )
      ).toBe(JSON.stringify(getJSONValue(true)));

      expect(
        state.payment_tokens[getTestAddr(SELLER).toLowerCase()][ZERO_ADDRESS]
      ).toBe("8750");

      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        const accounts = Object.keys(await testCase.want.getBalanceDeltas());
        balanceTracker = new BalanceTracker(zilliqa, accounts);
        await balanceTracker.get();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(testCase.transition, getJSONParams(testCase.getParams()), {
          ...TX_PARAMS,
        });

      if (testCase.want === undefined) {
        // Nagative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);

        const state = await zilliqa.contracts
          .at(globalMarketplaceAddress)
          .getState();

        testCase.want.expectState(state);

        if (balanceTracker) {
          const deltasReceived = await balanceTracker.deltas();
          const deltasExpected = await testCase.want?.getBalanceDeltas();
          deltasReceived.forEach(([account, delta]) => {
            if (
              balanceTracker.zrc2 === undefined &&
              account.toLowerCase() === testCase.getSender().toLowerCase()
            ) {
              const txFee = new BN(tx.receipt.cumulative_gas).mul(tx.gasPrice);
              const deltaWithFee = new BN(delta).add(txFee);
              expect(`${account}:${deltaWithFee.toString()}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            } else {
              expect(`${account}:${delta}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            }
          });
        }
      }
    });
  }
});

describe("WZIL - Withdraw", () => {
  beforeEach(async () => {
    // Add marketplace contract as spender for the tokens as SELLER
    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    let tx: any = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Start",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Bid",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_A)],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    await increaseBNum(zilliqa, 5);

    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "End",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      TX_PARAMS
    );

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
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        amount: ["Uint128", 1000],
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
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        amount: ["Uint128", 10000],
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
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        amount: ["Uint128", 1000],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: -1000,
          [getTestAddr(SELLER)]: 1000,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "WithdrawPaymentTokens",
            getParams: () => ({
              recipient: ["ByStr20", getTestAddr(SELLER)],
              payment_token_address: ["ByStr20", globalPaymentTokenAddress],
              amount: ["Uint128", 1000],
            }),
          },
          {
            name: "TransferSuccess",
            getParams: () => ({
              sender: ["ByStr20", globalMarketplaceAddress.toLowerCase()],
              recipient: ["ByStr20", getTestAddr(SELLER)],
              amount: ["Uint128", 1000],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              globalPaymentTokenAddress.toLowerCase()
            ]
          ).toBe("7750");
        },
      },
    },
    {
      name: "throws InvalidClaimForAsset",
      transition: "WithdrawAsset",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
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
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "WithdrawAsset",
            getParams: () => ({
              recipient: ["ByStr20", getTestAddr(BUYER_A)],
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 1],
            }),
          },
          {
            name: "TransferFrom",
            getParams: () => ({
              from: ["ByStr20", globalMarketplaceAddress],
              to: ["ByStr20", getTestAddr(BUYER_A)],
              token_id: ["Uint256", 1],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(
              state.assets[getTestAddr(BUYER_A).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]
            )
          ).toBe("{}");
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      let state = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .getState();

      expect(
        JSON.stringify(
          state.assets[getTestAddr(BUYER_A).toLowerCase()][
            globalTokenAddress.toLowerCase()
          ]["1"]
        )
      ).toBe(JSON.stringify(getJSONValue(true)));

      expect(
        state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
          globalPaymentTokenAddress.toLowerCase()
        ]
      ).toBe("8750");

      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        const accounts = Object.keys(await testCase.want.getBalanceDeltas());
        balanceTracker = new BalanceTracker(zilliqa, accounts, {
          zrc2: globalPaymentTokenAddress,
        });
        await balanceTracker.get();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(
          testCase.transition,
          getJSONParams(testCase.getParams()),
          TX_PARAMS
        );

      if (testCase.want === undefined) {
        // Nagative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);

        const state = await zilliqa.contracts
          .at(globalMarketplaceAddress)
          .getState();

        testCase.want.expectState(state);

        if (balanceTracker) {
          const deltasReceived = await balanceTracker.deltas();
          const deltasExpected = await testCase.want?.getBalanceDeltas();
          deltasReceived.forEach(([account, delta]) => {
            if (
              balanceTracker.zrc2 === undefined &&
              account.toLowerCase() === testCase.getSender().toLowerCase()
            ) {
              const txFee = new BN(tx.receipt.cumulative_gas).mul(tx.gasPrice);
              const deltaWithFee = new BN(delta).add(txFee);
              expect(`${account}:${deltaWithFee.toString()}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            } else {
              expect(`${account}:${delta}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            }
          });
        }
      }
    });
  }
});

describe("ZIL - Balance", () => {
  beforeEach(async () => {
    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    let tx: any = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Start",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      { ...TX_PARAMS }
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Start",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 10],
      }),
      { ...TX_PARAMS }
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Bid",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_A)],
      }),
      { ...TX_PARAMS, amount: new BN("10000") }
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_B));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Bid",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      { ...TX_PARAMS, amount: new BN("10000") }
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    await increaseBNum(zilliqa, 5);

    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "End",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }
  });

  const testCases = [
    {
      name: "BuyerA bids for token #2",
      transition: "Bid",
      txAmount: 11000,
      getSender: () => getTestAddr(BUYER_A),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        amount: ["Uint128", 11000],
        dest: ["ByStr20", getTestAddr(BUYER_A)],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 11000,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: -11000,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "Bid",
            getParams: () => ({
              maker: ["ByStr20", getTestAddr(BUYER_A)],
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              amount: ["Uint128", 11000],
              dest: ["ByStr20", getTestAddr(BUYER_A)],
            }),
          },
          {
            name: "TransferFromSuccess",
            getParams: () => ({
              initiator: ["ByStr20", globalMarketplaceAddress],
              sender: ["ByStr20", getTestAddr(BUYER_A)],
              recipient: ["ByStr20", globalMarketplaceAddress],
              amount: ["Uint128", 11000],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            state.payment_tokens[getTestAddr(BUYER_B).toLowerCase()][
              ZERO_ADDRESS.toLowerCase()
            ]
          ).toBe("10000");

          expect(
            JSON.stringify(state.buy_orders[globalTokenAddress.toLowerCase()])
          ).toBe(
            JSON.stringify({
              [2]: getJSONValue(
                [getTestAddr(BUYER_A), 11000, getTestAddr(BUYER_A), 2],
                `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`
              ),
            })
          );
        },
      },
    },

    {
      name: "Seller ends the auction #2",
      transition: "End",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: -1250,
          [getTestAddr(SELLER)]: 1000,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 250,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "End",
            getParams: () => ({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              payment_token_address: ["ByStr20", ZERO_ADDRESS],
              sale_price: ["Uint128", 10000],
              seller: ["ByStr20", getTestAddr(SELLER)],
              buyer: ["ByStr20", getTestAddr(BUYER_B)],
              asset_recipient: ["ByStr20", getTestAddr(BUYER_B)],
              payment_tokens_recipient: ["ByStr20", getTestAddr(SELLER)],
              royalty_recipient: ["ByStr20", getTestAddr(SELLER)],
              royalty_amount: ["Uint128", 1000],
              service_fee: ["Uint128", 250],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(state.sell_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(state.buy_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(
              state.assets[getTestAddr(BUYER_A).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]["1"]
            )
          ).toBe(JSON.stringify(getJSONValue(true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              ZERO_ADDRESS.toLowerCase()
            ]
          ).toBe((8750 * 2).toString());
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      let state = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .getState();

      expect(
        JSON.stringify(
          state.assets[getTestAddr(BUYER_A).toLowerCase()][
            globalTokenAddress.toLowerCase()
          ]["1"]
        )
      ).toBe(JSON.stringify(getJSONValue(true)));

      expect(
        state.payment_tokens[getTestAddr(SELLER).toLowerCase()][ZERO_ADDRESS]
      ).toBe("8750");

      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        const accounts = Object.keys(await testCase.want.getBalanceDeltas());
        balanceTracker = new BalanceTracker(zilliqa, accounts);
        await balanceTracker.get();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(testCase.transition, getJSONParams(testCase.getParams()), {
          ...TX_PARAMS,
          amount: new BN(testCase.txAmount || 0),
        });

      if (testCase.want === undefined) {
        // Nagative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);

        const state = await zilliqa.contracts
          .at(globalMarketplaceAddress)
          .getState();

        testCase.want.expectState(state);

        if (balanceTracker) {
          const deltasReceived = await balanceTracker.deltas();
          const deltasExpected = await testCase.want?.getBalanceDeltas();
          deltasReceived.forEach(([account, delta]) => {
            if (
              balanceTracker.zrc2 === undefined &&
              account.toLowerCase() === testCase.getSender().toLowerCase()
            ) {
              const txFee = new BN(tx.receipt.cumulative_gas).mul(tx.gasPrice);
              const deltaWithFee = new BN(delta).add(txFee);
              expect(`${account}:${deltaWithFee.toString()}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            } else {
              expect(`${account}:${delta}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            }
          });
        }
      }
    });
  }
});

describe("WZIL - Balance", () => {
  beforeEach(async () => {
    // Add marketplace contract as spender for the tokens as SELLER
    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    let tx: any = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Start",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Start",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 10],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Bid",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_A)],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    zilliqa.wallet.setDefault(getTestAddr(BUYER_B));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "Bid",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        amount: ["Uint128", 10000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }

    await increaseBNum(zilliqa, 5);

    zilliqa.wallet.setDefault(getTestAddr(SELLER));
    tx = await zilliqa.contracts.at(globalMarketplaceAddress).call(
      "End",
      getJSONParams({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      TX_PARAMS
    );

    if (!tx.receipt.success) {
      throw new Error();
    }
  });

  const testCases = [
    {
      name: "BuyerA bids for token #2",
      transition: "Bid",
      getSender: () => getTestAddr(BUYER_A),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        amount: ["Uint128", 11000],
        dest: ["ByStr20", getTestAddr(BUYER_A)],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 11000,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: -11000,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "Bid",
            getParams: () => ({
              maker: ["ByStr20", getTestAddr(BUYER_A)],
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              amount: ["Uint128", 11000],
              dest: ["ByStr20", getTestAddr(BUYER_A)],
            }),
          },
          {
            name: "TransferFromSuccess",
            getParams: () => ({
              initiator: ["ByStr20", globalMarketplaceAddress.toLowerCase()],
              sender: ["ByStr20", getTestAddr(BUYER_A).toLowerCase()],
              recipient: ["ByStr20", globalMarketplaceAddress.toLowerCase()],
              amount: ["Uint128", 11000],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            state.payment_tokens[getTestAddr(BUYER_B).toLowerCase()][
              globalPaymentTokenAddress.toLowerCase()
            ]
          ).toBe("10000");

          expect(
            JSON.stringify(state.buy_orders[globalTokenAddress.toLowerCase()])
          ).toBe(
            JSON.stringify({
              [2]: getJSONValue(
                [getTestAddr(BUYER_A), 11000, getTestAddr(BUYER_A), 2],
                `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`
              ),
            })
          );
        },
      },
    },

    {
      name: "Seller ends the auction #2",
      transition: "End",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: -1250,
          [getTestAddr(SELLER)]: 1000,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 250,
          [getTestAddr(STRANGER)]: 0,
        }),
        events: [
          {
            name: "End",
            getParams: () => ({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              payment_token_address: ["ByStr20", globalPaymentTokenAddress],
              sale_price: ["Uint128", 10000],
              seller: ["ByStr20", getTestAddr(SELLER)],
              buyer: ["ByStr20", getTestAddr(BUYER_B)],
              asset_recipient: ["ByStr20", getTestAddr(BUYER_B)],
              payment_tokens_recipient: ["ByStr20", getTestAddr(SELLER)],
              royalty_recipient: ["ByStr20", getTestAddr(SELLER)],
              royalty_amount: ["Uint128", 1000],
              service_fee: ["Uint128", 250],
            }),
          },

          // royalty fee
          {
            name: "TransferSuccess",
            getParams: () => ({
              sender: ["ByStr20", globalMarketplaceAddress.toLowerCase()],
              recipient: ["ByStr20", getTestAddr(SELLER)], // SELLER is the ZRC6 contract owner
              amount: ["Uint128", 1000],
            }),
          },

          // service fee
          {
            name: "TransferSuccess",
            getParams: () => ({
              sender: ["ByStr20", globalMarketplaceAddress.toLowerCase()],
              recipient: ["ByStr20", getTestAddr(MARKETPLACE_CONTRACT_OWNER)],
              amount: ["Uint128", 250],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(state.sell_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(state.buy_orders[globalTokenAddress.toLowerCase()])
          ).toBe("{}");

          expect(
            JSON.stringify(
              state.assets[getTestAddr(BUYER_B).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]["2"]
            )
          ).toBe(JSON.stringify(getJSONValue(true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              globalPaymentTokenAddress.toLowerCase()
            ]
          ).toBe((8750 * 2).toString());
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      let state = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .getState();

      expect(
        JSON.stringify(
          state.assets[getTestAddr(BUYER_A).toLowerCase()][
            globalTokenAddress.toLowerCase()
          ]["1"]
        )
      ).toBe(JSON.stringify(getJSONValue(true)));

      expect(
        state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
          globalPaymentTokenAddress.toLowerCase()
        ]
      ).toBe("8750");

      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        const accounts = Object.keys(await testCase.want.getBalanceDeltas());
        balanceTracker = new BalanceTracker(zilliqa, accounts, {
          zrc2: globalPaymentTokenAddress,
        });
        await balanceTracker.get();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(
          testCase.transition,
          getJSONParams(testCase.getParams()),
          TX_PARAMS
        );

      if (testCase.want === undefined) {
        // Nagative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);

        const state = await zilliqa.contracts
          .at(globalMarketplaceAddress)
          .getState();

        testCase.want.expectState(state);

        if (balanceTracker) {
          const deltasReceived = await balanceTracker.deltas();
          const deltasExpected = await testCase.want?.getBalanceDeltas();
          deltasReceived.forEach(([account, delta]) => {
            if (
              balanceTracker.zrc2 === undefined &&
              account.toLowerCase() === testCase.getSender().toLowerCase()
            ) {
              const txFee = new BN(tx.receipt.cumulative_gas).mul(tx.gasPrice);
              const deltaWithFee = new BN(delta).add(txFee);
              expect(`${account}:${deltaWithFee.toString()}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            } else {
              expect(`${account}:${delta}`).toBe(
                `${account}:${deltasExpected[account]?.toString()}`
              );
            }
          });
        }
      }
    });
  }
});
