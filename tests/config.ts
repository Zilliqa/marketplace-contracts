import { bytes, units } from "@zilliqa-js/util";
import { Long, BN } from "@zilliqa-js/util";

export const API = `http://localhost:${process.env["PORT"]}`; // Zilliqa Isolated Server
export const CHAIN_ID = 222;
export const MSG_VERSION = 1;
export const VERSION = bytes.pack(CHAIN_ID, MSG_VERSION);
export const asyncNoop = async () => undefined;
export const CONTRACTS = {
  zrc6: {
    path: "tests/zrc6.scilla",
    baseURI: "https://creatures-api.zilliqa.com/api/creature/",
    name: "Test",
    symbol: "T",
  },
  wzil: {
    path: "tests/wrapped_zil.scilla",
    name: "Wrapped ZIL",
    symbol: "wZIL",
    decimal: "12",
    initial_supply: "1000000000000000",
  },
  msw: {
    path: "contracts/msw.scilla",
  },
  allowlist: {
    path: "contracts/allowlist.scilla",
  },
  fixed_price: {
    path: "contracts/fixed_price.scilla",
  },
  english_auction: {
    path: "contracts/english_auction.scilla",
  },
};

const GAS_LIMIT = Long.fromNumber(100000);
export const GAS_PRICE = units.toQa("2000", units.Units.Li);

export const TX_PARAMS = {
  version: VERSION,
  amount: new BN(0),
  gasPrice: GAS_PRICE,
  gasLimit: GAS_LIMIT,
};

export const FAUCET_PARAMS = {
  version: VERSION,
  amount: new BN(units.toQa("100000000", units.Units.Zil)),
  gasPrice: GAS_PRICE,
  gasLimit: Long.fromNumber(50),
};

export const FIXED_PRICE_ERROR = {
  NotContractOwnerError: -1,
  NotPausedError: -2,
  PausedError: -3,
  ZeroAddressDestinationError: -4,
  ThisAddressDestinationError: -5,
  SellOrderNotFoundError: -6,
  BuyOrderNotFoundError: -7,
  NotSpenderError: -8,
  NotTokenOwnerError: -9,
  TokenOwnerError: -10,
  ExpiredError: -11,
  NotMakerError: -12,
  NotAllowedToCancelOrder: -13,
  NotSelfError: -14,
  SelfError: -15,
  NotAllowedPaymentToken: -16,
  InvalidBPSError: -17,
  NotEqualAmountError: -18,
  NotContractOwnershipRecipientError: -19,
  NotAllowedUserError: -20,
};

export const ENG_AUC_ERROR = {
  NotPausedError: -1,
  PausedError: -2,
  NotContractOwnerError: -3,
  ZeroAddressDestinationError: -4,
  ThisAddressDestinationError: -5,
  SellOrderNotFoundError: -6,
  SellOrderFoundError: -7,
  NotSpenderError: -8,
  NotTokenOwnerError: -9,
  NotAllowedToCancelOrder: -10,
  SelfError: -11,
  LessThanMinBidError: -12,
  InsufficientAllowanceError: -13,
  NotExpiredError: -14,
  ExpiredError: -15,
  AccountNotFoundError: -16,
  AssetNotFoundError: -18,
  NotAllowedToEndError: -19,
  NotAllowedPaymentToken: -20,
  NotEqualAmountError: -21,
  NotContractOwnershipRecipientError: -22,
  NotAllowedUserError: -23,
  InvalidBidIncrementBPSError: -24,
  InvalidRoyaltyFeeBPSError: -25,
  InvalidServiceFeeBPSError: -26,
};
