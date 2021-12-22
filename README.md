# Marketplace Contracts

## Contracts

- [English Auctions (sell to the highest bidder)](contracts/english_auction.scilla)
- [Fixed Price Listings and Offers](contracts/fixed_price.scilla)

## Contract Testing

### `yarn test`

Runs contract tests using [Isolated Server docker image](https://hub.docker.com/r/zilliqa/zilliqa-isolated-server) and [Jest](https://jestjs.io/).

We run tests sequentially since block numbers are increased with `IncreaseBlocknum`.

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
