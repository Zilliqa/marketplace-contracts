const { TESTNET_VERSION, zilliqa, useKey } = require('./zilliqa')
const { BN, Long, units } = require('@zilliqa-js/util')
const { getAddressFromPrivateKey } = require('@zilliqa-js/crypto')
const BigNumber = require('bignumber.js')
const { Wallet } = require('@zilliqa-js/account')
const { HTTPProvider, TransactionError } = require('@zilliqa-js/core')

const { Blockchain } = require('@zilliqa-js/blockchain')
const fetch = require('node-fetch')
const provider = new HTTPProvider(process.env.NETWORK_URL)

const { getContract } = require('./deploy.js')

async function postBlocknumRequest() {
  const url = 'https://zilliqa-isolated-server.zilliqa.com/'
  const body = { id: '1', jsonrpc: '2.0', method: 'GetBlocknum', params: [''] }
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  })
  const data = await res.json()
  const bNum = parseInt(data.result, 10)
  return bNum + 200
}

async function getDeadlineBlock(privateKey) {
  if (process.env.NETWORK === 'ISOLATED') {
    return await postBlocknumRequest()
  } else {
    const address = getAddressFromPrivateKey(privateKey)
    const accounts = Object.keys(zilliqa.wallet.accounts)
    if (
      accounts.findIndex((a) => a.toLowerCase() === address.toLowerCase()) < 0
    ) {
      zilliqa.wallet.addByPrivateKey(privateKey)
    }
    const bc = new Blockchain(provider, new Wallet(provider, accounts))

    const response = await bc.getNumTxBlocks()

    const bNum = parseInt(response.result, 10)
    return bNum + 10
  }
}

async function getBalance(address) {
  const balanceRes = await zilliqa.blockchain.getBalance(address)
  if (balanceRes && balanceRes.result && balanceRes.result.balance) {
    return balanceRes.result.balance
  }

  return 0
}

async function transfer(privateKey, toAddr, amount) {
  // Check for key
  if (!privateKey || privateKey === '') {
    throw new Error('No private key was provided!')
  }
  useKey(privateKey)

  const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice()

  return await zilliqa.blockchain.createTransaction(
    zilliqa.transactions.new(
      {
        version: TESTNET_VERSION,
        toAddr,
        amount: new BN(units.toQa(amount, units.Units.Zil)),
        gasPrice: new BN(minGasPrice.result),
        gasLimit: Long.fromNumber(1)
      },
      false
    )
  )
}

async function callContract(
  privateKey,
  contract,
  transition,
  args,
  zilsToSend = 0,
  insertRecipientAsSender = true,
  insertDeadlineBlock = true
) {
  // Check for key
  if (!privateKey || privateKey === '') {
    throw new Error('No private key was provided!')
  }
  useKey(privateKey)

  const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice()

  console.info(
    `Calling: ${transition}, insertRecipientAsSender : ${insertRecipientAsSender}, insertDeadlineBlock: ${insertDeadlineBlock}`
  )

  return await contract.call(
    transition,
    args,
    {
      version: TESTNET_VERSION,
      amount: new BN(zilsToSend),
      gasPrice: new BN(minGasPrice.result),
      gasLimit: Long.fromNumber(25000)
    },
    33,
    1000,
    true
  )
}

async function sendZil(privateKey, recipientAddress, sendingAmount, gasLimit) {
  let blockchainTxnId = null
  try {
    useKey(privateKey)
    const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice()

    let tx = zilliqa.transactions.new({
      version: TESTNET_VERSION,
      toAddr: recipientAddress,
      amount: units.toQa(sendingAmount, units.Units.Zil),
      gasPrice: new BN(minGasPrice.result),
      gasLimit: gasLimit
    })

    // Send a transaction to the network
    tx = await zilliqa.blockchain.createTransactionWithoutConfirm(tx)
    blockchainTxnId = tx.id
    console.log('The sendZil transaction id is:', tx.id)

    console.log('Waiting transaction be confirmed')
    return await tx.confirm(tx.id, 33, 2000)
  } catch (err) {
    console.log('sendZil error:')
    console.log(err)
    return { transactionId: blockchainTxnId, status: false }
  }
}

async function getState(privateKey, contract, token) {
  const userAddress = getAddressFromPrivateKey(privateKey)
  const cState = await contract.getState()
  const tState = await token.getState()
  const pool = cState.pools[token.address.toLowerCase()]
  const [x, y] = pool ? pool.arguments : [0, 0]

  const state = {
    product: new BigNumber(x).times(y),
    userZils: new BigNumber(
      (await zilliqa.blockchain.getBalance(userAddress)).result.balance
    ),
    userTokens: new BigNumber(await tState.balances[userAddress.toLowerCase()]),
    poolZils: new BigNumber(
      (await zilliqa.blockchain.getBalance(contract.address)).result.balance
    ),
    poolTokens: new BigNumber(
      await tState.balances[contract.address.toLowerCase()]
    )
  }

  console.log('state: ', JSON.stringify(state, null, 2))
  return state
}

async function getZRC2State(wallet, token) {
  const tokenContract = zilliqa.contracts.at(token);
  const tokenContractState = await tokenContract.getState();
  const balance = await tokenContractState.balances[wallet.toLowerCase()];
  let userBalance = 0;
  if(balance != undefined) {
    userBalance = balance.toString();
    return userBalance;
  } else {
    return 0;
  }
}

async function signBatchTransaction(privateKey, addrs, totalTokens) {
  try {
    useKey(privateKey)
    const txList = []
    for (let i = 0; i < addrs.length; i++) {
      const tx = zilliqa.transactions.new(
        {
          version: TESTNET_VERSION,
          toAddr: addrs[i],
          amount: totalTokens,
          gasPrice: units.toQa('2000', units.Units.Li),
          gasLimit: Long.fromNumber(100)
        },
        false
      )
      txList.push(tx)
    }
    console.log('wallet ', JSON.stringify(zilliqa.wallet))
    const batchResult = await zilliqa.wallet.signBatch(txList)

    console.log('Transactions signed...\n')
    for (const signedTx of batchResult) {
      // nonce must be different
      console.log('The signed transaction nonce is: %o', signedTx.nonce)
      console.log(
        'The signed transaction signature is: %o\n',
        signedTx.signature
      )
    }
  } catch (err) {
    console.log('Error in batch signing ', err)
  }
}

async function sendFTTo(privateKey, contract, amount, toAddr) {
  try {
    useKey(privateKey)
    const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice()

    const tx = await contract.call(
      'Transfer',
      [
        {
          vname: 'to',
          type: 'ByStr20',
          value: toAddr
        },
        {
          vname: 'amount',
          type: 'Uint128',
          value: amount
        }
      ],
      {
        // amount, gasPrice and gasLimit must be explicitly provided
        version: TESTNET_VERSION,
        amount: new BN(0),
        gasPrice: new BN(minGasPrice.result),
        gasLimit: Long.fromNumber(10000)
      }
    )

    // console.log(`tx reciept ${JSON.stringify(tx.receipt, null, 4)} `);
    return tx
  } catch (err) {
    console.log('send fungible token error:')
    console.log(err)
    return { status: false }
  }
}

async function sendToken(privateKey, token, amount, to) {
  const contract = await getContract(privateKey, token)
  const sendTx = await sendFTTo(privateKey, contract, amount, to)

  if (!sendTx.txParams.receipt.success) {
    const errors = sendTx.txParams.receipt.errors

    console.log(JSON.stringify(sendTx.txParams.receipt.exceptions))

    const errMsgs = errors
      ? Object.keys(errors).reduce((acc, depth) => {
          const errorMsgList = errors[depth].map((num) => TransactionError[num])
          return { ...acc, [depth]: errorMsgList }
        }, {})
      : 'Failed to deploy contract!'

    console.log(`errMsgs : ${JSON.stringify(errMsgs)}`)

    throw new Error(JSON.stringify(errMsgs, null, 2))
  }

  return sendTx
}

async function sendFT(privateKey, contract, amount, fromAddr, toAddr) {
  try {
    useKey(privateKey)
    const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice()

    const tx = await contract.call(
      'TransferFrom',
      [
        {
          vname: 'from',
          type: 'ByStr20',
          value: fromAddr
        },
        {
          vname: 'to',
          type: 'ByStr20',
          value: toAddr
        },
        {
          vname: 'amount',
          type: 'Uint128',
          value: amount
        }
      ],
      {
        // amount, gasPrice and gasLimit must be explicitly provided
        version: TESTNET_VERSION,
        amount: new BN(0),
        gasPrice: new BN(minGasPrice.result),
        gasLimit: Long.fromNumber(10000)
      }
    )

    // console.log(`tx reciept ${JSON.stringify(tx.receipt, null, 4)} `)
    return tx
  } catch (err) {
    console.log('send fungible token error:')
    console.log(err)
    return { result: false }
  }
}

async function increaseAllowance(privateKey, token, spenderAddr, amount) {
  try {
    useKey(privateKey)
    const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice()
    const contract = await getContract(privateKey, token)
    const tx = await contract.call(
      'IncreaseAllowance',
      [
        {
          vname: 'spender',
          type: 'ByStr20',
          value: spenderAddr
        },
        {
          vname: 'amount',
          type: 'Uint128',
          value: amount
        }
      ],
      {
        // amount, gasPrice and gasLimit must be explicitly provided
        version: TESTNET_VERSION,
        amount: new BN(0),
        gasPrice: new BN(minGasPrice.result),
        gasLimit: Long.fromNumber(10000)
      }
    )

    return tx
  } catch (err) {
    console.log('send fungible token error:')
    console.log(err)
    return { result: false }
  }
}

async function batchTransfer(privateKey, contract, toList) {
  try {
    useKey(privateKey)
    const minGasPrice = await zilliqa.blockchain.getMinimumGasPrice()

    const tx = await contract.call(
      'BatchTransfer',
      [
        {
          vname: 'to_list',
          type: 'List (Pair (ByStr20) (Uint128))',
          value: toList
        }
      ],
      {
        // amount, gasPrice and gasLimit must be explicitly provided
        version: TESTNET_VERSION,
        amount: new BN(0),
        gasPrice: new BN(minGasPrice.result),
        gasLimit: Long.fromNumber(10000)
      }
    )

    // console.log(`tx reciept ${JSON.stringify(tx.receipt, null, 4)} `);
    return tx
  } catch (err) {
    console.log('send fungible token error:')
    console.log(err)
    return { status: false }
  }
}

async function setupBalancesOnAccounts(accounts) {
  
  let nftSellerBalance = await getBalance(
    accounts.nftSeller.address
  )
/*   let masterBalance = await getBalance(
    accounts.contractOwner.address
  )
  let gaeBalance = await getBalance(
    getAddressFromPrivateKey(process.env.TOKEN_OWNER_PRIVATE_KEY)
  )
  
  console.log('gaeBalance',gaeBalance) */
  nftSellerBalance /= 1000000000000
  if (nftSellerBalance < 1000) {
    await sendZil(
      accounts.contractOwner.privateKey,
      accounts.nftSeller.address,
      1000,
      Long.fromNumber(50)
    )
  }

  let nftBuyerBalance = await getBalance(
    accounts.nftBuyer.address
  )
  nftBuyerBalance /= 1000000000000
  if (nftBuyerBalance < 1000) {
    await sendZil(
      accounts.contractOwner.privateKey,
      accounts.nftBuyer.address,
      4000,
      Long.fromNumber(50)
    )
  }

  let strangerBalance = await getBalance(
    accounts.stranger.address
  )
  strangerBalance /= 1000000000000
  if (strangerBalance < 1000) {
    await sendZil(
      accounts.contractOwner.privateKey,
      accounts.stranger.address,
      1000,
      Long.fromNumber(50)
    )
  }

  let forbiddenBalance = await getBalance(
    accounts.forbidden.address
  )
  forbiddenBalance /= 1000000000000
  if (forbiddenBalance < 1000) {
    await sendZil(
      accounts.contractOwner.privateKey,
      accounts.forbidden.address,
      1000,
      Long.fromNumber(50)
    )
  }
  /*
  let stakingOwnerBalance = await getBalance(
    getAddressFromPrivateKey(process.env.STAKING_OWNER_PRIVATE_KEY)
  )
  stakingOwnerBalance /= 1000000000000
  if (stakingOwnerBalance < 1000) {
    await sendZil(
      process.env.MASTER_PRIVATE_KEY,
      getAddressFromPrivateKey(process.env.STAKING_OWNER_PRIVATE_KEY),
      1000,
      Long.fromNumber(50)
    )
  }
  
  let stakingUserBalance = await getBalance(
    getAddressFromPrivateKey(process.env.STAKE_USER_PRIVATE_KEY)
  )
  stakingUserBalance /= 1000000000000
  if (stakingUserBalance < 1000) {
    await sendZil(
      process.env.MASTER_PRIVATE_KEY,
      getAddressFromPrivateKey(process.env.STAKE_USER_PRIVATE_KEY),
      500,
      Long.fromNumber(50)
    )
  }*/

  // let userBalance = await getBalance(
  //   getAddressFromPrivateKey(process.env.USER_PRIVATE_KEY)
  // )
  // userBalance /= 1000000000000
  // if (userBalance < 1000) {
  //   await sendZil(
  //     process.env.MASTER_PRIVATE_KEY,
  //     getAddressFromPrivateKey(process.env.USER_PRIVATE_KEY),
  //     1000,
  //     Long.fromNumber(50)
  //   )
  // }
/*
  let userBalance2 = await getBalance(
    getAddressFromPrivateKey(process.env.USER_PRIVATE_KEY_2)
  )
  userBalance2 /= 1000000000000
  if (userBalance2 < 1000) {
    await sendZil(
      process.env.MASTER_PRIVATE_KEY,
      getAddressFromPrivateKey(process.env.USER_PRIVATE_KEY_2),
      1000,
      Long.fromNumber(50)
    )
  }
*/
  // let tokenOwnerBalance = await getBalance(
  //   getAddressFromPrivateKey(process.env.TOKEN_OWNER_PRIVATE_KEY)
  // )
  // tokenOwnerBalance /= 1000000000000
  // if (tokenOwnerBalance < 1000) {
  //   await sendZil(
  //     process.env.MASTER_PRIVATE_KEY,
  //     getAddressFromPrivateKey(process.env.TOKEN_OWNER_PRIVATE_KEY),
  //     1000,
  //     Long.fromNumber(50)
  //   )
  // }
  
}

async function clearBalancesOnAccounts(accounts) {

  let contractOwner = await getBalance(
    accounts.contractOwner.address
  )
  console.log('big boss balance', contractOwner)
  
  let nftSellerBalance = await getBalance(
    accounts.nftSeller.address
  )
  nftSellerBalance /= 1000000000000
  if (nftSellerBalance > 1) {
    await sendZil(
      accounts.nftSeller.privateKey,
      accounts.contractOwner.address,
      nftSellerBalance - 1,
      Long.fromNumber(50)
    )
  }

  let nftBuyerBalance = await getBalance(
    accounts.nftBuyer.address
  )
  nftBuyerBalance /= 1000000000000
  if (nftBuyerBalance > 1) {
    await sendZil(
      accounts.nftBuyer.privateKey,
      accounts.contractOwner.address,
      nftBuyerBalance - 1,
      Long.fromNumber(50)
    )
  }

  let strangerBalance = await getBalance(
    accounts.stranger.address
  )
  strangerBalance /= 1000000000000
  if (strangerBalance > 1) {
    await sendZil(
      accounts.stranger.privateKey,
      accounts.contractOwner.address,
      strangerBalance - 1,
      Long.fromNumber(50)
    )
  }

  let forbiddenBalance = await getBalance(
    accounts.forbidden.address
  )
  forbiddenBalance /= 1000000000000
  if (forbiddenBalance > 1) {
    await sendZil(
      accounts.forbidden.privateKey,
      accounts.contractOwner.address,
      forbiddenBalance - 1,
      Long.fromNumber(50)
    )
  }
}



exports.batchTransfer = batchTransfer
exports.increaseAllowance = increaseAllowance
exports.transfer = transfer
exports.callContract = callContract
exports.getState = getState
exports.getBalance = getBalance
exports.sendZil = sendZil
exports.sendFTTo = sendFTTo
exports.sendFT = sendFT
exports.sendToken = sendToken
exports.signBatchTransaction = signBatchTransaction
exports.getDeadlineBlock = getDeadlineBlock
exports.setupBalancesOnAccounts = setupBalancesOnAccounts
exports.clearBalancesOnAccounts = clearBalancesOnAccounts
exports.getZRC2State = getZRC2State