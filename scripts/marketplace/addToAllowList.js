const { callWithoutConfirm } = require("../utils/call.js");

async function addToAllowList(
  nftOwnerPrivateKey,
  allowListContract,
  allowListWallets
) {
  let result = await callWithoutConfirm(
    nftOwnerPrivateKey,
    allowListContract,
    "Allow",
    [
      {
        vname: "address_list",
        type: "List (ByStr20)",
        value: allowListWallets,
      },
    ],
    0,
    false,
    false
  );

  return result;
}

exports.addToAllowList = addToAllowList;