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
  - [B2. Mutable Fields](#b2-mutable-fields)
  - [C2. Error Codes](#c2-error-codes)
  - [D2. Transitions](#d2-transitions)

## III. Auction Contract

In the English Auction contract, a seller can sell a NFT by setting a opening bid and a duration.

Throughout the duration, interested buyers can choose to bid on the NFT. When bidding, their payment tokens are locked up by the contract.

The contract only keeps track of the highest bidder at any point of time. i.e. if user A bids 1 ZIL, user B bids 2 ZIL, user B is the current highest bid; user A would be refunded.

The seller has the rights to cancel the auction anytime, if that happens, the seller can get back the NFT and the bids are refunded back to the bidders.

The seller must initiate an end process after the auction has ended, this is necessarry for the contract to compute the profits and transfer the NFT to the winner.

## IV. Auction Contract Specification

### A2. Immutable Parameters

| Name                     | Type      | Description                |
| ------------------------ | --------- | -------------------------- |
| `initial_contract_owner` | `ByStr20` | Address of contract owner. |

### B2. Mutable Fields
