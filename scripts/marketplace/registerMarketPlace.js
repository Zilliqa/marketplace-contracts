const { callWithoutConfirm } = require("../utils/call.js");

async function registerMarketPlace(
  nftOwnerPrivateKey,
  collectionContract,
  fixedPriceProxy
) {
  let result = await callWithoutConfirm(
    nftOwnerPrivateKey,
    collectionContract,
    "RegisterMarketplaceAddress",
    [
      {
        vname: "address",
        type: "ByStr20",
        value: fixedPriceProxy.toLowerCase(),
      },
    ],
    0,
    false,
    false
  );

  return result;
}

exports.registerMarketPlace = registerMarketPlace;
