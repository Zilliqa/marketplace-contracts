[zrc-6]: https://github.com/Zilliqa/ZRC/blob/master/zrcs/zrc-6.md
[zrc-2]: https://github.com/Zilliqa/ZRC/blob/master/zrcs/zrc-2.md
[allowlist]: contracts/allowlist.scilla
[fixed price]: contracts/fixed_price.scilla
[english auction]: contracts/english_auction.scilla

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

| Contract Name     | Description                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Fixed Price]     | This contract is for the Listings and Offers. The price stays fixed. <br/> It depends on [ZRC-6] and [ZRC-2].                                                                                                             |
| [English Auction] | This contract is for the English auction sale, i.e. sell to the highest bidder at the end. <br/> It depends on [ZRC-6] and [ZRC-2].                                                                                       |
| [Allowlist]       | For the access control, this contract can be used optionally by the [Fixed Price] and [English Auction] contract. To use this contract, run `SetAllowlist` transition in the [Fixed Price] or [English Auction] contract. |

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
