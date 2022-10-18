const { callWithoutConfirm } = require("../utils/call.js");

async function cancelOrder(
  privateKey,
  fixedPriceProxy,
  nftTokenAddress,
  tokenId,
  paymentToken,
  price,
  side
) {
  const txCancelOrder = await callWithoutConfirm(
    privateKey,
    fixedPriceProxy,
    "CancelOrder",
    [
      {
        vname: "token_address",
        type: "ByStr20",
        value: nftTokenAddress,
      },
      {
        vname: "token_id",
        type: "Uint256",
        value: tokenId,
      },
      {
        vname: "payment_token_address",
        type: "ByStr20",
        value: paymentToken,
      },
      {
        vname: "sale_price",
        type: "Uint128",
        value: price,
      },
      {
        vname: "side",
        type: "Uint32",
        value: side,
      },
    ],
    0,
    false,
    false
  );
  return txCancelOrder;
}

exports.cancelOrder = cancelOrder;
