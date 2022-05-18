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

**`SellOrder`**

Store auction sell order information.

```
| SellOrder of ByStr20 (* maker *)
               BNum    (* expiration_blocknumber *)
               ByStr20 (* payment_token_address *)
               Uint128 (* start_amount *)
               ByStr20 (* royalty_recipient *)
               Uint128 (* royalty_fee_bps *)
               ByStr20 (* service_fee_recipient *)
               Uint128 (* service_fee_bps *)
```


**`BuyOrder`**

Store buyers' bid information.

```
| BuyOrder of ByStr20 (* maker *)
              Uint128 (* bid_amount *)
              ByStr20 (* buyer_destination_address_for_NFT_token_to_be_transferred *)
              Uint128 (* total_big_count *)
```


### C2. Mutable Fields

| Name | Type | Description |
| ---- | ---- | ----------- |
| `allowlist_address`            | `ByStr20`                                      | Indicate if the contract has a list of permitted users defined by `allowlist_contract`.  The allowlist contract is used to define which wallet addresses can sell and bid for NFTs. Defaults to `zero_address` to indicate that anyone can sell and bid the auctions. |
| `contract_owner`               | `ByStr20`                                      | Contract admin, defaults to `initial_contract_owner` |
| `contract_ownership_recipient` | `ByStr20`                                      | Temporary holding field for contract ownership recipient, defaults to `zero_address`. |
| `is_paused`                    | `Bool`                                         | `True` if the contract is paused. Otherwise, `False`. `is_paused` defaults to `False`.                                                                                                                                                                                                                                                                                                                                                                                                                             |          |
| `sell_orders`                  | `Map ByStr20 (Map Uint256 SellOrder)`          | Stores selling information. Mapping from token address to token ID to a list of SellOrder ADT. |
| `buy_orders`                   | `Map ByStr20 (Map Uint256 BuyOrder)`           | Stores buyers' bidding information. Mapping from token address to token ID to a list of BuyOrder ADT. |
| `assets`                       | `Map ByStr20 (Map ByStr20 (Map Uint256 Bool))` | NFT token that is ready to be withdrawn by the user is listed here. Mapping of `owner` -> `token_address` -> `token_id` -> `True/False`. |
| `payment_tokens`               | `Map ByStr20 (Map ByStr20 Uint128)`            | Indicates if a user has locked payment tokens to withdraw. Payment tokens can be native ZILs, ZRC-2 currency tokens etc. Mapping of `owner` -> `payment_token_address` -> a`mount` |
| `allowed_payment_tokens`       | `Map ByStr20 Bool`                             | An allowlist for the ZRC-2 payment tokens.  |
| `service_fee_bps`              | `Uint128`                                      | A marketplace may take service fee (x% of every transaction) and use basis points (BPS) for the fee. service fee BPS (e.g. 250 = 2.5%) |
| `bid_increment_bps`            | `Uint128`                                      | Used to calculate the Minimum Bid; Minimum Bid = Current Bid + Bid Increment. bid increment BPS (e.g. 1000 = 10%) |
| `service_fee_recipient`        | `ByStr20`                                      | Wallet owned by Zilliqa used to collect the sales commission. If `allowlist_contract` is used, this wallet address must be whitelisted in the `allowlist_contract` as well. |

### D2. Error Codes

| Name | Type | Code | Description |
| ---- | ---- | -----| ----------- |
| `NotPausedError`                     | `Int32` | `-1`  | Emit when the contract is not paused.                                                       |
| `PausedError`                        | `Int32` | `-2`  | Emit when the contract is paused.                                                           |
| `NotContractOwnerError`              | `Int32` | `-3`  | Emit when the address is not a contract owner.                                              |
| `ZeroAddressDestinationError`        | `Int32` | `-4`  | Emit when the destination is zero address.                                                  |
| `ThisAddressDestinationError`        | `Int32` | `-5`  | Emit when the destination is the auction contract.                                          |
| `SellOrderNotFoundError`             | `Int32` | `-6`  | Emit when the token is not listed in auction contract.                                      |
| `SellOrderFoundError`                | `Int32` | `-7`  | Emit when the token is already listed in auction contract.                                  |
| `NotSpenderError`                    | `Int32` | `-8`  | Emit when the sender is not a spender of the token.                                         |
| `NotTokenOwnerError`                 | `Int32` | `-9`  | Emit when the address is not a token owner.                                                 |
| `NotAllowedToCancelOrder`            | `Int32` | `-10` | Emit when the sender is not allowed to cancel a sell order.                                 |
| `SelfError`                          | `Int32` | `-11` | Emit when the address is equal to itself.                                                   |
| `LessThanMinBidError`                | `Int32` | `-12` | Emit when the bid is less than minimum bid required.                                        |
| `InsufficientAllowanceError`         | `Int32` | `-13` | Emit when the bidder has not given sufficient ZRC-2 allowance to auction to bid.            |
| `NotExpiredError`                    | `Int32` | `-14` | Emit when the listing has not expired yet.                                                  |
| `ExpiredError`                       | `Int32` | `-15` | Emit when the listing has expired.                                                          |
| `AccountNotFoundError`               | `Int32` | `-16` | Emit when the sender has no available payment token to withdraw.                            |
| `AssetNotFoundError`                 | `Int32` | `-18` | Emit when the sender has no available asset to withdraw.                                    |
| `NotAllowedToEndError`               | `Int32` | `-19` | Emit when the sender does not have perimission to end the auction.                          |
| `NotAllowedPaymentToken`             | `Int32` | `-20` | Emit when the payment token is not allowed.                                                 |
| `NotEqualAmountError`                | `Int32` | `-21` | Emit when the required ZIL amount does not match the bid amount when paying by native ZILs. |
| `NotContractOwnershipRecipientError` | `Int32` | `-22` | Emit when the address is not a contract ownership recipient.                                |
| `NotAllowedUserError`                | `Int32` | `-23` | Emit when the address is not listed in `allowlist_address` contract.                        |
| `InvalidBidIncrementBPSError`        | `Int32` | `-24` | Emit when the `bid_increment_bps` exceeds the allowable range.                              |
| `InvalidRoyaltyFeeBPSError`          | `Int32` | `-25` | Emit when the `royalty_fee_bps` in the ZRC-6 token contract exceeds the allowable range.    |
| `InvalidServiceFeeBPSError`          | `Int32` | `-26` | Emit when the `service_fee_bps` exceeds the allowable range.                                |

### E2. Transitions

#### 1. `Start`

Stars the auction.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `token_address`            | `ByStr20 with contract...` | ZRC-6 token contract address |
| `token_id`                 | `Uint256`                  | token ID |
| `payment_token_address`    | `ByStr20`                  | Payment mode that bidders should bid in; leave it as `zero_address` to pay in native ZILs. |
| `start_amount`             | `Uint128`                  | Opening bid amount. |
| `expiration_bnum`          | `BNum`                     | Block number that this listing would expired on. |

**Requirements:**

- The contract must not be paused.
- `_sender` must be listed in `allowlist_address` contract if `allowlist_address` is non-zero address.
- `expiration_bnum` must not be current block.
- `payment_token_address` must be a valid payment token method.
- `_sender` must be the spender or token owner.

**Events:**

|    | Name | Description | Event Parameters |
| -- | ---- | ----------- | ---------------- |
| `_eventname` | `Start`  | <ul><li>`maker` : `ByStr20`<br/>Sender address</li></ul>  