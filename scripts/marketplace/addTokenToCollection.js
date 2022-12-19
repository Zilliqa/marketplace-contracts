const { callContract } = require("../utils/call.js");

async function addTokenToCollection(
    collectionContract,
    nftOwnerPrivateKey,
    brandOwnerPrivateKey,
    collectionItem
) {
    // Pre-conditions. Collection must have been created
    console.log("added to collection start");

    // Brand sends request to add the token to a collection
    const sendRequestTx = await callContract(
        brandOwnerPrivateKey,
        collectionContract,
        "RequestTokenToCollection",
        [
            {
                vname: "request",
                type: `${collectionContract.address}.CollectionItemParam`,
                value: collectionItem,
            },
        ],
        0,
        false,
        false
    );
    console.log(sendRequestTx, "sendRequestTx")

    const acceptRequestTx = await callContract(
        nftOwnerPrivateKey,
        collectionContract,
        "AcceptCollectionRequest",
        [
            {
                vname: "request",
                type: `${collectionContract.address}.CollectionItemParam`,
                value: collectionItem,
            },
        ],
        0,
        false,
        false
    );
    console.log(acceptRequestTx, "acceptRequestTx");

    console.log("added to collection end");
    // NFT owner accepts request
}

exports.addTokenToCollection = addTokenToCollection;