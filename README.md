# Marketplace Contracts

## Contracts

- [English Auctions](contracts/english_auction.scilla)
- [Fixed Price Listings and Offers](contracts/fixed_price.scilla)

## Contract Testing

### `yarn test`

Runs contract tests using [Isolated Server docker image](https://hub.docker.com/r/zilliqa/zilliqa-isolated-server) and [Jest](https://jestjs.io/).

We run tests sequentially since block numbers are increased with `IncreaseBlocknum`.

## Royalties

Funds will be paid for secondary sales only if a marketplace chooses to implement royalty payments. Marketplaces should transfer the actual funds.

Let's assume the following:

- Your marketplace supports royalties.
- Your marketplace takes 2.5% for the service fee.
- Your marketplace can only be a spender and it doesn’t hold any tokens.
- Alice created a ZRC-6 NFT contract where Alice is the royalty recipient and the royalty fee BPS is 10%.
- Alice minted an NFT and Bob is the token owner.
- Bob created a fixed price sell order with 10000 WZIL for the NFT on your marketplace. Bob is the seller.
- Your marketplace is the spender of the NFT for Bob
- Charlie fulfilled the sell order with 10000 WZIL. Charlie is the buyer.
- Your marketplace is the spender of the 10000 WZIL for Charlie.

When the sell order is fulfilled by Charlie, the marketplace contract should do the following:

- As the spender of the buyer, the marketplace contract must transfer the 1000 WZIL to Alice (royalty recipient).
- As the spender of the buyer, the marketplace contract must transfer the 250 WZIL to itself (service fee recipient).
- As the spender of the buyer, the marketplace contract must transfer the 8750 WZIL to Bob (seller).
- As the spender of the seller, the marketplace contract must transfer the NFT to Charlie (buyer).

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
