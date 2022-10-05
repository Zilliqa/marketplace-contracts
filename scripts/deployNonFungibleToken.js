// Update the path of .env path if needed
require('dotenv').config({ path: './.env' })

const { deployContract } = require('./utils/deploy.js')
const { getAddressFromPrivateKey } = require('@zilliqa-js/crypto')
const util = require('util')
const fs = require('fs')
const readFile = util.promisify(fs.readFile)

const randomHex = (size) =>
  [...Array(size)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join('')

async function deployNonFungibleToken(
  privateKey,
  deployParams,
  tokenOwnerAddress
) {
  // Check for key
  if (!privateKey || privateKey === '') {
    throw new Error('No private key was provided!')
  }

  // Generate default vars
  const address = getAddressFromPrivateKey(privateKey)
  const symbol = deployParams.symbol || `TEST-${randomHex(4).toUpperCase()}`

  // Load code and contract initialization variables
  // const code = (await readFile(process.env.CONTRACTS_DIR + '/' + 'FungibleToken.scilla')).toString()

  const code = (
    await readFile(process.env.TEST_CONTRACTS_DIR + '/' + 'zrc6.scilla')
  ).toString()
/*
  initial_contract_owner: ByStr20,
  (* Initial Base URI. e.g. `https://creatures-api.zilliqa.com/api/creature/` *)
  initial_base_uri: String,
  name: String,
  symbol: String
*/
  const init = [
    // this parameter is mandatory for all init arrays
    {
      vname: '_scilla_version',
      type: 'Uint32',
      value: '0'
    },
    {
      vname: 'initial_contract_owner',
      type: 'ByStr20',
      value: `${tokenOwnerAddress}`
    },
    {
      vname: 'name',
      type: 'String',
      value: `${deployParams.name}`
    },
    {
      vname: 'symbol',
      type: 'String',
      value: `${symbol}`
    },
    {
        vname: 'initial_base_uri',
        type: 'String',
        value: `${deployParams.baseURI}`
      },
  ]

  console.info(`Deploying non-fungible token ${symbol}... init : ${JSON.stringify(init)}`)
  return await deployContract(privateKey, address, code, init)
}

exports.deployNonFungibleToken = deployNonFungibleToken