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

  if(side === 0) {
    const txSellOrder = await callWithoutConfirm(
      privateKey,
      fixedPriceProxy,
      "SetOrder",
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: zero_address
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: price
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'expiration_bnum',
          type: 'BNum',
          value: expiryBlock
        }
      ],
      0,
      false,
      false
    );
    return txSellOrder;
  } else {
    const txSellOrder = await callWithoutConfirm(
      privateKey,
      fixedPriceProxy,
      "SetOrder",
      [
        {
          vname: 'token_address',
          type: 'ByStr20',
          value: nftTokenAddress
        },
        {
          vname: 'token_id',
          type: 'Uint256',
          value: tokenId
        },
        {
          vname: 'payment_token_address',
          type: 'ByStr20',
          value: paymentToken
        },
        {
          vname: 'sale_price',
          type: 'Uint128',
          value: price
        },
        {
          vname: 'side',
          type: 'Uint32',
          value: side
        },
        {
          vname: 'expiration_bnum',
          type: 'BNum',
          value: expiryBlock
        }
      ],
      price,
      false,
      false
    );
    return txSellOrder;
  }
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
