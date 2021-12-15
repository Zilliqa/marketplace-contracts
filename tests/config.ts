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
    path: "contracts/zrc6.scilla",
    baseURI: "https://creatures-api.zilliqa.com/api/creature/",
    initial_total_supply: 3,
    name: "Test",
    symbol: "T",
  },
  wzil: {
    path: "contracts/wrapped_zil.scilla",
    name: "Wrapped ZIL",
    symbol: "wZIL",
    decimal: "12",
    initial_supply: "1000000000000000",
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
  SellOrderNotFoundError: -1,
  SellOrderFoundError: -2,
  BuyOrderNotFoundError: -3,
  BuyOrderFoundError: -4,
  NotSpenderError: -5,
  NotTokenOwnerError: -6,
  ExpiredError: -7,
  NotMakerError: -8,
  NotSelfError: -9,
  SelfError: -10,
  NotAllowedPaymentToken: -11,
  NotPausedError: -12,
  PausedError: -13,
  NotContractOwnerError: -14,
  InvalidFeeBPSError: -15,
  NotEqualAmountError: -16,
  NotContractOwnershipRecipientError: -17,
  ZeroAddressDestinationError: -18,
  ThisAddressDestinationError: -19,
  NotAllowedToCancelOrder: -20,
};

export const ENG_AUC_ERROR = {
  SellOrderNotFoundError: -1,
  SellOrderFoundError: -2,
  BuyOrderNotFoundError: -3,
  NotSpenderError: -4,
  NotTokenOwnerError: -5,
  NotSelfError: -6,
  SelfError: -7,
  LessThanMinBidError: -8,
  InsufficientAllowanceError: -9,
  NotExpiredError: -10,
  ExpiredError: -11,
  AccountNotFoundError: -12,
  InsufficientPaymentTokenError: -13,
  AssetNotFoundError: -14,
  NotAllowedToEndError: -15,
  NotAllowedPaymentToken: -16,
  NotPausedError: -17,
  PausedError: -18,
  NotContractOwnerError: -19,
  InvalidFeeBPSError: -20,
  NotEqualAmountError: -21,
  ZeroAddressDestinationError: -22,
  ThisAddressDestinationError: -23,
  NotContractOwnershipRecipientError: -24,
  NotAllowedToCancelOrder: -25,
};
