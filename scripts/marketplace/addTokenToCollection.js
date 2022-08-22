
const { callContract } = require('../utils/call.js')

async function addTokenToCollection(
  collectionContract,
  nftOwnerPrivateKey,
  brandOwnerPrivateKey,
  collectionItem,
) {
    
    // Pre-conditions. Collection must have been created

    // Brand sends request to add the token to a collection
    const sendRequestTx = await callContract(
        brandOwnerPrivateKey,
        collectionContract,
        'RequestTokenToCollection',
        [
            {
                vname: 'request',
                type: `${collectionContractAddress.address}.CollectionItemParam`,
                value: collectionItem
            }
        ],
        0,
        false,
        false
    )

    

    const acceptRequestTx = await callContract(
        nftOwnerPrivateKey,
        collectionContract,
        'AcceptCollectionRequest',
        [
            {
                vname: 'request',
                type: `${collectionContractAddress.address}.CollectionItemParam`,
                value: collectionItem
            }
        ],
        0,
        false,
        false
    )



    console.log('added to collection')
    // NFT owner accepts request
}



exports.addTokenToCollection = addTokenToCollection