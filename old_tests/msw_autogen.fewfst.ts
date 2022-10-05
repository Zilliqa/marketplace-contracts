import { scillaJSONParams } from "@zilliqa-js/scilla-json-utils";

import { Zilliqa } from "@zilliqa-js/zilliqa";
import { expect } from "@jest/globals";
import fs from "fs";
import { getAddressFromPrivateKey, schnorr } from "@zilliqa-js/crypto";

import { API, TX_PARAMS, CONTRACTS, FAUCET_PARAMS, asyncNoop } from "./config";

const JEST_WORKER_ID = Number(process.env["JEST_WORKER_ID"]);
const GENESIS_PRIVATE_KEY = global.GENESIS_PRIVATE_KEYS[JEST_WORKER_ID - 1];

const zilliqa = new Zilliqa(API);
zilliqa.wallet.addByPrivateKey(GENESIS_PRIVATE_KEY);

let globalMSWAddress;
let globalAllowlistAddress;

let globalTestAccounts: Array<{
  privateKey: string;
  address: string;
}> = [];
const OWNER_A = 0;
const OWNER_B = 1;

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
    OWNER_A: getTestAddr(OWNER_A),
    OWNER_B: getTestAddr(OWNER_B),
  });
});

beforeEach(async () => {
  zilliqa.wallet.setDefault(getTestAddr(OWNER_A));
  let [, contract] = await zilliqa.contracts
    .new(
      fs.readFileSync(CONTRACTS.msw.path).toString(),
      scillaJSONParams({
        _scilla_version: ["Uint32", 0],
        owner_list: [
          "List (ByStr20)",
          [OWNER_A, OWNER_B].map((x) => getTestAddr(x)),
        ],
        num_of_required_signatures: ["Uint32", 1],
      })
    )
    .deploy(TX_PARAMS, 33, 1000, true);
  globalMSWAddress = contract.address;
  if (globalMSWAddress === undefined) {
    throw new Error();
  }

  zilliqa.wallet.setDefault(getTestAddr(OWNER_A));
  [, contract] = await zilliqa.contracts
    .new(
      fs.readFileSync(CONTRACTS.allowlist.path).toString(),
      scillaJSONParams({
        _scilla_version: ["Uint32", 0],
        initial_contract_owner: ["ByStr20", globalMSWAddress],
      })
    )
    .deploy(TX_PARAMS, 33, 1000, true);
  globalAllowlistAddress = contract.address;
  if (globalAllowlistAddress === undefined) {
    throw new Error();
  }

  for (const call of [
    {
      beforeTransition: asyncNoop,
      sender: getTestAddr(OWNER_A),
      contract: globalMSWAddress,
      transition: "SubmitCustomTransaction",
      transitionParams: scillaJSONParams({
        contract_address: ["ByStr20", globalAllowlistAddress],
        transaction: [
          `${globalMSWAddress}.MultiSigTransition.Allow.of.List (ByStr20)`,
          [[getTestAddr(OWNER_A), getTestAddr(OWNER_B)]],
        ],
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
});

describe("Allowlist", () => {
  const testCases = [
    {
      name: "ExecuteTransaction: Allowlist::Allow",
      transition: "ExecuteTransaction",
      getSender: () => getTestAddr(OWNER_A),
      getParams: () => ({
        transaction_id: ["Uint32", 0],
      }),
      want: {
        expectState: (state) => {
          const result = [OWNER_A, OWNER_A]
            .map((x) => getTestAddr(x).toLowerCase())
            .every((x) => Object.keys(state.allowed_addresses).includes(x));

          expect(result).toBe(true);
        },
      },
    },
  ];

  for (const testCase of testCases) {
    it(`${testCase.transition}: ${testCase.name}`, async () => {
      zilliqa.wallet.setDefault(testCase.getSender());

      const tx: any = await zilliqa.contracts
        .at(globalMSWAddress)
        .call(testCase.transition, scillaJSONParams(testCase.getParams()), {
          ...TX_PARAMS,
        });

      // Positive Cases
      expect(tx.receipt.success).toBe(true);
      testCase.want.expectState(
        await zilliqa.contracts.at(globalAllowlistAddress).getState()
      );
    });
  }
});
