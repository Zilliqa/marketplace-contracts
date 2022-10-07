// Update the path of .env path if needed
require("dotenv").config({ path: "./.env" });

const { deployContract } = require("../utils/deploy.js");
const { getAddressFromPrivateKey } = require("@zilliqa-js/crypto");
const util = require("util");
const fs = require("fs");
const readFile = util.promisify(fs.readFile);

async function deployFixedPriceContractState(
  deployerPrivateKey,
  { initialOwnerAddress = null, collectionContract = null }
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
      process.env.CONTRACTS_DIR + "/fixed_price/" + "fixed_price_state.scilla"
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
      vname: "initial_collection_contract",
      type: "ByStr20",
      value: collectionContract,
    },
  ];

  console.info("Deploying Fixed Price State Contract...");
  return deployContract(deployerPrivateKey, address, code, init);
}

exports.deployFixedPriceContractState = deployFixedPriceContractState;
