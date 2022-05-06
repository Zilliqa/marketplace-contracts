const { bytes, validation, BN, Long, units } = require('@zilliqa-js/util');
const { Zilliqa } = require('@zilliqa-js/zilliqa');


/**
 * AUCTION
 * THIS SCRIPT IS USED TO DEMO HOW WE CONSTRUCT THE CONTRACT PARAMS TO USE CUSTOM ADT
 * WHEN CALLING BATCH SELL
 */

/**
 * create the batch transition param
 * 
 * @param {string} marketplace auction contract address
 * @param {string} tokenAddress ZRC-6 contract
 * @param {string} tokenId token ID
 * @param {string} paymentTokenAddress zero address 
 * @param {string} startAmount starting bid in Qa
 * @param {string} expirationBnum expiry block number
 * @returns 
 */
function createOrderParam(marketplace, tokenAddress, tokenId, paymentTokenAddress, startAmount, expirationBnum) {
  return {
    constructor: `${marketplace}.OrderParam`,
    argtypes: [],
    arguments: [
        `${tokenAddress}`,
        `${tokenId}`,
        `${paymentTokenAddress}`,
        `${startAmount}`,
        `${expirationBnum}`,
    ]
  }
}

/**
 * demo Selling in batch
 * @returns 
 */
async function main() {
    const myArgs = process.argv.slice(2);

    if (myArgs.length < 3) {
        console.error("Wrong arguments\n");
        console.log("node sell-batch-auction.js [0x_auction_contract_address] [0x_zrc-6_contract_address] [private_key]");
        return;
    }

    const marketplace = myArgs[0].toLowerCase();
    const nftToken = myArgs[1].toLowerCase();
    const privateKey = myArgs[2];

    const zilliqa = new Zilliqa('https://dev-api.zilliqa.com');
    zilliqa.wallet.addByPrivateKey(privateKey);
    const myGasPrice = units.toQa('2000', units.Units.Li);

    const order_list = [];

    // auction contract, ZRC-6 contract, token-id, zero-address, start_amount, expiry
    const orderItem1 = createOrderParam(
        `${marketplace}`,
        `${nftToken}`,
        "1",
        "0x0000000000000000000000000000000000000000",
        "11000000000000",
        "9999999"
    );

    const orderItem2 = createOrderParam(
        `${marketplace}`,
        `${nftToken}`,
        "2",
        "0x0000000000000000000000000000000000000000",
        "22000000000000",
        "9999999"
    );
    
    order_list.push(orderItem1);
    order_list.push(orderItem2);

    try {
        const networkId = await zilliqa.network.GetNetworkId();
        console.log("networkid: %o", networkId.result);

        const VERSION = bytes.pack(parseInt(networkId.result), 1);

        const contract = zilliqa.contracts.at(`${marketplace}`);

        const callTx = await contract.call(
            'BatchStart',
            [
                {
                    vname: "order_list",
                    type: `List ${marketplace}.OrderParam`,
                    value: order_list,
                },
            ],
            {
                version: VERSION,
                amount: new BN(0),
                gasPrice: myGasPrice,
                gasLimit: Long.fromNumber(10000),
            },
            33,
            1000,
            true
        );
        console.log(JSON.stringify(callTx, null, 4));
    } catch (err) {
        console.error(err);
    }
}

main();