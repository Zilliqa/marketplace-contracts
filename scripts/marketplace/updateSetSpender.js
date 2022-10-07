const { callWithoutConfirm } = require("../utils/call.js");

async function updateSetSpender(
  privateKey,
  nftContract,
  trasferProxy,
  tokenId
) {

  let result = await callWithoutConfirm(
    privateKey,
    nftContract,
    'SetSpender',
    [
      {
        vname: 'spender',
        type: "ByStr20",
        value: trasferProxy,
      },
      {
        vname: 'token_id',
        type: "Uint256",
        value: tokenId,
      }
    ],
    0,
    false,
    false
  );
  return result;
}

exports.updateSetSpender = updateSetSpender;
