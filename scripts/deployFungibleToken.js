
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

async function deployFungibleToken(
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
    await readFile(process.env.TEST_CONTRACTS_DIR + '/' + 'wrapped_zil.scilla')
  ).toString()

  const init = [
    // this parameter is mandatory for all init arrays
    {
      vname: '_scilla_version',
      type: 'Uint32',
      value: '0'
    },
    {
      vname: 'contract_owner',
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
      vname: 'decimals',
      type: 'Uint32',
      value: deployParams.decimals.toString()
    },
    {
      vname: 'init_supply',
      type: 'Uint128',
      value: deployParams.supply.toString()
    }
  ]

  console.info(`Deploying fungible token ${symbol}...`)
  return await deployContract(privateKey, address, code, init)
}

exports.deployFungibleToken = deployFungibleToken