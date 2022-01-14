import { bytes, units } from "@zilliqa-js/util";
import { Long, BN } from "@zilliqa-js/util";

export const CONTAINER = process.env["CONTAINER"];

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
  ExpiredError: -10,
  NotMakerError: -11,
  NotAllowedToCancelOrder: -12,
  SelfError: -13,
  NotAllowedPaymentToken: -14,
  InvalidBPSError: -15,
  NotEqualAmountError: -16,
  NotContractOwnershipRecipientError: -17,
  NotAllowedUserError: -18,
};

export const ENG_AUC_ERROR = {
  NotPausedError: -1,
  PausedError: -2,
  NotContractOwnerError: -3,
  ZeroAddressDestinationError: -4,
  ThisAddressDestinationError: -5,
  SellOrderNotFoundError: -6,
  SellOrderFoundError: -7,
  BuyOrderNotFoundError: -8,
  NotSpenderError: -9,
  NotTokenOwnerError: -10,
  NotAllowedToCancelOrder: -11,
  SelfError: -12,
  LessThanMinBidError: -13,
  InsufficientAllowanceError: -14,
  NotExpiredError: -15,
  ExpiredError: -16,
  AccountNotFoundError: -17,
  InsufficientPaymentTokenError: -18,
  AssetNotFoundError: -19,
  NotAllowedToEndError: -20,
  NotAllowedPaymentToken: -21,
  InvalidBPSError: -22,
  NotEqualAmountError: -23,
  NotContractOwnershipRecipientError: -24,
  NotAllowedUserError: -25,
};
