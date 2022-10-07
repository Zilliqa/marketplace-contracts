const { callWithoutConfirm } = require("../utils/call.js");

async function addToAllowList(
  nftOwnerPrivateKey,
  fixedPriceState,
  allowListContract
) {
  let result = await callWithoutConfirm(
    nftOwnerPrivateKey,
    fixedPriceState,
    "SetAllowList",
    [
      {
        vname: "allowed_addresses",
        type: "ByStr20",
        value: allowListContract,
      },
    ],
    0,
    false,
    false
  );

  return result;
}

exports.addToAllowList = addToAllowList;