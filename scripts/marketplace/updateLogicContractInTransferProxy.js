const { callWithoutConfirm } = require("../utils/call.js");

async function updateLogicContractInTransferProxy(
  privateKey,
  to,
  logic,
  transactionName,
  vnameAddress,
  vnameStatus,
  vnameStatusValue
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
      {
        vname: vnameStatus,
        type: "Bool",
        value: {
          constructor: vnameStatusValue,
          argtypes: [],
          arguments: [],
        },
      },
    ],
    0,
    false,
    false
  );

  return result;
}

exports.updateLogicContractInTransferProxy = updateLogicContractInTransferProxy;
