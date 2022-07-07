const { Zilliqa } = require('@zilliqa-js/zilliqa')
const { getAddressFromPrivateKey } = require('@zilliqa-js/crypto')
const { bytes } = require('@zilliqa-js/util')

const TESTNET_VERSION = bytes.pack(process.env.CHAIN_ID, 1)
const zilliqa = new Zilliqa(process.env.NETWORK_URL)

function useKey(privateKey) {
  const address = getAddressFromPrivateKey(privateKey)
  const accounts = Object.keys(zilliqa.wallet.accounts)
  if (
    accounts.findIndex((a) => a.toLowerCase() === address.toLowerCase()) < 0
  ) {
    zilliqa.wallet.addByPrivateKey(privateKey)
  }
  zilliqa.wallet.setDefault(address)
}

exports.TESTNET_VERSION = TESTNET_VERSION
exports.zilliqa = zilliqa
exports.useKey = useKey