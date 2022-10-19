const { callWithoutConfirm } = require("../utils/call.js");

async function fullFillOrder(
  privateKey,
  fixedPriceProxy,
  nftTokenAddress,
  tokenId,
  paymentToken,
  price,
  side,
  sellerAddress,
  buyerAddress
) {
  const txFullFillOrder = await callWithoutConfirm(
    privateKey,
    fixedPriceProxy,
    "FulfillOrder",
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
      {
        vname: "dest",
        type: "ByStr20",
        value: buyerAddress,
      },
      {
        vname: "seller",
        type: "ByStr20",
        value: sellerAddress,
      },
      {
        vname: "buyer",
        type: "ByStr20",
        value: buyerAddress,
      },
    ],
    price,
    false,
    false
  );
  return txFullFillOrder;
}

exports.fullFillOrder = fullFillOrder;
