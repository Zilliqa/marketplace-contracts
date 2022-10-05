const { TransactionError } = require('@zilliqa-js/core')
const { BN, Long } = require('@zilliqa-js/util')
const { compress } = require('./compile')
const { TESTNET_VERSION, zilliqa, useKey } = require('./zilliqa')

const deployContract = async (privateKey, ownerAddress, code, init) => {
  zilliqa.wallet.addByPrivateKey(privateKey)
  zilliqa.wallet.setDefault(ownerAddress)

  // Check for account balance
  const balance = await zilliqa.blockchain.getBalance(ownerAddress)

  if (balance.error) {
    throw new Error(balance.error.message)
  }

  const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice()
  // Deploy contract
  const compressedCode = compress(code)
  const contract = zilliqa.contracts.new(compressedCode, init)

  const [deployTx, token] = await contract.deploy(
    {
      version: TESTNET_VERSION,
      amount: new BN(0),
      gasPrice: new BN(minGasPrice.result),
      gasLimit: Long.fromNumber(80000)
    },
    33,
    1000,
    false
  )

  // Check for txn acceptance
  console.log(`Transaction Id ${deployTx.id}`)
  if (!deployTx.id) {
    throw new Error(
      JSON.stringify(token.error || 'Failed to get tx id!', null, 2)
    )
  }
  // console.info(`Deployment transaction id: ${deployTx.id}`)

  // Check for txn execution success
  if (!deployTx.txParams.receipt.success) {
    const errors = deployTx.txParams.receipt.errors

    console.log(JSON.stringify(deployTx.txParams.receipt.exceptions))

    const errMsgs = errors
      ? Object.keys(errors).reduce((acc, depth) => {
          const errorMsgList = errors[depth].map((num) => TransactionError[num])
          return { ...acc, [depth]: errorMsgList }
        }, {})
      : 'Failed to deploy contract!'

    console.log(`errMsgs : ${JSON.stringify(errMsgs)}`)

    throw new Error(JSON.stringify(errMsgs, null, 2))
  }

  // Print txn receipt
  // console.log(`Deployment transaction receipt:\n${JSON.stringify(deployTx.txParams.receipt)}`)

  // Return the contract
  return [token]
}

const getContract = async (privateKey, contractHash) => {
  useKey(privateKey)
  console.log('get contract at address : ', contractHash)
  return await zilliqa.contracts.at(contractHash)
}

const getContractWithState = async (privateKey, contractHash) => {
  useKey(privateKey)
  console.log('get getContractWithState at address : ', contractHash)
  const contract = await zilliqa.contracts.at(contractHash)
  const state = await contract.getState()
  return [contract, state]
}

const getContractState = async (privateKey, contractHash) => {
  useKey(privateKey)
  console.log('get getContractState at address : ', contractHash)
  const contract = await zilliqa.contracts.at(contractHash)
  return await contract.getState()
}

const useToken = async (privateKey, tokenAddress) => {
  return await getContract(privateKey, tokenAddress)
}

const useFungibleToken = async (privateKey, tokenAddress) => {
  return await getContract(privateKey, tokenAddress)
}

exports.deployContract = deployContract
exports.getContract = getContract
exports.getContractState = getContractState
exports.getContractWithState = getContractWithState
exports.useFungibleToken = useFungibleToken
exports.useToken = useToken