/* eslint-disable no-undef */
require("dotenv").config({ path: "./.env" });
const { getAddressFromPrivateKey } = require("@zilliqa-js/crypto");
const {
  deployAllowlistContract,
} = require("../scripts/marketplace/deployAllowlistContract.js");
const {
  setupBalancesOnAccounts,
  clearBalancesOnAccounts,
} = require("../scripts/utils/call.js");

const { callContract } = require("../scripts/utils/call.js");
const { zilliqa } = require("../scripts/utils/zilliqa.js");

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
};

let allowlistAddress;

beforeAll(async () => {
  await setupBalancesOnAccounts(accounts);
});

afterAll(async () => {
  await clearBalancesOnAccounts(accounts);
});

describe("AllowList", () => {
  beforeEach(async () => {
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
  });

  test("AllowList: add wallets to allow list", async () => {
    const allowlistContract = await zilliqa.contracts.at(allowlistAddress);
    const tx = await callContract(
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
    expect(tx.receipt.success).toEqual(true);
  });

  test("AllowList: add wallets to allow list while paused", async () => {
    const allowlistContract = await zilliqa.contracts.at(allowlistAddress);

    // Pause
    const pauseTx = await callContract(
      accounts.contractOwner.privateKey,
      allowlistContract,
      "Pause",
      [],
      0,
      false,
      false
    );
    expect(pauseTx.receipt.success).toEqual(true);

    // Add Wallet to Allow
    const tx = await callContract(
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
    expect(tx.receipt.success).toEqual(false);

    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -3))])',
      },
      {
        line: 1,
        message: "Raised from Allow",
      },
    ]);
  });

  test("AllowList: add wallets to allow list while not owner", async () => {
    const allowlistContract = await zilliqa.contracts.at(allowlistAddress);
    const tx = await callContract(
      accounts.stranger.privateKey,
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
    expect(tx.receipt.success).toEqual(false);
    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -1))])',
      },
      { line: 1, message: "Raised from RequireNotPaused" },
      { line: 1, message: "Raised from Allow" },
    ]);
  });

  test("AllowList: remove wallets from allow list", async () => {
    const allowlistContract = await zilliqa.contracts.at(allowlistAddress);
    const tx = await callContract(
      accounts.contractOwner.privateKey,
      allowlistContract,
      "Disallow",
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
    expect(tx.receipt.success).toEqual(true);
  });

  test("AllowList: remove wallets from allow list while paused", async () => {
    const allowlistContract = await zilliqa.contracts.at(allowlistAddress);

    // Pause
    const pauseTx = await callContract(
      accounts.contractOwner.privateKey,
      allowlistContract,
      "Pause",
      [],
      0,
      false,
      false
    );
    expect(pauseTx.receipt.success).toEqual(true);

    // Remove Wallet
    const tx = await callContract(
      accounts.contractOwner.privateKey,
      allowlistContract,
      "Disallow",
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
    expect(tx.receipt.success).toEqual(false);

    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -3))])',
      },
      { line: 1, message: "Raised from Disallow" },
    ]);
  });

  test("AllowList: remove wallets from allow list while not owner", async () => {
    const allowlistContract = await zilliqa.contracts.at(allowlistAddress);
    const tx = await callContract(
      accounts.stranger.privateKey,
      allowlistContract,
      "Disallow",
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
    expect(tx.receipt.success).toEqual(false);

    expect(tx.receipt.exceptions).toEqual([
      {
        line: 1,
        message:
          'Exception thrown: (Message [(_exception : (String "Error")) ; (code : (Int32 -1))])',
      },
      { line: 1, message: "Raised from RequireNotPaused" },
      { line: 1, message: "Raised from Disallow" },
    ]);
  });
});
