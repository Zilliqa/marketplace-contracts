# Marketplace Contracts

## [English Auctions](contracts/english_auction.scilla)

Sell to the highest bidder.

### `Start`

**Arguments:**

```
  token_address: ByStr20 with contract
    field royalty_recipient: ByStr20,
    field royalty_fee_bps: Uint128,
    field spenders: Map Uint256 ByStr20,
    field token_owners: Map Uint256 ByStr20
  end,
  token_id: Uint256,
  payment_token_address: ByStr20,
  start_amount: Uint128,
  expiration_bnum: BNum
```

- Seller can start an auction for an asset only if the asset has no ongoing auction.
- The marketplace contract holds the asset for auction by using the spender role.

### `Bid`

**Arguments:**

```
  token_address: ByStr20 with contract
    field royalty_recipient: ByStr20,
    field royalty_fee_bps: Uint128,
    field spenders: Map Uint256 ByStr20,
    field token_owners: Map Uint256 ByStr20
  end,
  token_id: Uint256,
  amount: Uint128,
  dest: ByStr20
```

- Bidders can bid only for an existing auction.
- A bid must not be less than start amount of the auction.
- The bid increment is 10% of the current bid and a bid must not be less than the minimum bid (`Minimum Bid = Current Bid + Bid Increment`).
- Bidders must be able to set an address to receive the asset when creating a buy order via `dest` parameter.
- The marketplace contract holds the payment tokens for bidding.
- If the current bid is updated, the previous bidder can withdraw the payment tokens back. Only when the previous bidder withdraws `x` amount of the payment tokens, the marketplace contract transfers `x` amount of the payment tokens.

### `End`

**Arguments:**

```
  token_address: ByStr20 with contract
    field royalty_recipient: ByStr20,
    field royalty_fee_bps: Uint128,
    field spenders: Map Uint256 ByStr20,
    field token_owners: Map Uint256 ByStr20
  end,
  token_id: Uint256
```

- Seller or buyer can end the auction once the sell order has been expired.
- When an auction is ended
  - the buyer can withdraw the asset.
  - the seller can withdraw the payment tokens.
  - the royalty recipient can withdraw the royalty amount.
  - the service fee recipient can withdraw the service fee.

### `Cancel`

**Arguments:**

```
  token_address: ByStr20 with contract
    field royalty_recipient: ByStr20,
    field royalty_fee_bps: Uint128,
    field spenders: Map Uint256 ByStr20,
    field token_owners: Map Uint256 ByStr20
  end,
  token_id: Uint256
```

- only if this contract is unpaused, the sellers can cancel their sell orders.
- only if this contract is paused, the contract owner can cancel orders.
- An auction cannot be cancelled once it has been expired.
- When auction has been cancelled,
  - the seller can withdraw the asset.
  - the buyer can withdraw the current bid amount of the payment tokens.

### `WithdrawPaymentTokens`

**Arguments:**

```
  payment_token_address: ByStr20,
  amount: Uint128
```

- Anyone who has payment tokens can draw their tokens.

### `WithdrawAsset`

**Arguments:**

```
  token_address: ByStr20,
  token_id: Uint256
```

- Anyone who has assets can draw their asset.

## [Fixed Price Listings and Offers](contracts/fixed_price.scilla)

### `CreateOrder`

**Arguments:**

```
  token_address: ByStr20 with contract
    field royalty_recipient: ByStr20,
    field royalty_fee_bps: Uint128,
    field spenders: Map Uint256 ByStr20,
    field token_owners: Map Uint256 ByStr20
  end,
  token_id: Uint256,
  payment_token_address: ByStr20,
  sale_price: Uint128,
  side: Uint32,
  expiration_bnum: BNum
```

- Sellers can create sell orders (listings)
- Buyers can create buy orders (offers)

### `FulfillOrder`

**Arguments:**

```
  token_address: ByStr20 with contract
    field royalty_recipient: ByStr20,
    field royalty_fee_bps: Uint128,
    field spenders: Map Uint256 ByStr20,
    field token_owners: Map Uint256 ByStr20
  end,
  token_id: Uint256,
  payment_token_address: ByStr20,
  sale_price: Uint128,
  side: Uint32,
  (* `dest` is only meaningful for buyers at the moment *)
  dest: ByStr20
```

- Sellers can fulfill buy orders.
- Buyers can fulfill sell orders.
- When a sell order is fulfilled, the sell order is removed and the other orders for the token are also removed.
- When a buy order is fulfilled, the buy order is removed.
- Buyers should be able to set an address to receive the asset when fulfilling a sell order.

### `CancelOrder`

**Arguments:**

```
  token_address: ByStr20 with contract
    field royalty_recipient: ByStr20,
    field royalty_fee_bps: Uint128,
    field spenders: Map Uint256 ByStr20,
    field token_owners: Map Uint256 ByStr20
  end,
  token_id: Uint256,
  payment_token_address: ByStr20,
  sale_price: Uint128,
  side: Uint32
```

- only if this contract is unpaused, the makers can cancel their orders.
- only if this contract is paused, the contract owner can cancel orders.

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
