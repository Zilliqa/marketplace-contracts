const { callWithoutConfirm } = require("../utils/call.js");

async function updateLogicContractInStateProxy(
  privateKey,
  to,
  logic,
  transactionName,
  vnameAddress
) {
  let result = await callWithoutConfirm(
    privateKey,
    to,
    transactionName,
    [
      {
        vname: vnameAddress,
        type: "ByStr20",
        value: logic,
      },
    ],
    0,
    false,
    false
  );

  return result;
}

exports.updateLogicContractInStateProxy = updateLogicContractInStateProxy;
