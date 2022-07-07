import { scillaJSONParams, scillaJSONVal } from "@zilliqa-js/scilla-json-utils";
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
  zilBalancesGetter,
  zrc2BalancesGetter,
  expectDeltas,
  zrc2AllowncesGetter,
  expectTokenOwners,
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
const FORBIDDEN = 5;

const getTestAddr = (index) => globalTestAccounts[index]?.address as string;

beforeAll(async () => {
  const accounts = Array.from({ length: 6 }, schnorr.generatePrivateKey).map(
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
    FORBIDDEN: getTestAddr(FORBIDDEN),
  });

  zilliqa.wallet.setDefault(getTestAddr(STRANGER));
  const [, contract] = await zilliqa.contracts
    .new(
      fs.readFileSync(CONTRACTS.wzil.path).toString(),
      scillaJSONParams({
        _scilla_version: ["Uint32", 0],
        contract_owner: ["ByStr20", getTestAddr(STRANGER)],
        name: ["String", CONTRACTS.wzil.name],
        symbol: ["String", CONTRACTS.wzil.symbol],
        decimals: ["Uint32", CONTRACTS.wzil.decimal],
        init_supply: ["Uint128", CONTRACTS.wzil.initial_supply],
      })
    )
    .deploy(TX_PARAMS, 33, 1000, true);
  globalNotAllowedPaymentTokenAddress = contract.address;
});

beforeEach(async () => {
  globalBNum = await getBNum(zilliqa);

  // SELLER is the zrc6 contract owner
  zilliqa.wallet.setDefault(getTestAddr(SELLER));
  let [, contract] = await zilliqa.contracts
    .new(
      fs.readFileSync(CONTRACTS.zrc6.path).toString(),
      scillaJSONParams({
        _scilla_version: ["Uint32", 0],
        initial_contract_owner: ["ByStr20", getTestAddr(SELLER)],
        initial_base_uri: ["String", CONTRACTS.zrc6.baseURI],
        name: ["String", CONTRACTS.zrc6.name],
        symbol: ["String", CONTRACTS.zrc6.symbol],
      })
    )
    .deploy(TX_PARAMS, 33, 1000, true);
  globalTokenAddress = contract.address;
  if (globalTokenAddress === undefined) {
    throw new Error();
  }

  // BUYER_A is the WZIL contract owner
  zilliqa.wallet.setDefault(getTestAddr(BUYER_A));
  [, contract] = await zilliqa.contracts
    .new(
      fs.readFileSync(CONTRACTS.wzil.path).toString(),
      scillaJSONParams({
        _scilla_version: ["Uint32", 0],
        contract_owner: ["ByStr20", getTestAddr(BUYER_A)],
        name: ["String", CONTRACTS.wzil.name],
        symbol: ["String", CONTRACTS.wzil.symbol],
        decimals: ["Uint32", CONTRACTS.wzil.decimal],
        init_supply: ["Uint128", CONTRACTS.wzil.initial_supply],
      })
    )
    .deploy(TX_PARAMS, 33, 1000, true);
  globalPaymentTokenAddress = contract.address;
  if (globalPaymentTokenAddress === undefined) {
    throw new Error();
  }

  // MARKETPLACE_CONTRACT_OWNER is the allowlist contract owner
  zilliqa.wallet.setDefault(getTestAddr(MARKETPLACE_CONTRACT_OWNER));
  [, contract] = await zilliqa.contracts
    .new(
      fs.readFileSync(CONTRACTS.allowlist.path).toString(),
      scillaJSONParams({
        _scilla_version: ["Uint32", 0],
        initial_contract_owner: [
          "ByStr20",
          getTestAddr(MARKETPLACE_CONTRACT_OWNER),
        ],
      })
    )
    .deploy(TX_PARAMS, 33, 1000, true);
  const localAllowlistAddress = contract.address;
  if (localAllowlistAddress === undefined) {
    throw new Error();
  }

  // MARKETPLACE_CONTRACT_OWNER is the zrc6 marketplace contract owner
  zilliqa.wallet.setDefault(getTestAddr(MARKETPLACE_CONTRACT_OWNER));
  [, contract] = await zilliqa.contracts
    .new(
      fs.readFileSync(CONTRACTS.english_auction.path).toString(),
      scillaJSONParams({
        _scilla_version: ["Uint32", 0],
        initial_contract_owner: [
          "ByStr20",
          getTestAddr(MARKETPLACE_CONTRACT_OWNER),
        ],
      })
    )
    .deploy(TX_PARAMS, 33, 1000, true);
  globalMarketplaceAddress = contract.address;
  if (globalMarketplaceAddress === undefined) {
    throw new Error();
  }

  for (const call of [
    {
      beforeTransition: asyncNoop,
      sender: getTestAddr(MARKETPLACE_CONTRACT_OWNER),
      contract: localAllowlistAddress,
      transition: "Allow",
      transitionParams: scillaJSONParams({
        address_list: [
          "List (ByStr20)",
          [
            getTestAddr(MARKETPLACE_CONTRACT_OWNER),
            getTestAddr(SELLER),
            getTestAddr(BUYER_A),
            getTestAddr(BUYER_B),
            getTestAddr(STRANGER),
          ],
        ],
      }),
      txParams: TX_PARAMS,
    },
    {
      beforeTransition: asyncNoop,
      sender: getTestAddr(MARKETPLACE_CONTRACT_OWNER),
      contract: globalMarketplaceAddress,
      transition: "SetAllowlist",
      transitionParams: scillaJSONParams({
        address: ["ByStr20", localAllowlistAddress],
      }),
      txParams: TX_PARAMS,
    },
    {
      beforeTransition: asyncNoop,
      sender: getTestAddr(BUYER_A),
      contract: globalPaymentTokenAddress,
      transition: "Transfer",
      transitionParams: scillaJSONParams({
        to: ["ByStr20", getTestAddr(BUYER_B)],
        amount: ["Uint128", 100 * 1000],
      }),
      txParams: TX_PARAMS,
    },
    {
      beforeTransition: asyncNoop,
      sender: getTestAddr(SELLER),
      contract: globalTokenAddress,
      transition: "BatchMint",
      transitionParams: scillaJSONParams({
        to_token_uri_pair_list: [
          "List (Pair (ByStr20) (String))",
          [
            [getTestAddr(SELLER), ""],
            [getTestAddr(SELLER), ""],
            [getTestAddr(SELLER), ""],
          ],
        ],
      }),
      txParams: TX_PARAMS,
    },
    {
      beforeTransition: asyncNoop,
      sender: getTestAddr(MARKETPLACE_CONTRACT_OWNER),
      contract: globalMarketplaceAddress,
      transition: "AllowPaymentTokenAddress",
      transitionParams: scillaJSONParams({
        address: ["ByStr20", globalPaymentTokenAddress],
      }),
      txParams: TX_PARAMS,
    },
    {
      beforeTransition: asyncNoop,
      sender: getTestAddr(BUYER_A),
      contract: globalPaymentTokenAddress,
      transition: "IncreaseAllowance",
      transitionParams: scillaJSONParams({
        spender: ["ByStr20", globalMarketplaceAddress],
        amount: ["Uint128", 100 * 1000],
      }),
      txParams: TX_PARAMS,
    },
    {
      beforeTransition: asyncNoop,
      sender: getTestAddr(BUYER_B),
      contract: globalPaymentTokenAddress,
      transition: "IncreaseAllowance",
      transitionParams: scillaJSONParams({
        spender: ["ByStr20", globalMarketplaceAddress],
        amount: ["Uint128", 100 * 1000],
      }),
      txParams: TX_PARAMS,
    },
    ...[1, 2, 3].map((tokenId) => ({
      beforeTransition: asyncNoop,
      sender: getTestAddr(SELLER),
      contract: globalTokenAddress,
      transition: "SetSpender",
      transitionParams: scillaJSONParams({
        spender: ["ByStr20", globalMarketplaceAddress],
        token_id: ["Uint256", tokenId],
      }),
      txParams: TX_PARAMS,
    })),
  ]) {
    await call.beforeTransition();
    zilliqa.wallet.setDefault(call.sender);
    const tx: any = await zilliqa.contracts
      .at(call.contract)
      .call(call.transition, call.transitionParams, call.txParams);
    if (!tx.receipt.success) {
      throw new Error();
    }
  }
});

describe("ZIL - Auction", () => {
  beforeEach(async () => {
    for (const call of [
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "Start",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          payment_token_address: ["ByStr20", ZERO_ADDRESS],
          start_amount: ["Uint128", 1000],
          expiration_bnum: ["BNum", globalBNum + 5],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(BUYER_A),
        contract: globalMarketplaceAddress,
        transition: "Bid",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          amount: ["Uint128", 10000],
          dest: ["ByStr20", getTestAddr(BUYER_A)],
        }),
        txParams: { ...TX_PARAMS, amount: new BN("10000") },
      },
    ]) {
      await call.beforeTransition();
      zilliqa.wallet.setDefault(call.sender);
      const tx: any = await zilliqa.contracts
        .at(call.contract)
        .call(call.transition, call.transitionParams, call.txParams);
      if (!tx.receipt.success) {
        throw new Error();
      }
    }

    const res = await zilliqa.blockchain.getBalance(globalMarketplaceAddress);
    expect(res.result.balance).toBe("10000");

    const state = await zilliqa.contracts
      .at(globalMarketplaceAddress)
      .getState();

    expect(JSON.stringify(state.sell_orders)).toBe(
      JSON.stringify({
        [globalTokenAddress.toLowerCase()]: {
          [1]: scillaJSONVal(
            `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128.ByStr20.Uint128.ByStr20.Uint128`,
            [
              getTestAddr(SELLER),
              globalBNum + 5,
              ZERO_ADDRESS,
              1000,
              getTestAddr(SELLER),
              1000,
              getTestAddr(MARKETPLACE_CONTRACT_OWNER),
              250,
            ]
          ),
        },
      })
    );

    expect(JSON.stringify(state.buy_orders)).toBe(
      JSON.stringify({
        [globalTokenAddress.toLowerCase()]: {
          [1]: scillaJSONVal(
            `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`,
            [getTestAddr(BUYER_A), 10000, getTestAddr(BUYER_A), 1]
          ),
        },
      })
    );
  });

  const testCases = [
    {
      name: "throws NotAllowedUserError",
      transition: "Start",
      getSender: () => getTestAddr(FORBIDDEN),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotAllowedUserError,
      want: undefined,
    },
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: globalMarketplaceAddress,
          3: getTestAddr(SELLER),
        }),
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
                [1]: scillaJSONVal(
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128.ByStr20.Uint128.ByStr20.Uint128`,
                  [
                    getTestAddr(SELLER),
                    globalBNum + 5,
                    ZERO_ADDRESS,
                    1000,
                    getTestAddr(SELLER),
                    1000,
                    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                    250,
                  ]
                ),
                [2]: scillaJSONVal(
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128.ByStr20.Uint128.ByStr20.Uint128`,
                  [
                    getTestAddr(SELLER),
                    globalBNum + 5,
                    ZERO_ADDRESS,
                    1000,
                    getTestAddr(SELLER),
                    1000,
                    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                    250,
                  ]
                ),
              },
            })
          );
        },
      },
    },

    {
      name: "throws NotAllowedUserError",
      transition: "Bid",
      txAmount: 11000,
      getSender: () => getTestAddr(FORBIDDEN),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 11000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotAllowedUserError,
      want: undefined,
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
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
                [1]: scillaJSONVal(
                  `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`,
                  [getTestAddr(BUYER_B), 11000, getTestAddr(BUYER_B), 2]
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
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
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

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
      name: "Seller finalizes the auction without buy order",
      transition: "End",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
      }),
      beforeTransition: async () => {
        for (const call of [
          {
            beforeTransition: asyncNoop,
            sender: getTestAddr(SELLER),
            contract: globalMarketplaceAddress,
            transition: "Start",
            transitionParams: scillaJSONParams({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              payment_token_address: ["ByStr20", ZERO_ADDRESS],
              start_amount: ["Uint128", 1000],
              expiration_bnum: ["BNum", globalBNum + 5],
            }),
            txParams: TX_PARAMS,
          },
        ]) {
          await call.beforeTransition();
          zilliqa.wallet.setDefault(call.sender);
          const tx: any = await zilliqa.contracts
            .at(call.contract)
            .call(call.transition, call.transitionParams, call.txParams);
          if (!tx.receipt.success) {
            throw new Error();
          }
        }
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: globalMarketplaceAddress,
          3: getTestAddr(SELLER),
        }),
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
            name: "End",
            getParams: () => ({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              payment_token_address: ["ByStr20", ZERO_ADDRESS],
              sale_price: ["Uint128", 0],
              seller: ["ByStr20", getTestAddr(SELLER)],
              buyer: ["ByStr20", ZERO_ADDRESS],
              asset_recipient: ["ByStr20", getTestAddr(SELLER)],
              payment_tokens_recipient: ["ByStr20", ZERO_ADDRESS],
              royalty_recipient: ["ByStr20", ZERO_ADDRESS],
              royalty_amount: ["Uint128", 0],
              service_fee: ["Uint128", 0],
            }),
          },
        ],
        expectState: (state) => {
          // preconditions must not be mutated
          expect(JSON.stringify(state.sell_orders)).toBe(
            JSON.stringify({
              [globalTokenAddress.toLowerCase()]: {
                [1]: scillaJSONVal(
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128.ByStr20.Uint128.ByStr20.Uint128`,
                  [
                    getTestAddr(SELLER),
                    globalBNum + 5,
                    ZERO_ADDRESS,
                    1000,
                    getTestAddr(SELLER),
                    1000,
                    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                    250,
                  ]
                ),
              },
            })
          );

          // preconditions are must not be mutated
          expect(JSON.stringify(state.buy_orders)).toBe(
            JSON.stringify({
              [globalTokenAddress.toLowerCase()]: {
                [1]: scillaJSONVal(
                  `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`,
                  [getTestAddr(BUYER_A), 10000, getTestAddr(BUYER_A), 1]
                ),
              },
            })
          );

          expect(
            JSON.stringify(
              state.assets[getTestAddr(SELLER).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]["2"]
            )
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

          expect(JSON.stringify(state.payment_tokens)).toBe(`{}`);
        },
      },
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
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
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              ZERO_ADDRESS.toLowerCase()
            ]
          ).toBe(`${8750 + 1000}`);

          expect(
            state.payment_tokens[
              getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
            ][ZERO_ADDRESS]
          ).toBe("250");
        },
      },
    },
    {
      name: "Buyer A finalizes the auction",
      transition: "End",
      getSender: () => getTestAddr(BUYER_A),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
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
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              ZERO_ADDRESS.toLowerCase()
            ]
          ).toBe(`${8750 + 1000}`);

          expect(
            state.payment_tokens[
              getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
            ][ZERO_ADDRESS]
          ).toBe("250");
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        balanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getBalanceDeltas()),
          zilBalancesGetter(zilliqa)
        );
        await balanceTracker.init();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(testCase.transition, scillaJSONParams(testCase.getParams()), {
          ...TX_PARAMS,
          amount: new BN(testCase.txAmount || 0),
        });

      if (testCase.want === undefined) {
        // Negative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);
        testCase.want.expectState(
          await zilliqa.contracts.at(globalMarketplaceAddress).getState()
        );
        expectTokenOwners(
          (await zilliqa.contracts.at(globalTokenAddress).getState())[
            "token_owners"
          ],
          testCase.want.getTokenOwners()
        );
        expectDeltas(
          await balanceTracker.deltas(),
          await testCase.want?.getBalanceDeltas(),
          tx,
          testCase.getSender()
        );
      }
    });
  }
});

describe("WZIL - Auction", () => {
  beforeEach(async () => {
    for (const call of [
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "Start",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          payment_token_address: ["ByStr20", globalPaymentTokenAddress],
          start_amount: ["Uint128", 1000],
          expiration_bnum: ["BNum", globalBNum + 5],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(BUYER_A),
        contract: globalMarketplaceAddress,
        transition: "Bid",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          amount: ["Uint128", 10000],
          dest: ["ByStr20", getTestAddr(BUYER_A)],
        }),
        txParams: TX_PARAMS,
      },
    ]) {
      await call.beforeTransition();
      zilliqa.wallet.setDefault(call.sender);
      const tx: any = await zilliqa.contracts
        .at(call.contract)
        .call(call.transition, call.transitionParams, call.txParams);
      if (!tx.receipt.success) {
        throw new Error();
      }
    }

    const res = await zilliqa.blockchain.getBalance(globalMarketplaceAddress);
    expect(res.result.balance).toBe("0");

    const state = await zilliqa.contracts
      .at(globalMarketplaceAddress)
      .getState();

    expect(JSON.stringify(state.sell_orders)).toBe(
      JSON.stringify({
        [globalTokenAddress.toLowerCase()]: {
          [1]: scillaJSONVal(
            `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128.ByStr20.Uint128.ByStr20.Uint128`,
            [
              getTestAddr(SELLER),
              globalBNum + 5,
              globalPaymentTokenAddress,
              1000,
              getTestAddr(SELLER),
              1000,
              getTestAddr(MARKETPLACE_CONTRACT_OWNER),
              250,
            ]
          ),
        },
      })
    );

    expect(JSON.stringify(state.buy_orders)).toBe(
      JSON.stringify({
        [globalTokenAddress.toLowerCase()]: {
          [1]: scillaJSONVal(
            `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`,
            [getTestAddr(BUYER_A), 10000, getTestAddr(BUYER_A), 1]
          ),
        },
      })
    );
  });

  const testCases = [
    {
      name: "throws NotAllowedUserError",
      transition: "Start",
      getSender: () => getTestAddr(FORBIDDEN),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 2],
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
        start_amount: ["Uint128", 1000],
        expiration_bnum: ["BNum", globalBNum + 5],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotAllowedUserError,
      want: undefined,
    },
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: globalMarketplaceAddress,
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
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
                [1]: scillaJSONVal(
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128.ByStr20.Uint128.ByStr20.Uint128`,
                  [
                    getTestAddr(SELLER),
                    globalBNum + 5,
                    globalPaymentTokenAddress,
                    1000,
                    getTestAddr(SELLER),
                    1000,
                    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                    250,
                  ]
                ),
                [2]: scillaJSONVal(
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128.ByStr20.Uint128.ByStr20.Uint128`,
                  [
                    getTestAddr(SELLER),
                    globalBNum + 5,
                    globalPaymentTokenAddress,
                    1000,
                    getTestAddr(SELLER),
                    1000,
                    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                    250,
                  ]
                ),
              },
            })
          );
        },
      },
    },

    {
      name: "throws NotAllowedUserError",
      transition: "Bid",
      getSender: () => getTestAddr(FORBIDDEN),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
        amount: ["Uint128", 11000],
        dest: ["ByStr20", getTestAddr(BUYER_B)],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.NotAllowedUserError,
      want: undefined,
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 11000,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: -11000,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: -11000,
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
                [1]: scillaJSONVal(
                  `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`,
                  [getTestAddr(BUYER_B), 11000, getTestAddr(BUYER_B), 2]
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
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
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

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
        token_id: ["Uint256", 2],
      }),
      beforeTransition: async () => {
        for (const call of [
          {
            beforeTransition: asyncNoop,
            sender: getTestAddr(SELLER),
            contract: globalMarketplaceAddress,
            transition: "Start",
            transitionParams: scillaJSONParams({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              payment_token_address: ["ByStr20", globalPaymentTokenAddress],
              start_amount: ["Uint128", 1000],
              expiration_bnum: ["BNum", globalBNum + 5],
            }),
            txParams: TX_PARAMS,
          },
        ]) {
          await call.beforeTransition();
          zilliqa.wallet.setDefault(call.sender);
          const tx: any = await zilliqa.contracts
            .at(call.contract)
            .call(call.transition, call.transitionParams, call.txParams);
          if (!tx.receipt.success) {
            throw new Error();
          }
        }
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: globalMarketplaceAddress,
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
        }),
        events: [
          {
            name: "End",
            getParams: () => ({
              token_address: ["ByStr20", globalTokenAddress],
              token_id: ["Uint256", 2],
              payment_token_address: ["ByStr20", globalPaymentTokenAddress],
              sale_price: ["Uint128", 0],
              seller: ["ByStr20", getTestAddr(SELLER)],
              buyer: ["ByStr20", ZERO_ADDRESS],
              asset_recipient: ["ByStr20", getTestAddr(SELLER)],
              payment_tokens_recipient: ["ByStr20", ZERO_ADDRESS],
              royalty_recipient: ["ByStr20", ZERO_ADDRESS],
              royalty_amount: ["Uint128", 0],
              service_fee: ["Uint128", 0],
            }),
          },
        ],
        expectState: (state) => {
          expect(JSON.stringify(state.sell_orders)).toBe(
            JSON.stringify({
              [globalTokenAddress.toLowerCase()]: {
                [1]: scillaJSONVal(
                  `${globalMarketplaceAddress}.SellOrder.SellOrder.of.ByStr20.BNum.ByStr20.Uint128.ByStr20.Uint128.ByStr20.Uint128`,
                  [
                    getTestAddr(SELLER),
                    globalBNum + 5,
                    globalPaymentTokenAddress,
                    1000,
                    getTestAddr(SELLER),
                    1000,
                    getTestAddr(MARKETPLACE_CONTRACT_OWNER),
                    250,
                  ]
                ),
              },
            })
          );

          expect(JSON.stringify(state.buy_orders)).toBe(
            JSON.stringify({
              [globalTokenAddress.toLowerCase()]: {
                [1]: scillaJSONVal(
                  `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`,
                  [getTestAddr(BUYER_A), 10000, getTestAddr(BUYER_A), 1]
                ),
              },
            })
          );

          expect(
            JSON.stringify(
              state.assets[getTestAddr(SELLER).toLowerCase()][
                globalTokenAddress.toLowerCase()
              ]["2"]
            )
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

          expect(JSON.stringify(state.payment_tokens)).toBe(`{}`);
        },
      },
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
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
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              globalPaymentTokenAddress.toLowerCase()
            ]
          ).toBe(`${8750 + 1000}`);

          expect(
            state.payment_tokens[
              getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
            ][globalPaymentTokenAddress.toLowerCase()]
          ).toBe("250");
        },
      },
    },
    {
      name: "Buyer A finalizes the auction",
      transition: "End",
      getSender: () => getTestAddr(BUYER_A),
      getParams: () => ({
        token_address: ["ByStr20", globalTokenAddress],
        token_id: ["Uint256", 1],
      }),
      beforeTransition: async () => {
        await increaseBNum(zilliqa, 5);
      },
      error: undefined,
      want: {
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
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
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              globalPaymentTokenAddress.toLowerCase()
            ]
          ).toBe(`${8750 + 1000}`);

          expect(
            state.payment_tokens[
              getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
            ][globalPaymentTokenAddress.toLowerCase()]
          ).toBe("250");
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        balanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getBalanceDeltas()),
          zrc2BalancesGetter(zilliqa, globalPaymentTokenAddress)
        );
        await balanceTracker.init();
      }

      let allowanceTracker;
      if (testCase.want) {
        allowanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getAllowanceDeltas()),
          zrc2AllowncesGetter(zilliqa, globalPaymentTokenAddress)
        );
        await allowanceTracker.init();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(
          testCase.transition,
          scillaJSONParams(testCase.getParams()),
          TX_PARAMS
        );

      if (testCase.want === undefined) {
        // Negative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);
        testCase.want.expectState(
          await zilliqa.contracts.at(globalMarketplaceAddress).getState()
        );
        expectTokenOwners(
          (await zilliqa.contracts.at(globalTokenAddress).getState())[
            "token_owners"
          ],
          testCase.want.getTokenOwners()
        );
        expectDeltas(
          await balanceTracker.deltas(),
          await testCase.want?.getBalanceDeltas()
        );
        expectDeltas(
          await allowanceTracker.deltas(),
          await testCase.want?.getAllowanceDeltas()
        );
      }
    });
  }
});

describe("ZIL - Withdraw", () => {
  beforeEach(async () => {
    for (const call of [
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "Start",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          payment_token_address: ["ByStr20", ZERO_ADDRESS],
          start_amount: ["Uint128", 1000],
          expiration_bnum: ["BNum", globalBNum + 5],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(BUYER_A),
        contract: globalMarketplaceAddress,
        transition: "Bid",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          amount: ["Uint128", 10000],
          dest: ["ByStr20", getTestAddr(BUYER_A)],
        }),
        txParams: { ...TX_PARAMS, amount: new BN("10000") },
      },
      {
        beforeTransition: async () => {
          await increaseBNum(zilliqa, 5);
        },
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "End",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
        }),
        txParams: TX_PARAMS,
      },
    ]) {
      await call.beforeTransition();
      zilliqa.wallet.setDefault(call.sender);
      const tx: any = await zilliqa.contracts
        .at(call.contract)
        .call(call.transition, call.transitionParams, call.txParams);
      if (!tx.receipt.success) {
        throw new Error();
      }
    }

    const res = await zilliqa.blockchain.getBalance(globalMarketplaceAddress);
    expect(res.result.balance).toBe("10000");

    const state = await zilliqa.contracts
      .at(globalMarketplaceAddress)
      .getState();

    expect(
      JSON.stringify(
        state.assets[getTestAddr(BUYER_A).toLowerCase()][
          globalTokenAddress.toLowerCase()
        ]["1"]
      )
    ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

    expect(
      state.payment_tokens[getTestAddr(SELLER).toLowerCase()][ZERO_ADDRESS]
    ).toBe(`${8750 + 1000}`);

    expect(
      state.payment_tokens[
        getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
      ][ZERO_ADDRESS]
    ).toBe("250");
  });

  const testCases = [
    {
      name: "throws AccountNotFoundError",
      transition: "WithdrawPaymentTokens",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.AccountNotFoundError,
      want: undefined,
    },
    {
      name: "Seller withdraws payment tokens",
      transition: "WithdrawPaymentTokens",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        payment_token_address: ["ByStr20", ZERO_ADDRESS],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: -9750,
          [getTestAddr(SELLER)]: 9750,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
        }),
        events: [
          {
            name: "WithdrawPaymentTokens",
            getParams: () => ({
              recipient: ["ByStr20", getTestAddr(SELLER)],
              payment_token_address: ["ByStr20", ZERO_ADDRESS],
              amount: ["Uint128", 9750],
            }),
          },
          {
            name: "TransferSuccess",
            getParams: () => ({
              sender: ["ByStr20", globalMarketplaceAddress],
              recipient: ["ByStr20", getTestAddr(SELLER)],
              amount: ["Uint128", 9750],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(
              state.payment_tokens[getTestAddr(SELLER).toLowerCase()]
            )
          ).toBe("{}");

          expect(
            state.payment_tokens[
              getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
            ][ZERO_ADDRESS]
          ).toBe("250");
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
        getTokenOwners: () => ({
          1: getTestAddr(BUYER_A),
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
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
      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        balanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getBalanceDeltas()),
          zilBalancesGetter(zilliqa)
        );
        await balanceTracker.init();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(testCase.transition, scillaJSONParams(testCase.getParams()), {
          ...TX_PARAMS,
        });

      if (testCase.want === undefined) {
        // Negative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);
        testCase.want.expectState(
          await zilliqa.contracts.at(globalMarketplaceAddress).getState()
        );
        expectTokenOwners(
          (await zilliqa.contracts.at(globalTokenAddress).getState())[
            "token_owners"
          ],
          testCase.want.getTokenOwners()
        );
        expectDeltas(
          await balanceTracker.deltas(),
          await testCase.want?.getBalanceDeltas(),
          tx,
          testCase.getSender()
        );
      }
    });
  }
});

describe("WZIL - Withdraw", () => {
  beforeEach(async () => {
    for (const call of [
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "Start",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          payment_token_address: ["ByStr20", globalPaymentTokenAddress],
          start_amount: ["Uint128", 1000],
          expiration_bnum: ["BNum", globalBNum + 5],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(BUYER_A),
        contract: globalMarketplaceAddress,
        transition: "Bid",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          amount: ["Uint128", 10000],
          dest: ["ByStr20", getTestAddr(BUYER_A)],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: async () => {
          await increaseBNum(zilliqa, 5);
        },
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "End",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
        }),
        txParams: TX_PARAMS,
      },
    ]) {
      await call.beforeTransition();
      zilliqa.wallet.setDefault(call.sender);
      const tx: any = await zilliqa.contracts
        .at(call.contract)
        .call(call.transition, call.transitionParams, call.txParams);
      if (!tx.receipt.success) {
        throw new Error();
      }
    }

    const res = await zilliqa.blockchain.getBalance(globalMarketplaceAddress);
    expect(res.result.balance).toBe("0");

    const state = await zilliqa.contracts
      .at(globalMarketplaceAddress)
      .getState();

    expect(
      JSON.stringify(
        state.assets[getTestAddr(BUYER_A).toLowerCase()][
          globalTokenAddress.toLowerCase()
        ]["1"]
      )
    ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

    expect(
      state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
        globalPaymentTokenAddress.toLowerCase()
      ]
    ).toBe(`${8750 + 1000}`);

    expect(
      state.payment_tokens[
        getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
      ][globalPaymentTokenAddress.toLowerCase()]
    ).toBe("250");
  });

  const testCases = [
    {
      name: "throws AccountNotFoundError",
      transition: "WithdrawPaymentTokens",
      getSender: () => getTestAddr(STRANGER),
      getParams: () => ({
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
      }),
      beforeTransition: asyncNoop,
      error: ENG_AUC_ERROR.AccountNotFoundError,
      want: undefined,
    },
    {
      name: "Seller withdraws payment tokens",
      transition: "WithdrawPaymentTokens",
      getSender: () => getTestAddr(SELLER),
      getParams: () => ({
        payment_token_address: ["ByStr20", globalPaymentTokenAddress],
      }),
      beforeTransition: asyncNoop,
      error: undefined,
      want: {
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: -9750,
          [getTestAddr(SELLER)]: 9750,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
        }),
        events: [
          {
            name: "WithdrawPaymentTokens",
            getParams: () => ({
              recipient: ["ByStr20", getTestAddr(SELLER)],
              payment_token_address: ["ByStr20", globalPaymentTokenAddress],
              amount: ["Uint128", 9750],
            }),
          },
          {
            name: "TransferSuccess",
            getParams: () => ({
              sender: ["ByStr20", globalMarketplaceAddress.toLowerCase()],
              recipient: ["ByStr20", getTestAddr(SELLER)],
              amount: ["Uint128", 9750],
            }),
          },
        ],
        expectState: (state) => {
          expect(
            JSON.stringify(
              state.payment_tokens[getTestAddr(SELLER).toLowerCase()]
            )
          ).toBe("{}");

          expect(
            state.payment_tokens[
              getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
            ][globalPaymentTokenAddress.toLowerCase()]
          ).toBe("250");
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
        getTokenOwners: () => ({
          1: getTestAddr(BUYER_A),
          2: getTestAddr(SELLER),
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
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
      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        balanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getBalanceDeltas()),
          zrc2BalancesGetter(zilliqa, globalPaymentTokenAddress)
        );
        await balanceTracker.init();
      }

      let allowanceTracker;
      if (testCase.want) {
        allowanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getAllowanceDeltas()),
          zrc2AllowncesGetter(zilliqa, globalPaymentTokenAddress)
        );
        await allowanceTracker.init();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(
          testCase.transition,
          scillaJSONParams(testCase.getParams()),
          TX_PARAMS
        );

      if (testCase.want === undefined) {
        // Negative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);
        testCase.want.expectState(
          await zilliqa.contracts.at(globalMarketplaceAddress).getState()
        );
        expectTokenOwners(
          (await zilliqa.contracts.at(globalTokenAddress).getState())[
            "token_owners"
          ],
          testCase.want.getTokenOwners()
        );
        expectDeltas(
          await balanceTracker.deltas(),
          await testCase.want?.getBalanceDeltas()
        );
        expectDeltas(
          await allowanceTracker.deltas(),
          await testCase.want?.getAllowanceDeltas()
        );
      }
    });
  }
});

describe("ZIL - Balance", () => {
  beforeEach(async () => {
    for (const call of [
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "Start",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          payment_token_address: ["ByStr20", ZERO_ADDRESS],
          start_amount: ["Uint128", 1000],
          expiration_bnum: ["BNum", globalBNum + 5],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "Start",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 2],
          payment_token_address: ["ByStr20", ZERO_ADDRESS],
          start_amount: ["Uint128", 1000],
          expiration_bnum: ["BNum", globalBNum + 10],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(BUYER_A),
        contract: globalMarketplaceAddress,
        transition: "Bid",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          amount: ["Uint128", 10000],
          dest: ["ByStr20", getTestAddr(BUYER_A)],
        }),
        txParams: { ...TX_PARAMS, amount: new BN("10000") },
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(BUYER_B),
        contract: globalMarketplaceAddress,
        transition: "Bid",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 2],
          amount: ["Uint128", 10000],
          dest: ["ByStr20", getTestAddr(BUYER_B)],
        }),
        txParams: { ...TX_PARAMS, amount: new BN("10000") },
      },
      {
        beforeTransition: async () => {
          await increaseBNum(zilliqa, 5);
        },
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "End",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
        }),
        txParams: TX_PARAMS,
      },
    ]) {
      await call.beforeTransition();
      zilliqa.wallet.setDefault(call.sender);
      const tx: any = await zilliqa.contracts
        .at(call.contract)
        .call(call.transition, call.transitionParams, call.txParams);
      if (!tx.receipt.success) {
        throw new Error();
      }
    }

    const res = await zilliqa.blockchain.getBalance(globalMarketplaceAddress);
    expect(res.result.balance).toBe(`${2 * 10000}`);

    const state = await zilliqa.contracts
      .at(globalMarketplaceAddress)
      .getState();

    expect(
      JSON.stringify(
        state.assets[getTestAddr(BUYER_A).toLowerCase()][
          globalTokenAddress.toLowerCase()
        ]["1"]
      )
    ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

    expect(
      state.payment_tokens[getTestAddr(SELLER).toLowerCase()][ZERO_ADDRESS]
    ).toBe(`${8750 + 1000}`);

    expect(
      state.payment_tokens[
        getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
      ][ZERO_ADDRESS]
    ).toBe("250");
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: globalMarketplaceAddress,
          3: getTestAddr(SELLER),
        }),
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
              [2]: scillaJSONVal(
                `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`,
                [getTestAddr(BUYER_A), 11000, getTestAddr(BUYER_A), 2]
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: globalMarketplaceAddress,
          3: getTestAddr(SELLER),
        }),
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
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              ZERO_ADDRESS.toLowerCase()
            ]
          ).toBe(((8750 + 1000) * 2).toString());

          expect(
            state.payment_tokens[
              getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
            ][ZERO_ADDRESS]
          ).toBe(`${250 * 2}`);
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        balanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getBalanceDeltas()),
          zilBalancesGetter(zilliqa)
        );
        await balanceTracker.init();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(testCase.transition, scillaJSONParams(testCase.getParams()), {
          ...TX_PARAMS,
          amount: new BN(testCase.txAmount || 0),
        });

      if (testCase.want === undefined) {
        // Negative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);
        testCase.want.expectState(
          await zilliqa.contracts.at(globalMarketplaceAddress).getState()
        );
        expectTokenOwners(
          (await zilliqa.contracts.at(globalTokenAddress).getState())[
            "token_owners"
          ],
          testCase.want.getTokenOwners()
        );
        expectDeltas(
          await balanceTracker.deltas(),
          await testCase.want?.getBalanceDeltas(),
          tx,
          testCase.getSender()
        );
      }
    });
  }
});

describe("WZIL - Balance", () => {
  beforeEach(async () => {
    for (const call of [
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "Start",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          payment_token_address: ["ByStr20", globalPaymentTokenAddress],
          start_amount: ["Uint128", 1000],
          expiration_bnum: ["BNum", globalBNum + 5],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "Start",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 2],
          payment_token_address: ["ByStr20", globalPaymentTokenAddress],
          start_amount: ["Uint128", 1000],
          expiration_bnum: ["BNum", globalBNum + 10],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(BUYER_A),
        contract: globalMarketplaceAddress,
        transition: "Bid",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
          amount: ["Uint128", 10000],
          dest: ["ByStr20", getTestAddr(BUYER_A)],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: asyncNoop,
        sender: getTestAddr(BUYER_B),
        contract: globalMarketplaceAddress,
        transition: "Bid",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 2],
          amount: ["Uint128", 10000],
          dest: ["ByStr20", getTestAddr(BUYER_B)],
        }),
        txParams: TX_PARAMS,
      },
      {
        beforeTransition: async () => {
          await increaseBNum(zilliqa, 5);
        },
        sender: getTestAddr(SELLER),
        contract: globalMarketplaceAddress,
        transition: "End",
        transitionParams: scillaJSONParams({
          token_address: ["ByStr20", globalTokenAddress],
          token_id: ["Uint256", 1],
        }),
        txParams: TX_PARAMS,
      },
    ]) {
      await call.beforeTransition();
      zilliqa.wallet.setDefault(call.sender);
      const tx: any = await zilliqa.contracts
        .at(call.contract)
        .call(call.transition, call.transitionParams, call.txParams);
      if (!tx.receipt.success) {
        throw new Error();
      }
    }

    const res = await zilliqa.blockchain.getBalance(globalMarketplaceAddress);
    expect(res.result.balance).toBe("0");

    const state = await zilliqa.contracts
      .at(globalMarketplaceAddress)
      .getState();

    expect(
      JSON.stringify(
        state.assets[getTestAddr(BUYER_A).toLowerCase()][
          globalTokenAddress.toLowerCase()
        ]["1"]
      )
    ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

    expect(
      state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
        globalPaymentTokenAddress.toLowerCase()
      ]
    ).toBe(`${8750 + 1000}`);

    expect(
      state.payment_tokens[
        getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
      ][globalPaymentTokenAddress.toLowerCase()]
    ).toBe("250");
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: globalMarketplaceAddress,
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 11000,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: -11000,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: -11000,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
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
              [2]: scillaJSONVal(
                `${globalMarketplaceAddress}.BuyOrder.BuyOrder.of.ByStr20.Uint128.ByStr20.Uint128`,
                [getTestAddr(BUYER_A), 11000, getTestAddr(BUYER_A), 2]
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
        getTokenOwners: () => ({
          1: globalMarketplaceAddress,
          2: globalMarketplaceAddress,
          3: getTestAddr(SELLER),
        }),
        getBalanceDeltas: () => ({
          [globalMarketplaceAddress]: 0,
          [getTestAddr(SELLER)]: 0,
          [getTestAddr(BUYER_A)]: 0,
          [getTestAddr(BUYER_B)]: 0,
          [getTestAddr(MARKETPLACE_CONTRACT_OWNER)]: 0,
          [getTestAddr(STRANGER)]: 0,
        }),
        getAllowanceDeltas: () => ({
          [[getTestAddr(BUYER_A), globalMarketplaceAddress].join()]: 0,
          [[getTestAddr(BUYER_B), globalMarketplaceAddress].join()]: 0,
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
          ).toBe(JSON.stringify(scillaJSONVal("Bool", true)));

          expect(
            state.payment_tokens[getTestAddr(SELLER).toLowerCase()][
              globalPaymentTokenAddress.toLowerCase()
            ]
          ).toBe(((8750 + 1000) * 2).toString());

          expect(
            state.payment_tokens[
              getTestAddr(MARKETPLACE_CONTRACT_OWNER).toLowerCase()
            ][globalPaymentTokenAddress.toLowerCase()]
          ).toBe(`${250 * 2}`);
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      await testCase.beforeTransition();

      let balanceTracker;
      if (testCase.want) {
        balanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getBalanceDeltas()),
          zrc2BalancesGetter(zilliqa, globalPaymentTokenAddress)
        );
        await balanceTracker.init();
      }

      let allowanceTracker;
      if (testCase.want) {
        allowanceTracker = new BalanceTracker(
          zilliqa,
          Object.keys(await testCase.want.getAllowanceDeltas()),
          zrc2AllowncesGetter(zilliqa, globalPaymentTokenAddress)
        );
        await allowanceTracker.init();
      }

      zilliqa.wallet.setDefault(testCase.getSender());
      const tx: any = await zilliqa.contracts
        .at(globalMarketplaceAddress)
        .call(
          testCase.transition,
          scillaJSONParams(testCase.getParams()),
          TX_PARAMS
        );

      if (testCase.want === undefined) {
        // Negative Cases
        expect(tx.receipt.success).toBe(false);
        expect(tx.receipt.exceptions[0].message).toBe(
          getErrorMsg(testCase.error)
        );
      } else {
        // Positive Cases
        expect(tx.receipt.success).toBe(true);
        expectEvents(tx.receipt.event_logs, testCase.want.events);
        testCase.want.expectState(
          await zilliqa.contracts.at(globalMarketplaceAddress).getState()
        );
        expectTokenOwners(
          (await zilliqa.contracts.at(globalTokenAddress).getState())[
            "token_owners"
          ],
          testCase.want.getTokenOwners()
        );
        expectDeltas(
          await balanceTracker.deltas(),
          await testCase.want?.getBalanceDeltas()
        );
        expectDeltas(
          await allowanceTracker.deltas(),
          await testCase.want?.getAllowanceDeltas()
        );
      }
    });
  }
});
