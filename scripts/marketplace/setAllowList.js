const { callWithoutConfirm } = require("../utils/call.js");

async function setAllowList(
  nftOwnerPrivateKey,
  destinationContract,
  allowListContract
) {
  let result = await callWithoutConfirm(
    nftOwnerPrivateKey,
    destinationContract,
    "SetAllowlist",
    [
      {
        vname: "address",
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

exports.setAllowList = setAllowList;