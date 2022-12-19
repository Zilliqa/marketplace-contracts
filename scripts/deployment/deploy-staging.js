/* eslint-disable no-undef */
require("dotenv").config({ path: "./.env" });
const { getAddressFromPrivateKey } = require("@zilliqa-js/crypto");
const { deployAllowlistContract } = require("../marketplace/deployAllowlistContract.js");
const { deployTransferProxyContract } = require("../marketplace/deployTransferProxyContract.js");
const { deployCollectionContract } = require("../marketplace/deployCollectionContract.js");
const { deployFixedPriceContractProxy } = require("../marketplace/deployFixedPriceContractProxy.js");
const { deployFixedPriceContractState } = require("../marketplace/deployFixedPriceContractState.js");
const { deployFixedPriceContractLogic } = require("../marketplace/deployFixedPriceContractLogic.js");
const { registerMarketPlace } = require("../marketplace/registerMarketPlace.js");
const { setAllowList } = require("../marketplace/setAllowList.js");
const { addToAllowList } = require("../marketplace/addToAllowList.js");
const { updateLogicContractInTransferProxy } = require("../marketplace/updateLogicContractInTransferProxy.js");
const { updateLogicContractInStateProxy } = require("../marketplace/updateLogicContractInStateProxy.js");
const { setupBalancesOnAccounts, clearBalancesOnAccounts } = require("../utils/call");

const accounts = {
    contractOwner: {
        privateKey: process.env.CHAIN_ID == 222 ? process.env.MASTER_PRIVATE_KEY : process.env.STAGING_PRIVATE_KEY,
        address: getAddressFromPrivateKey(process.env.CHAIN_ID == 222 ? process.env.MASTER_PRIVATE_KEY : process.env.STAGING_PRIVATE_KEY),
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

    if (process.env.CHAIN_ID == 222) {
        await setupBalancesOnAccounts(accounts);
    }

    const [allowlistContract] = await deployAllowlistContract(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, });
    console.log("allowList", allowlistContract.address);
    _allowListContract = allowlistContract.address;

    const [transferProxyContract] = await deployTransferProxyContract(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, });
    console.log("transferProxyContract", transferProxyContract.address);
    _transferProxyContract = transferProxyContract.address;

    const [collectionContract] = await deployCollectionContract(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, });
    console.log("collectionContract", collectionContract.address);
    _collectionContract = collectionContract.address;

    const [fixedPriceProxy] = await deployFixedPriceContractProxy(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, });
    console.log("fixedPriceProxy", fixedPriceProxy.address);
    _fixedPriceProxy = fixedPriceProxy.address;

    const [fixedPriceState] = await deployFixedPriceContractState(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, collectionContract: _collectionContract });
    console.log("fixedPriceState", fixedPriceState.address);
    _fixedPriceState = fixedPriceState.address;

    const [fixedPriceLogic] = await deployFixedPriceContractLogic(accounts.contractOwner.privateKey, { initialOwnerAddress: accounts.contractOwner.address, state: _fixedPriceState, proxy: _fixedPriceProxy, transfer_proxy: _transferProxyContract });
    console.log("fixedPriceLogic", fixedPriceLogic.address);
    _fixedPriceLogic = fixedPriceLogic.address;

    const _registerMarketPlace = await registerMarketPlace(accounts.contractOwner.privateKey, _collectionContract, _fixedPriceProxy);
    console.log("registerMarketPlace", _registerMarketPlace.success);

    const _addAllowList = await addToAllowList(accounts.contractOwner.privateKey, _allowListContract, [process.env.STAGING_SERVICE_WALLET]);
    console.log("_addAllowList", _addAllowList.success);

    const _setAllowListInCollectionContract = await setAllowList(accounts.contractOwner.privateKey, _collectionContract, _allowListContract);
    console.log("_setAllowListInCollectionContract", _setAllowListInCollectionContract.success);

    const _setAllowListInFixedPriceProxy = await setAllowList(accounts.contractOwner.privateKey, _fixedPriceState, _allowListContract);
    console.log("_setAllowListInFixedPriceProxy", _setAllowListInFixedPriceProxy.success);

    const _updateLogicContractInTransferProxy = await updateLogicContractInTransferProxy(accounts.contractOwner.privateKey, _transferProxyContract, _fixedPriceLogic, "updateOperator", "to", "status", "True");
    console.log("updateLogicContractInTransferProxy", _updateLogicContractInTransferProxy.success);

    const _updateLogicContractInState = await updateLogicContractInStateProxy(accounts.contractOwner.privateKey, _fixedPriceState, _fixedPriceLogic, "UpdateLogic", "new_logic_contract");
    console.log("updateLogicContractInState", _updateLogicContractInState.success);

    const _updateLogicContractInProxy = await updateLogicContractInStateProxy(accounts.contractOwner.privateKey, _fixedPriceProxy, _fixedPriceLogic, "UpdateLogic", "to");
    console.log("updateLogicContractInProxy", _updateLogicContractInProxy.success);

    const _updateStateContractInProxy = await updateLogicContractInStateProxy(accounts.contractOwner.privateKey, _fixedPriceProxy, _fixedPriceState, "UpdateState", "to");
    console.log("updateStateContractInProxy", _updateStateContractInProxy.success);

    if (process.env.CHAIN_ID == 222) {
        await clearBalancesOnAccounts(accounts);
    }
})()