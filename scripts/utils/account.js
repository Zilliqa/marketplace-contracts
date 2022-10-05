const { getAddressFromPrivateKey } = require('@zilliqa-js/crypto')
const { transfer } = require('./call.js')

function getDefaultAccount() {
  const key = process.env.MASTER_PRIVATE_KEY
  const address = getAddressFromPrivateKey(key).toLowerCase()
  return { key, address }
}

async function getDefaultAccount2() {
  const key = process.env.MASTER_PRIVATE_KEY2
  const address = getAddressFromPrivateKey(key)
  const keyOwner = process.env.MASTER_PRIVATE_KEY

  await transfer(keyOwner, address, '100000')

  return { key, address: address.toLowerCase() }
}

exports.getDefaultAccount = getDefaultAccount
exports.getDefaultAccount2 = getDefaultAccount2