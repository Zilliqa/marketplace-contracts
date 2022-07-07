/* eslint-disable no-undef */
require('dotenv').config({ path: './.env' })
const { BN } = require('@zilliqa-js/util')
const { default: BigNumber } = require('bignumber.js')
const { getAddressFromPrivateKey } = require('@zilliqa-js/crypto')
const { deployFixedPriceContract } = require('../scripts/marketplace/deployFixedPriceContract.js')
const { deployFungibleToken } = require('../scripts/deployFungibleToken.js')


const { deployNonFungibleToken } = require('../scripts/deployNonFungibleToken.js')
const {
  setupBalancesOnAccounts,
  clearBalancesOnAccounts
} = require('../scripts/utils/call.js')

const { getContractState } = require('../scripts/utils/deploy.js')

const newOwnerKey = process.env.STAKING_OWNER_PRIVATE_KEY

beforeEach(async () => {
  await setupBalancesOnAccounts()
})

afterEach(async () => {
  await clearBalancesOnAccounts()
})

async function setup() {
  const fungibleTokenDeployParams = {
    name: 'TestPaymentToken',
    symbol: null,
    decimals: 12,
    supply: new BN('10000000000000000'),
    dexCheck: 'True'
  }
  const [paymentToken] = await deployFungibleToken(
    process.env.MASTER_PRIVATE_KEY,
    fungibleTokenDeployParams,
    getAddressFromPrivateKey(process.env.TOKEN_OWNER_PRIVATE_KEY)
  )

  const [fixedPriceContract] = await deployFixedPriceContract(
    process.env.MASTER_PRIVATE_KEY,
    {
      initialOwnerAddress: getAddressFromPrivateKey(
        process.env.DEX_OWNER_PRIVATE_KEY
      )
    }
  ) 
  const nonFungibleTokenDeployParams = {
    name: 'TestNFTToken1',
    symbol: null,
    baseURI: 'https://ipfs.io/ipfs/'
  }
  const [nftContract] = await deployNonFungibleToken(
    process.env.MASTER_PRIVATE_KEY,
    nonFungibleTokenDeployParams,
    getAddressFromPrivateKey(process.env.TOKEN_OWNER_PRIVATE_KEY)
  )


  return [fixedPriceContract.address, nftContract.address, paymentToken.address]
}