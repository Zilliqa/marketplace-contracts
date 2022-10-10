// Update the path of .env path if needed
require("dotenv").config({ path: "./.env" });

const { deployContract } = require("../utils/deploy.js");
const { getAddressFromPrivateKey } = require("@zilliqa-js/crypto");
const util = require("util");
const fs = require("fs");
const readFile = util.promisify(fs.readFile);

async function deployFixedPriceContractLogic(
  deployerPrivateKey,
  {
    initialOwnerAddress = null,
    state = null,
    proxy = null,
    transfer_proxy = null,
  }
) {
  // Check for key
  if (!deployerPrivateKey || deployerPrivateKey === "") {
    throw new Error("No private key was provided!");
  }

  // Default vars
  const address = getAddressFromPrivateKey(deployerPrivateKey);

  // Load code and contract initialization variables
  const code = (
    await readFile(
      process.env.CONTRACTS_DIR + "/fixed_price/" + "fixed_price_logic.scilla"
    )
  ).toString();
  const init = [
    // this parameter is mandatory for all init arrays
    {
      vname: "_scilla_version",
      type: "Uint32",
      value: "0",
    },
    {
      vname: "initial_contract_owner",
      type: "ByStr20",
      value: initialOwnerAddress,
    },
    {
      vname: "initial_state_contract",
      type: "ByStr20",
      value: state,
    },
    {
      vname: "proxy",
      type: "ByStr20",
      value: proxy,
    },
    {
      vname: "transfer_proxy",
      type: "ByStr20",
      value: transfer_proxy,
    },
  ];

  console.info("Deploying Fixed Price Logic Contract...");
  return deployContract(deployerPrivateKey, address, code, init);
}

exports.deployFixedPriceContractLogic = deployFixedPriceContractLogic;
