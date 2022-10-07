const { callContract } = require("../utils/call.js");

async function DeregisterMarketplaceAddress(
  collectionContract,
  nftOwnerPrivateKey,
  fixedPriceProxy
) {
  let result = await callContract(
    nftOwnerPrivateKey,
    collectionContract,
    "DeregisterMarketplaceAddress",
    [
      {
        vname: "address",
        type: "ByStr20",
        value: fixedPriceProxy,
      },
    ],
    0,
    false,
    false
  );

  console.log(
    "DeregisterMarketplaceAddress in Collection Contract success",
    result
  );

  return result;
}

exports.DeregisterMarketplaceAddress = DeregisterMarketplaceAddress;
