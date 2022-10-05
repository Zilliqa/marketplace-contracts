[zrc-6]: https://github.com/Zilliqa/ZRC/blob/master/zrcs/zrc-6.md
[zrc-2]: https://github.com/Zilliqa/ZRC/blob/master/zrcs/zrc-2.md
[allowlist]: contracts/allowlist.scilla
[multi-sig wallet]: contracts/msw.scilla
[fixed price]: contracts/fixed_price.scilla
[english auction]: contracts/english_auction.scilla
[fixed price rev 1.1]: contracts/fixed_price_rev1.1.scilla
[english auction rev 1.1]: contracts/english_auction_rev1.1.scilla
[collection]: contracts/collection.scilla

<div align="center">
  <h1>
  Marketplace Contracts
  </h1>
  <strong>
  Build NFT marketplaces
  </strong>
</div>

<hr/>

[![Build Status](https://app.travis-ci.com/Zilliqa/marketplace-contracts.svg?token=6BrmjBEqdaGp73khUJCz&branch=main)](https://app.travis-ci.com/Zilliqa/marketplace-contracts) [![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

## Contracts

| Contract Name      | Description                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Fixed Price]      | This contract is for the Listings and Offers. The price stays fixed. <br/> It depends on [ZRC-6] and [ZRC-2].                                                                                                             |
| [Fixed Price Rev 1.1] | This contract is a revision to Fixed Price contract. It allows users to sell and buy in batches. |
| [English Auction]  | This contract is for the English auction sale, i.e. sell to the highest bidder at the end. <br/> It depends on [ZRC-6] and [ZRC-2].                                                                                       |
| [English Auction Rev 1.1] | This contract is a revision to Auction contract. It allows users to sell in batches. |
| [Allowlist]        | For the access control, this contract can be used optionally by the [Fixed Price] and [English Auction] contract. To use this contract, run `SetAllowlist` transition in the [Fixed Price] or [English Auction] contract. |
| [Multi-Sig Wallet] | This auto-generated contract is a multi-sig wallet for the above contracts.            
| [Collection] | This contract is responsible for managing the user entity brand, collections owned by brands and payouts of commission fees to brands  |

## Contract Testing

### `npm test`

Runs contract tests using [Isolated Server container](https://hub.docker.com/r/zilliqa/zilliqa-isolated-server), [Jest](https://jestjs.io/), and [Scilla JSON Utils](https://github.com/Zilliqa/scilla-json-utils)

Create `.env` file, consider `.env.example` as reference, update the details and run the test cases.

We run tests sequentially since block numbers are increased with `IncreaseBlocknum`.

## Batch Sell Testing

This section will walk-through how to execute and test the batch selling transition `SetBatchOrder` and `BatchStart` for Fixed Price Rev 1.1 and Auction Rev 1.1 contracts respectively.

### Deploy ZRC-6
1. Visit https://ide.zilliqa.com, connect with your ZilPay wallet, switch the environment at the top right to Testnet.
3. We would need to get some ZILs to deploy contracts. Click on the **Faucet** at the navigation bar, paste your ZilPay wallet address.
4. Wait for the transaction to be confirmed, you should have some ZILs on your ZilPay wallet.
5. Next, head back to the IDE, click on ZRC-6.scilla on the left panel.
6. Click on the **Deploy** button at the top.
7. Fill in the fields as follows:
```
initial_contract_owner: your_wallet_address
initial_base_uri: leave_empty
name: some_random_name
symbol: some_random_symbol
```
8. Click on **Deploy Contract** at the bottom.

### Mint
1. Once the contract is deployed successfully, it would show up at the **Contracts** section on the IDE.
2. Click on the newly deployed ZRC-6 contract, you should see a list of **Transitions** at the right panel.
3. Click on the **Mint** transition, and fill in the following input fields.
```
to: you_wallet_address
token_uri: https://api.creature.com
```
4. Click on **Call transition** and wait for it to complete. You have minted one NFT to your wallet!
5. Repeat Step 3 again to mint another one.

### Deploy Collection
1. On the IDE, under the **FILES** section, click on the "plus" icon. This would create an empty contract. 
2. Copy and paste the [Fixed Price Rev 1.1] code into the empty contract.
3. Click on **Deploy**; remember to connect your ZilPay wallet and ensure that your are on Testnet. Enter your own wallet address as the `initial_contract_owner`.
4. Once deployed, you should see it under the **Contracts** section.

### Deploy Fixed Price
1. On the IDE, under the **FILES** section, click on the "plus" icon. This would create an empty contract. 
2. Copy and paste the [Fixed Price Rev 1.1] code into the empty contract.
3. Click on **Deploy**; remember to connect your ZilPay wallet and ensure that your are on Testnet. Enter your own wallet address as the `initial_contract_owner` and the address for the collection contract.
4. Once deployed, you should see it under the **Contracts** section.

### Deploy English Auction
1. On the IDE, under the **FILES** section, click on the "plus" icon. This would create an empty contract. 
2. Copy and paste the [Fixed Price Rev 1.1] code into the empty contract.
3. Click on **Deploy**; remember to connect your ZilPay wallet and ensure that your are on Testnet. Enter your own wallet address as the `initial_contract_owner` and the address for the collection contract.
4. Once deployed, you should see it under the **Contracts** section.

### Give perimission to sell
1. Now, we need to give the newly deployed Fixed Price contract the rights to sell our NFT.
2. Head back to IDE, click on the deployed ZRC-6 contract under the **Contracts** section.
3. On the **Transitions** panel, click on **SetSpender** and fill up the following fields:
```
spender: <fixed_price_contract_address>,
token_id: <1>
```
4. Click on **Call transition** and wait for it to complete. You have given the Fixed Price contract the permission to sell Token #1!
5. Repeat Step 3 again but change the `token_id` to `2`.

### Execute Batch Sell
Now we have our fixed price contract and ZRC-6 contract ready, we can start to sell our NFT in batches (for education purposes). Note, we are using **ZilliqaJS** to sell the NFT in batches because the IDE does not support custom ADT param yet in the form fields. These scripts are useful especially when we want to implement the sell batch code in any frontend dapp.

1. Open this project repo.
2. `npm install`.
3. Edit the `scripts/batch/sell-batch-fixed-price.js` to suit to your deployment:
```
    const orderItem1 = createOrderRecord(
        `${marketplace}`,
        `${nftToken}`,
        "1",
        "0x0000000000000000000000000000000000000000",
        "11000000000000",
        "0",
        "9999999"
    );

    const orderItem2 = createOrderRecord(
        `${marketplace}`,
        `${nftToken}`,
        "2",
        "0x0000000000000000000000000000000000000000",
        "22000000000000",
        "0",
        "9999999"
    );
```
4. Next, we would need to your wallet private key to execute the script. You can get your wallet private key from **ZilPay** > **Gear Icon** > **Security & Privacy** > **Show Private Keys.** 

**Please do not share your private keys with others!**

5. Execute the script:
```
cd scripts/batch
node sell-batch-fixed-price.js <0x_fixed_price_contract_address> <0x_ZRC-6_contract_address> <your_private_key>
```

6. Once the transaction is confirmed. You can view the Fixed Price contract's `sell orders` state to see the two sell orders for Token #1 and Token #2!.

7. That's it, you can repeat the same steps from the beginning but this time, to sell the tokens via the [English Auction Rev 1.1] contract!.


## References

- [OpenSea.js](https://github.com/ProjectOpenSea/opensea-js#getting-started)
- [OpenSea: Retrieving orders](https://docs.opensea.io/reference/retrieving-orders)
- [OpenSea: Terminology](https://docs.opensea.io/reference/terminology)
- [Wyvern Protocol: Protocol Components](https://wyvernprotocol.com/docs)
- [OpenSea: Introducing eBay-style Auctions for Crypto Collectibles](https://medium.com/opensea/introducing-ebay-style-auctions-for-crypto-collectibles-47ba856155de)
- [OpenSea: What are OpenSea's fees? ](https://support.opensea.io/hc/en-us/articles/1500011590241-What-are-OpenSea-s-fees-)
- [OpenSea: How do I sell an NFT? ](https://support.opensea.io/hc/en-us/articles/360063498333-How-do-I-sell-an-NFT-)

## License

This project is open source software licensed as [GPL-3.0](https://github.com/zilliqa/marketplace-contracts/blob/main/LICENSE).
