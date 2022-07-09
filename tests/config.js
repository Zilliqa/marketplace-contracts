const { bytes, units } = require("@zilliqa-js/util");
const { Long, BN } = require("@zilliqa-js/util");

const CHAIN_ID = 222;
const MSG_VERSION = 1;
const VERSION = bytes.pack(CHAIN_ID, MSG_VERSION);
const asyncNoop = async () => undefined;


const GAS_LIMIT = Long.fromNumber(100000);
const GAS_PRICE = units.toQa("2000", units.Units.Li);

const TX_PARAMS = {
    version: VERSION,
    amount: new BN(0),
    gasPrice: GAS_PRICE,
    gasLimit: GAS_LIMIT,
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";