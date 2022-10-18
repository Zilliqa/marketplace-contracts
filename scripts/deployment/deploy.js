/* eslint-disable no-undef */
require("dotenv").config({ path: "./.env" });
const { zilliqa } = require('../utils/zilliqa')
const { getAddressFromPrivateKey } = require("@zilliqa-js/crypto");
const { deployAllowlistContract } = require("../marketplace/deployAllowlistContract.js");
const { deployTransferProxyContract } = require("../marketplace/deployTransferProxyContract.js");
const { deployCollectionContract } = require("../marketplace/deployCollectionContract.js");
const { deployFixedPriceContractProxy } = require("../marketplace/deployFixedPriceContractProxy.js");
const { deployFixedPriceContractState } = require("../marketplace/deployFixedPriceContractState.js");
const { deployFixedPriceContractLogic } = require("../marketplace/deployFixedPriceContractLogic.js");
const { registerMarketPlace } = require("../marketplace/registerMarketPlace.js");
const { addToAllowList } = require("../marketplace/addToAllowList.js");
const { updateLogicContractInTransferProxy } = require("../marketplace/updateLogicContractInTransferProxy.js");
const { updateLogicContractInStateProxy } = require("../marketplace/updateLogicContractInStateProxy.js");
const { deployNonFungibleToken } = require('../../scripts/deployNonFungibleToken')
const { updateSetSpender } = require("../marketplace/updateSetSpender.js");
const { batchMint } = require("../marketplace/batchMint");
const { setupBalancesOnAccounts, clearBalancesOnAccounts } = require("../utils/call");
const { setOrder } = require("../marketplace/setOrder");
const { cancelOrder } = require("../marketplace/cancelOrder");
const { getBlockNumber } = require('../utils/helper')


const accounts = {
    contractOwner: {
        privateKey: process.env.MASTER_PRIVATE_KEY,
        address: getAddressFromPrivateKey(process.env.MASTER_PRIVATE_KEY),
    },
    nftSeller: {
        privateKey: process.env.SELLER_PRIVATE_KEY,
        address: getAddressFromPrivateKey(process.env.SELLER_PRIVATE_KEY),
    },
    nftBuyer: {
        privateKey: process.env.BUYER_PRIVATE_KEY,
        address: getAddressFromPrivateKey(process.env.BUYER_PRIVATE_KEY),
    },
    stranger: {
        privateKey: process.env.N_01_PRIVATE_KEY,
        address: getAddressFromPrivateKey(process.env.N_01_PRIVATE_KEY),
    },
    forbidden: {
        address: getAddressFromPrivateKey(process.env.N_02_PRIVATE_KEY),
        privateKey: process.env.N_02_PRIVATE_KEY,
    },
};

(async () => {
    let _allowListContract = null;
    let _transferProxyContract = null;
    let _collectionContract = null;
    let _fixedPriceProxy = null;
    let _fixedPriceState = null;
    let _fixedPriceLogic = null;
    let _deployNonFungibleToken = null;

    if(process.env.CHAIN_ID == 222) {
        await setupBalancesOnAccounts(accounts);
    }

    const [allowlistContract] = await deployAllowlistContract(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, });
    console.log("😰 allowList", allowlistContract.address);
    _allowListContract = allowlistContract.address;

    const [transferProxyContract] = await deployTransferProxyContract(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, });
    console.log("😰 transferProxyContract", transferProxyContract.address);
    _transferProxyContract = transferProxyContract.address;

    const [collectionContract] = await deployCollectionContract(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, });
    console.log("😰 collectionContract", collectionContract.address);
    _collectionContract = collectionContract.address;

    const [fixedPriceProxy] = await deployFixedPriceContractProxy(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, });
    console.log("😰 fixedPriceProxy", fixedPriceProxy.address);
    _fixedPriceProxy = fixedPriceProxy.address;

    const [fixedPriceState] = await deployFixedPriceContractState(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, collectionContract: _collectionContract });
    console.log("😰 fixedPriceState", fixedPriceState.address);
    _fixedPriceState = fixedPriceState.address;

    const [fixedPriceLogic] = await deployFixedPriceContractLogic(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, state: _fixedPriceState, proxy: _fixedPriceProxy, transfer_proxy: _transferProxyContract });
    console.log("😰 fixedPriceLogic", fixedPriceLogic.address);
    _fixedPriceLogic = fixedPriceLogic.address;

    const _registerMarketPlace = await registerMarketPlace(accounts.contractOwner.privateKey, _collectionContract, _fixedPriceProxy);
    console.log("😰 registerMarketPlace", _registerMarketPlace.success);

    // const _setAllowList = await addToAllowList(accounts.contractOwner.privateKey, _collectionContract, _fixedPriceProxy);
    // console.log("setAllowList", _setAllowList);

    const _updateLogicContractInTransferProxy = await updateLogicContractInTransferProxy(accounts.contractOwner.privateKey, _transferProxyContract, _fixedPriceLogic, "updateOperator", "to", "status", "True");
    console.log("😰 updateLogicContractInTransferProxy", _updateLogicContractInTransferProxy.success);

    const _updateLogicContractInState = await updateLogicContractInStateProxy(accounts.contractOwner.privateKey, _fixedPriceState, _fixedPriceLogic, "UpdateLogic", "new_logic_contract");
    console.log("😰 updateLogicContractInState", _updateLogicContractInState.success);

    const _updateLogicContractInProxy = await updateLogicContractInStateProxy(accounts.contractOwner.privateKey, _fixedPriceProxy, _fixedPriceLogic, "UpdateLogic", "to");
    console.log("😰 updateLogicContractInProxy", _updateLogicContractInProxy.success);

    // deploy collection contract
    const nonFungibleTokenDeployParams = { name: 'TestNFTToken1', symbol: null, baseURI: 'https://ipfs.io/ipfs/' }
    const [deployNonFungibleTokenContract] = await deployNonFungibleToken(accounts.nftSeller.privateKey, nonFungibleTokenDeployParams, accounts.nftSeller.address);
    console.log("😰 deployNonFungibleToken", deployNonFungibleTokenContract.address);
    _deployNonFungibleToken = deployNonFungibleTokenContract.address;

    // batch mint
    const pair = await createPairADT(accounts.nftSeller.address, "")
    const _batchMint = await batchMint(accounts.nftSeller.privateKey, _deployNonFungibleToken, [pair, pair, pair, pair]);
    console.log("😰 _batchMint", _batchMint.receipt.success);

    // setSpender
    const _setSpender_tokenId_1 = await updateSetSpender(accounts.nftSeller.privateKey, _deployNonFungibleToken, _transferProxyContract, "1");
    console.log("😰 setSpender fot tokenId - 1", _setSpender_tokenId_1.success);

    const _setSpender_tokenId_2 = await updateSetSpender(accounts.nftSeller.privateKey, _deployNonFungibleToken, _transferProxyContract, "2");
    console.log("😰 setSpender fot tokenId - 2", _setSpender_tokenId_2.success);

    const _setSpender_tokenId_3 = await updateSetSpender(accounts.nftSeller.privateKey, _deployNonFungibleToken, _transferProxyContract, "3");
    console.log("😰 setSpender fot tokenId - 3", _setSpender_tokenId_3.success);

    const _setSpender_tokenId_4 = await updateSetSpender(accounts.nftSeller.privateKey, _deployNonFungibleToken, _transferProxyContract, "4");
    console.log("😰 setSpender fot tokenId - 4", _setSpender_tokenId_4.success);

    // setOrder - tokenId (1) - by seller
    const globalBNum = await getBlockNumber(zilliqa);
    const newExpiryBlock_SellOrder = String(globalBNum + 99999)
    const _setOrder_SellOrder1 = await setOrder(accounts.nftSeller.privateKey, _fixedPriceProxy, _deployNonFungibleToken, "1", "0x0000000000000000000000000000000000000000", "10000000000000", "0", newExpiryBlock_SellOrder);
    console.log("😰 setOrder SellOrder", _setOrder_SellOrder1.success);

    // setOrder - tokenId (2) - by buyer
    const newExpiryBlock_BuyOrder = String(globalBNum + 999)
    const _setOrder_BuyOrder = await setOrder(accounts.nftBuyer.privateKey, _fixedPriceProxy, _deployNonFungibleToken, "2", "0x0000000000000000000000000000000000000000", "20000000000000", "1", newExpiryBlock_BuyOrder);
    console.log("😰 setOrder buyOrder", _setOrder_BuyOrder.success);

    // cancelOrder - tokenId (3) - by seller
    const _cancelSellOrder = await cancelOrder(accounts.nftSeller.privateKey, _fixedPriceProxy, _deployNonFungibleToken, "1", "0x0000000000000000000000000000000000000000", "10000000000000", "0");
    console.log("😰 cancel SellOrder", _cancelSellOrder.success);

    // cancelOrder - tokenId (2) - by buyer
    const _cancelBuyOrder = await cancelOrder(accounts.nftBuyer.privateKey, _fixedPriceProxy, _deployNonFungibleToken, "2", "0x0000000000000000000000000000000000000000", "20000000000000", "1");
    console.log("😰 cancel BuyOrder", _cancelBuyOrder.success);
    
    // setOrder - tokenId (3) - by seller
    const _setOrder_SellOrder2 = await setOrder(accounts.nftSeller.privateKey, _fixedPriceProxy, _deployNonFungibleToken, "3", "0x0000000000000000000000000000000000000000", "10000000000000", "0", newExpiryBlock_SellOrder);
    console.log("😰 setOrder SellOrder", _setOrder_SellOrder2.success);
    
    if(process.env.CHAIN_ID == 222) {
        await clearBalancesOnAccounts(accounts);
    }
})()

async function createPairADT(address, string) {
    return {
        constructor: "Pair",
        argtypes: ["ByStr20", "String"],
        arguments: [address, string],
    }
}