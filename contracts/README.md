## Table of Contents

- [I. Fixed Price Contract]
- [II. Fixed Price Contract Specification]
  - [A1. Immutable Parameters]
  - [B1. Mutable Fields]
  - [C1. Error Codes]
  - [D1. Transitions]
- [III. Auction Contract](#iii-auction-contract)
- [IV. Auction Contract Specification](#iv-auction-contract-specification)
  - [A2. Immutable Parameters](#a2-immutable-parameters)
  - [B2. ADT](#b2-adt)
  - [C2. Mutable Fields](#c2-mutable-fields)
  - [D2. Error Codes](#d2-error-codes)
  - [E2. Transitions](#e2-transitions)

## III. Auction Contract

In the English Auction contract, a seller can sell a NFT by setting a opening bid and a duration.

Throughout the duration, interested buyers can choose to bid on the NFT. When bidding, their payment tokens are locked up by the contract.

The contract only keeps track of the highest bidder at any point of time. i.e. if user A bids 1 ZIL, user B bids 2 ZIL, user B is the current highest bid; user A would be refunded.

The seller has the rights to cancel the auction anytime, if that happens, the seller can get back the NFT ownership and the bids are refunded back to the bidders.

The seller must initiate an end process after the auction has ended, this is necessarry for the contract to compute the profits and transfer the NFT to the winner.

Sellers and buyers can claim their profits and losing bids by calling a withdraw payment tokens call.

## IV. Auction Contract Specification

### A2. Immutable Parameters

| Name                     | Type      | Description                |
| ------------------------ | --------- | -------------------------- |
| `initial_contract_owner` | `ByStr20` | Address of contract owner. |

### B2. ADT

### C2. Mutable Fields

| Name | Type | Description |
| ---- | ---- | ----------- |
| `allowlist_address` | `ByStr20` | Indicate if the contract has a list of permitted users defined by `allowlist_contract`.  The allowlist contract is used to define which wallet addresses can sell and bid for NFTs. Defaults to `zero_address` to indicate that anyone can sell and bid the auctions. |
| `contract_owner` | `ByStr20` | Contract admin, defaults to `initial_contract_owner` |
| `contract_ownership_recipient` | `ByStr20` | Temporary holding field for contract ownership recipient, defaults to `zero_address`. |
| `is_paused`                    | `Bool`                           | `True` if the contract is paused. Otherwise, `False`. `is_paused` defaults to `False`.                                                                                                                                                                                                                                                                                                                                                                                                                             |          |
| `sell_orders` | `Map ByStr20 (Map Uint256 SellOrder)` | Stores selling information. Mapping from token address to token ID to a list of SellOrder ADT. |
| `buy_orders` | `Map ByStr20 (Map Uint256 BuyOrder)` | Stores buyers' bidding information. Mapping from token address to token ID to a list of BuyOrder ADT. |
| `assets` | `Map ByStr20 (Map ByStr20 (Map Uint256 Bool))` | NFT token that is ready to be withdrawn by the user is listed here. Mapping of `owner` -> `token_address` -> `token_id` -> `True/False`. |
| `payment_tokens` | `Map ByStr20 (Map ByStr20 Uint128)` | Indicates if a user has locked payment tokens to withdraw. Payment tokens can be native ZILs, ZRC-2 currency tokens etc. Mapping of `owner` -> `payment_token_address` -> a`mount` |
| `allowed_payment_tokens` | `Map ByStr20 Bool` | An allowlist for the ZRC-2 payment tokens.  |
| `service_fee_bps` | `Uint128` | A marketplace may take service fee (x% of every transaction) and use basis points (BPS) for the fee. service fee BPS (e.g. 250 = 2.5%) |