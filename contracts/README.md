## Table of Contents

- [I. Fixed Price Contract](#i-fixed-price-contract)
- [II. Fixed Price Contract Specification](#ii-fixed-price-contract-specification)
  - [A1. Immutable Parameters](#a1-immutable-parameters)
  - [B1. ADT](#b1-adt)
  - [C1. Mutable Fields](#c1-mutable-fields)
  - [D1. Error Codes](#d1-error-codes)
  - [E1. Transitions](#e1-transitions)
- [III. Auction Contract](#iii-auction-contract)
- [IV. Auction Contract Specification](#iv-auction-contract-specification)
  - [A2. Immutable Parameters](#a2-immutable-parameters)
  - [B2. ADT](#b2-adt)
  - [C2. Mutable Fields](#c2-mutable-fields)
  - [D2. Error Codes](#d2-error-codes)
  - [E2. Transitions](#e2-transitions)

## I. Fixed Price Contract

In the Fixed Price contract, a seller can sell a NFT by creating a sell order with an asking price and a duration. 

The seller can create multiple sell orders. The seller do not have to transfer the NFT ownership to the fixed price contract.

Interested buyers can either purchase NFT at the seller's asking price or they can counter offer by issuing a buy order with their offering price and a duration.

Buyers that make counter offer would have their payment tokens locked up by the fixed price contract.

To get back the payment tokens, buyers must cancel their offers.

## II. Fixed Price Contract Specification

### A1. Immutable Parameters

| Name                     | Type      | Description                |
| ------------------------ | --------- | -------------------------- |
| `initial_contract_owner` | `ByStr20` | Address of contract owner. |

### B1. ADT

**`Order`**

Store order information about buy and sell orders.

```
| Order of ByStr20 (* maker *)
           BNum    (* expiration block number *)
```

### C1. Mutable Fields

| Name | Type | Description |
| ---- | ---- | ----------- |
| `allowlist_address`            | `ByStr20`                                                      | Indicate if the contract has a list of permitted users defined by `allowlist_contract`.  The allowlist contract is used to define which wallet addresses can sell and bid for NFTs. Defaults to `zero_address` to indicate that anyone can sell and bid the auctions. |
| `contract_owner`               | `ByStr20`                                                      | Contract admin, defaults to `initial_contract_owner` |
| `contract_ownership_recipient` | `ByStr20`                                                      | Temporary holding field for contract ownership recipient, defaults to `zero_address`. |
| `is_paused`                    | `Bool`                                                         | `True` if the contract is paused. Otherwise, `False`. `is_paused` defaults to `False`.                                                                                                                                                                                                                                                                                                                                                                                                                             |          |
| `sell_orders`                  | `Map ByStr20 (Map Uint256 (Map ByStr20 (Map Uint128 Order)))`  | Stores selling information. Mapping of token_address -> ( token_id -> ( payment_token_address -> (sale_price -> sell_order ADT  ) ) |
| `buy_orders`                   | `Map ByStr20 (Map Uint256 (Map ByStr20 (Map Uint128 Order)))`  | Stores buyers' bidding information. Mapping of token_address -> ( token_id -> ( payment_token_address -> (sale_price -> buy_order ADT ) ) |
| `allowed_payment_tokens`       | `Map ByStr20 Bool`                             | An allowlist for the ZRC-2 payment tokens.  |
| `service_fee_bps`              | `Uint128`                                      | A marketplace may take service fee (x% of every transaction) and use basis points (BPS) for the fee. service fee BPS (e.g. 250 = 2.5%) |
| `service_fee_recipient`        | `ByStr20`                                      | Wallet owned by Zilliqa used to collect the sales commission. If `allowlist_contract` is used, this wallet address must be whitelisted in the `allowlist_contract` as well. |

### D1. Error Codes

| Name | Type | Code | Description |
| ---- | ---- | -----| ----------- |
| `NotContractOwnerError`              | `Int32` | `-1`  | Emit when the address is not ca ontract owner.                                                |
| `NotPausedError`                     | `Int32` | `-2`  | Emit when the contract is not paused.                                                         |
| `PausedError`                        | `Int32` | `-3`  | Emit when the contract is paused.                                                             |
| `ZeroAddressDestinationError`        | `Int32` | `-4`  | Emit when the destination is zero address.                                                    |
| `ThisAddressDestinationError`        | `Int32` | `-5`  | Emit when the destination is the fixed price contract.                                        |
| `SellOrderNotFoundError`             | `Int32` | `-6`  | Emit when the token is not listed in fixed price contract.                                    |
| `BuyOrderNotFoundError`              | `Int32` | `-7`  | Emit when the buy order is not found for the token.                                           |
| `NotSpenderError`                    | `Int32` | `-8`  | Emit when the sender is not a spender of the token.                                           |
| `NotTokenOwnerError`                 | `Int32` | `-9`  | Emit when the address is not a token owner.                                                   |
| `TokenOwnerError`                    | `Int32` | `-10` | Emit when the address is the token owner.                                                     |           
| `ExpiredError`                       | `Int32` | `-11` | Emit when the sell order or buy order has expired.                                            |
| `NotMakerError`                      | `Int32` | `-12` | Emit when the address is not the `maker`. *(Not used.)*                                       |
| `NotAllowedToCancelOrder`            | `Int32` | `-13` | Emit when the address is not allowed to cancel the specific order.                            |
| `NotSelfError`                       | `Int32` | `-14` | Emit when the address is not the `_sender`.                                                   |
| `SelfError`                          | `Int32` | `-15` | Emit when the address is the same as `_sender`.                                               |
| `NotAllowedPaymentToken`             | `Int32` | `-16` | Emit when the payment token is not allowed.                                                   |
| `InvalidBPSError`                    | `Int32` | `-17` | Emit when the `fee_bps` exceeds the allowable range.                                          |
| `NotEqualAmountError`                | `Int32` | `-18` | Emit when the required ZIL amount does not match the offer amount when paying by native ZILs. |
| `NotContractOwnershipRecipientError` | `Int32` | `-19` | Emit when the address is not a contract ownership recipient.                                  |
| `NotAllowedUserError`                | `Int32` | `-20` | Emit when the address is not listed in `allowlist_address` contract.                          |

### E1. Transitions

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

|    | Transition |
| -- | ---------- |
| 1   | `Start(token_address: ByStr20 with contract, token_id: Uint256, payment_token_address: ByStr20, start_amount: Uint128, expiration_bnum: BNum)` |
| 2   | `Bid(token_address: ByStr20 with contract, token_id: Uint256, amount: Uint128, dest: ByStr20)` |
| 3   | `Cancel(token_address: ByStr20 with contract, token_id: Uint256)` |
| 4   | `End(token_address: ByStr20 with contract, token_id: Uint256)` |
| 5   | `WithdrawPaymentTokens(payment_token_address: ByStr20)` |
| 6   | `WithdrawAsset(token_address: ByStr20, token_id: Uint256)` |
| 7   | `Pause()` |
| 8   | `Unpause()` |
| 9   | `SetServiceFeeBPS(fee_bps: Uint128)` | 
| 10  | `SetBidIncrementBPS(increment_bps: Uint128)` |
| 11  | `SetServiceFeeRecipient(to: ByStr20)` |
| 12  | `AllowPaymentTokenAddress(address: ByStr20 with contract)` |
| 13  | `DisallowPaymentTokenAddress(address: ByStr20 with contract)` |
| 14  | `SetAllowlist(address: ByStr20)` |
| 15  | `SetContractOwnershipRecipient(to: ByStr20)` |
| 16  | `AcceptContractOwnership()` |

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

```
{
    _eventname : "Start";
    maker: ByStr20;
    token_address: ByStr20;
    token_id: Uint256;
    payment_token_address: ByStr20;
    start_amount: Uint128;
    expiration_bnum: BNum
}
```

#### 2. `Bid`

Bids on an item.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `token_address`            | `ByStr20 with contract...` | ZRC-6 token contract address                                                        |
| `token_id`                 | `Uint256`                  | Token ID                                                                            |
| `amount`                   | `Uint128`                  | Bid amount                                                                          |
| `dest`                     | `ByStr20`                  | Enables buyers to set an address to receive the asset when fulfilling a sell order. |

**Requirements:**

- The contract must not be paused.
- There must be a valid sell order for the given `token_address` and `token_id` and it must not be expired.
- `_sender` must be listed in `allowlist_address` contract if `allowlist_address` is non-zero address.
- `dest` must be listed in `allowlist_address` contract if `allowlist_address` is non-zero address.

**Events:**

```
{
    _eventname : "Bid";
    maker: ByStr20;
    token_address: ByStr20;
    token_id: Uint256;
    amount: Uint128;
    dest: ByStr20
}
```

#### 3. `Cancel`

Cancel an auction listing. Asset and payment tokens would be refunded back to users.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `token_address`            | `ByStr20 with contract...` | ZRC-6 token contract address |
| `token_id`                 | `Uint256`                  | Token ID                     |

**Requirements:**

- The auction listing must not have expired. If it has expired, call `End` instead.

**Events:**

```
{
    _eventname : "Cancel";
    token_address: ByStr20;
    token_id: Uint256
}
```

#### 4. `End`

Ends an auction listing. Asset and payment tokens would be refunded back to users.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `token_address`            | `ByStr20 with contract...` | ZRC-6 token contract address |
| `token_id`                 | `Uint256`                  | Token ID                     |


**Requirements:**

- The contract must not be paused.
- There must be a valid sell order for the given `token_address` and `token_id` and it must not be expired.

**Events:**

```
{
    _eventname : "End";
    token_address: ByStr20;
    token_id: Uint256;
    payment_token_address: ByStr20;
    sale_price: Uint128;
    seller: ByStr20;
    buyer: ByStr20;
    asset_recipient: ByStr20;
    payment_tokens_recipient: ByStr20;
    royalty_recipient: ByStr20;
    royalty_amount: Uint128;
    service_fee: Uint128
}
```

#### 5. `WithdrawPaymentTokens`

Withdraw locked payment tokens. Used when buyers has lost the bids or for sellers to collect sales profits. Can only be used after auction listing is `Cancel` or `End`.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `payment_token_address`   | `ByStr20` | payment token address |

**Requirements:**

- The contract must not be paused.
- `_sender` must be listed in `allowlist_address` contract if `allowlist_address` is non-zero address.

**Events:**

```
{
    _eventname : "WithdrawPaymentTokens";
    recipient: ByStr20;
    payment_token_address: ByStr20;
    amount: Uint128
}
```

#### 6. `WithdrawAsset`

Withdraw NFT token from auction contract back to rightful owner. Used by seller to get back asset if the auction has no bids or for buyers to collect the artwork if they won the bid.

Can only be used after auction listing is `Cancel` or `End`.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `token_address`            | `ByStr20 with contract...` | ZRC-6 token contract address |
| `token_id`                 | `Uint256`                  | Token ID                     |

**Requirements:**

- The contract must not be paused.
- `_sender` must be listed in `allowlist_address` contract if `allowlist_address` is non-zero address.

**Events:**

```
{
    _eventname : "WithdrawAsset";
    recipient: ByStr20;
    token_address: ByStr20;
    token_id: Uint256
}
```

#### 7. `Pause`

Pauses the contract. Use this when things are going wrong ('circuit breaker').

**Requirements:**

- The contract must not be paused.
- `_sender` must be contract owner.

**Events:**

```
{
    eventname: "Pause";
    is_paused: Bool
}
```

#### 8. `Unpause`

Unpauses the contract.

**Requirements:**

- The contract must be paused.
- `_sender` must be contract owner.

**Events:**

```
{
    eventname: "Unpause";
    is_paused: Bool
}
```

#### 9. `SetServiceFeeBPS`

Sets the `service_fee_bps` field.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `fee_bps` | `Uint128` | New service fee bps |

**Requirements:**

- `_sender` must be contract owner.
- `fee_bps` must be within allowable range.

**Events:**

```
{
    eventname: "SetServiceFeeBPS";
    service_fee_bps: Uint128
}
```

#### 10. `SetBidIncrementBPS`

Sets the `bid_increment_bps` field.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `increment_bps` | `Uint128` | New increment bps |

**Requirements:**

- `_sender` must be contract owner.
- `increment_bps` must be within allowable range.

**Events:**

```
{
    eventname: "SetBidIncrementBPS";
    increment_bps: Uint128
}
```

#### 11. `SetServiceFeeRecipient`

Sets the `service_fee_recipient` field.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `to` | `ByStr20` | New service wallet address |

**Requirements:**

- `_sender` must be contract owner.
- `to` must be a valid destination wallet.

**Events:**

```
{
    eventname: "SetServiceFeeRecipient";
    to: ByStr20
}
```

#### 12. `AllowPaymentTokenAddress`

Allow a specific ZRC-2 token address to be used as payment token.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `address` | `ByStr20 with contract` | ZRC-2 token address |

**Requirements:**

- `_sender` must be contract owner.

**Events:**

```
{
    eventname: "AllowPaymentTokenAddress";
    payment_token_addresss: ByStr20
}
```

#### 13. `DisallowPaymentTokenAddress`

Remove a specific ZRC-2 token address as payment token.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `address` | `ByStr20 with contract` | ZRC-2 token address |

**Requirements:**

- `_sender` must be contract owner.

**Events:**

```
{
    eventname: "DisallowPaymentTokenAddress";
    payment_token_addresss: ByStr20
}
```

#### 14. `SetAllowlist`

Updates the `allowlist_address`, for the whitelisting of wallets on contract level.

Set to `zero_address` to remove wallets restriction.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `address` | `ByStr20` | New allowlist address |

**Requirements:**

- `_sender` must be contract owner.

**Events:**

```
{
    eventname: "SetAllowlist";
    address: ByStr20
}
```

#### 15. `SetContractOwnershipRecipient`

Set the `contract_ownership_recipient` field, for changing the contract owner.

To reset `contract_ownership_recipient`, use `zero_address`.

**Arguments:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| `to` | `ByStr20` | New contract owner address |

**Requirements:**

- `_sender` must be contract owner.
- `to` must not be the `_sender`.

**Events:**

```
{
    eventname: "SetContractOwnershipRecipient";
    to: ByStr20
}
```

#### 16. `AcceptContractOwnership`

Accepts the contract ownership transfer. `contract_owner` is replaced.

**Requirements:**

- `_sender` must be `contract_ownership_recipient`.

**Events:**

```
{
    eventname: "AcceptContractOwnership";
    contract_owner: ByStr20
}
```
