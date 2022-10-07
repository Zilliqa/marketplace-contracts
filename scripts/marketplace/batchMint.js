// Update the path of .env path if needed
require('dotenv').config({ path: './.env' })

const { getContract } = require('../utils/deploy.js')
const { callContract } = require('../utils/call.js')


async function batchMint(privateKey, nftContractAddress, list) {
  const mftContract = await getContract(privateKey, nftContractAddress)

  const batchMintTxn = await callContract(
    privateKey,
    mftContract,
    'BatchMint',
    [
      {
        vname: 'to_token_uri_pair_list',
        type: 'List (Pair ByStr20 String)',
        value: list
      }
    ],
    0,
    false
  )

  console.log('batchMint txn : ', JSON.stringify(batchMintTxn))

  return batchMintTxn
}

exports.batchMint = batchMint