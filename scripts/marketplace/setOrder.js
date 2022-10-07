const { callWithoutConfirm } = require("../utils/call.js");

async function setOrder(
  privateKey,
  fixedPriceProxy,
  nftTokenAddress,
  tokenId,
  paymentToken,
  price,
  side,
  expiryBlock
) {
  const formattedSaleAdtOrder = await createFixedPriceOrder(
    fixedPriceProxy,
    nftTokenAddress,
    tokenId,
    paymentToken,
    price,
    side,
    expiryBlock
  );

  // console.log(formattedSaleAdtOrder);

  const txSellOrder = await callWithoutConfirm(
    privateKey,
    fixedPriceProxy,
    "SetOrder",
    [
      {
        vname: "order",
        type: `${fixedPriceProxy}.OrderParam`,
        value: formattedSaleAdtOrder,
      },
    ],
    0,
    false,
    false
  );

  return txSellOrder;
}

async function createFixedPriceOrder(
  fixedPriceProxy,
  nftTokenAddress,
  tokenId,
  paymentTokenAddress,
  salePrice,
  side,
  expirationBnum
) {
  return {
    constructor: `${fixedPriceProxy.toLowerCase()}.OrderParam`,
    argtypes: [],
    arguments: [
      nftTokenAddress,
      tokenId,
      paymentTokenAddress,
      salePrice,
      side,
      expirationBnum,
    ],
  };
}

exports.setOrder = setOrder;
