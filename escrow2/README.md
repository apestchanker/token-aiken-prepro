# TokenAllies smart aiken-test
TokenAiken Test 1

I want to write an Escrow type smartcontract in Aiken Language to be deployed in the blockchain Cardano. The Escrow involves 2 tokens, ADA and ALLI, there will be a conversion rate fixed at the time of creating the contract. The flow would be, USER A (Escrow Manager) will hold the Aiken compiled script as a reference script within its wallet, this Escrow manager has to open the contract by specifying the amounts involved (Amount of ADA, Amount of ALLIs) and the Address of the counterparty (user B) in a Datum and mint and send a unique NFT for that contract. Once that initial TX is confirmed. Then user B will be able to send its ADA to the contract. Once TX confirmed, USER A will be able to proceed or cancel with the Escrow. If Cancel, then ADAs shall be returned and NFT shall be left locked into the cancelled contract for ever. If Proceed, then the proper amount of ALLIs shall be minted and sent to the User B wallet, together with the unique NFT, and the ADAs shall be sent to User A wallet and the contract shall be closed.

## Minting Policy for ALLI Token

The minting policy for the ALLI token is defined in the `escrow.ak` file. The policy specifies the conditions under which the ALLI tokens can be minted. The `CompleteTrade` redeemer includes the logic for minting the ALLI tokens. When the trade is completed, the ALLI tokens are minted and sent to the recipient's wallet.

## Handling Multiple Escrow Contracts Simultaneously

To handle multiple Escrow contracts simultaneously, the following approaches are used:

1. **Unique NFTs for Each Contract**:
   - Mint a unique NFT for each Escrow contract when it is created.
   - Store the unique NFT in the contract's datum to identify the specific contract.
   - Ensure that each transaction related to the contract includes the unique NFT to link it to the correct contract.

2. **Unique Contract Addresses**:
   - Generate a unique address for each Escrow contract.
   - Store the contract-specific information (e.g., amounts, parties involved) in the datum associated with the unique address.
   - Ensure that each transaction related to the contract is sent to the correct unique address.

3. **Unique Datums for Each Contract**:
   - Create a unique datum for each Escrow contract, including a unique identifier (e.g., a UUID or a combination of the parties' addresses and a timestamp).
   - Store the contract-specific information (e.g., amounts, parties involved) in the unique datum.
   - Ensure that each transaction related to the contract includes the unique datum to link it to the correct contract.

4. **Registry Contract**:
   - A registry contract is used to keep track of all active Escrow contracts.
   - Each Escrow contract registers itself with the registry contract upon creation.
   - The registry contract maintains a mapping of unique identifiers to Escrow contract addresses, allowing easy lookup and management of multiple Escrow contracts.

5. **State Machine Pattern**:
   - The Escrow contracts follow a state machine pattern, transitioning through different states (e.g., Initiated, Active, Cancelled, Completed).
   - Unique identifiers are used to track the state of each Escrow contract, ensuring each contract follows a well-defined lifecycle.
-------------------------------------------
# 1. Code Review

## 1.1. Overview of Contract Components

Your contract consists of the following components:

### Types:

- **MValue**: Represents a multi-asset value.
- **EscrowDatum**: Represents the various states of the escrow.
- **EscrowRedeemer**: Represents the actions that can be performed on the escrow.
- **RegistryDatum & RegistryRedeemer**: Manage a registry of contracts.

### Validators:

- **escrow**: Handles escrow operations (`RecipientDeposit`, `CancelTrade`, `CompleteTrade`).
- **registry**: Manages the registration of new escrow contracts.

### Minting Policy:

- **alli_token**: Governs the minting of the ALLI token, restricted to `CompleteTrade` actions.

## 1.2. Detailed Analysis

### 1.2.1. Type Definitions

#### MValue:
```aiken
pub type MValue =
  Pairs<PolicyId, Pairs<AssetName, Int>>
```
- **Purpose**: Represents a collection of assets, each identified by a `PolicyId` and `AssetName` with corresponding quantities.
- **Evaluation**: Appropriately defined for handling multi-asset transactions.

#### EscrowDatum:
```aiken
pub type EscrowDatum {
  Initiation { initiator: Address, initiator_assets: MValue, unique_nft: MValue }
  ActiveEscrow {
    initiator: Address,
    initiator_assets: MValue,
    recipient: Address,
    recipient_assets: MValue,
    unique_nft: MValue,
  }
  Cancelled { unique_nft: MValue }
  Completed { unique_nft: MValue }
}
```
- **Purpose**: Captures the various states of an escrow:
  - **Initiation**: When the escrow is created by the initiator.
  - **ActiveEscrow**: When the recipient has deposited their assets.
  - **Cancelled & Completed**: Terminal states of the escrow.
- **Evaluation**: Comprehensive and well-structured to represent the lifecycle of an escrow.

#### EscrowRedeemer:
```aiken
pub type EscrowRedeemer {
  RecipientDeposit { recipient: Address, recipient_assets: MValue }
  CancelTrade
  CompleteTrade
}
```
- **Purpose**: Defines the actions that can be performed on an escrow:
  - **RecipientDeposit**: When the recipient deposits assets.
  - **CancelTrade**: To cancel the escrow.
  - **CompleteTrade**: To finalize the escrow.
- **Evaluation**: Clear and directly tied to the escrow's possible actions.

#### RegistryDatum & RegistryRedeemer:
```aiken
pub type RegistryDatum {
  Registry { contracts: Map<String, Address> }
}

pub type RegistryRedeemer {
  RegisterContract { contract_id: String, contract_address: Address }
}
```
- **Purpose**: Manages a registry of deployed escrow contracts.
- **Evaluation**: Enables scalability by allowing multiple escrow contracts to be managed centrally.

### 1.2.2. Validators

#### escrow Validator:
```aiken
validator escrow {
  spend(_datum: Option<EscrowDatum>, redeemer: EscrowRedeemer, input: OutputReference, tx: Transaction) { ... }
  else(_) { fail }
}
```
- **Functionality**:
  - **RecipientDeposit**:
    - Transitions the escrow from `Initiation` to `ActiveEscrow`.
    - Ensures only one input and one output are associated with the escrow address.
    - Validates that the recipient's assets are correctly deposited.
  - **CancelTrade**:
    - Can be invoked from either `Initiation` or `ActiveEscrow`.
    - **From Initiation**:
      - Requires the initiator's signature.
      - Transitions to `Cancelled`.
    - **From ActiveEscrow**:
      - Requires at least one of the initiator or recipient's signatures.
      - Ensures both parties receive their respective assets back.
      - Transitions to `Cancelled`.
  - **CompleteTrade**:
    - Finalizes the escrow.
    - Requires both the initiator's and recipient's signatures.
    - Ensures the correct transfer of assets.
    - Transitions to `Completed`.
- **Evaluation**:
  - **Strengths**:
    - Robust handling of different escrow states.
    - Proper signature verification ensuring only authorized actions.
    - Accurate asset transfer validations.
  - **Potential Improvements**:
    - **Minting Policy Restrictions**: The current `alli_token` minting policy allows minting on any `CompleteTrade` redeemer without verifying the origin. Consider restricting minting to specific escrow contracts by incorporating the script hash or additional validations.
    - **Error Handling**: While `fail` is used for unmatched cases, providing more granular error messages could aid in debugging.

#### registry Validator:
```aiken
validator registry {
  spend(_datum: Option<RegistryDatum>, redeemer: RegistryRedeemer, input: OutputReference, tx: Transaction) { ... }
  else(_) { fail }
}
```
- **Functionality**:
  - **RegisterContract**:
    - Adds new escrow contracts to the registry.
    - Ensures the `Registry` datum is correctly updated with the new contract.
- **Evaluation**:
  - **Strengths**:
    - Facilitates management of multiple escrow contracts.
    - Ensures consistency in contract registration.
  - **Potential Improvements**:
    - **Access Control**: Currently, there's no restriction on who can register contracts. Consider implementing authorization to allow only certain users (e.g., contract deployers) to register new contracts.

### 1.2.3. Minting Policy: alli_token
```aiken
minting_policy alli_token {
  mint(redeemer: EscrowRedeemer, _ctx: Transaction) {
    when redeemer is {
      CompleteTrade -> true
      else -> false
    }
  }
}
```
- **Functionality**:
  - Allows minting of the `ALLI` token only when the `CompleteTrade` redeemer is used.
- **Evaluation**:
  - **Strengths**:
    - Restricts minting to only when an escrow is completed.
  - **Potential Issues**:
    - **Lack of Authorization**: Currently, anyone can trigger a `CompleteTrade` to mint the `ALLI` token, potentially leading to unauthorized minting.
    - **Uniqueness Enforcement**: There's no mechanism ensuring that each `CompleteTrade` results in a unique `ALLI` token. This could lead to multiple tokens being minted from the same escrow contract.
- **Recommendations**:
  - **Restrict Minting to Specific Contracts**: Modify the minting policy to verify that the `CompleteTrade` redeemer is coming from a registered escrow contract. This can be achieved by checking the script hash or incorporating additional data within the redeemer.
  - **Ensure One-Time Minting**: Implement logic to ensure that each escrow contract can mint the `ALLI` token only once upon completion. This could involve tracking minted tokens or associating them with unique identifiers from the escrow.
  - 
  ## 2. Contract Flow Explanation

Let's delve into the operational flow of your Escrow contract, detailing the interactions between User A (Initiator), User B (Recipient), and the contract itself. We'll also explore the minting processes for the NFTs and the ALLI token.

### 2.1. Actors Involved

- **User A (Wallet A - Initiator):** Initiates the escrow by depositing assets and a unique NFT into the escrow contract.
- **User B (Wallet B - Recipient):** Participates by depositing their assets into the escrow.
- **Escrow Contract:** Manages the escrow process, handling deposits, cancellations, and completions.
- **Registry Contract:** Keeps track of all deployed escrow contracts.
- **ALLI Minting Policy:** Governs the minting of the ALLI token upon escrow completion.

### 2.2. Step-by-Step Flow

#### Step 1: Deploying Contracts

**Deploy the Registry Contract:**
- **Purpose:** Acts as a central registry to keep track of all deployed escrow contracts.
- **Action:** A deployer (could be User A) sends a transaction to deploy the registry contract.
- **Outcome:** The registry contract address is obtained and used for registering new escrow contracts.

**Deploy the Escrow Contract(s):**
- **Purpose:** Manages individual escrow instances.
- **Action:** For each new escrow, deploy a separate escrow contract.
- **Outcome:** Each escrow contract has a unique address and is registered in the registry contract.

#### Step 2: Registering an Escrow Contract

**Invoke RegisterContract on the Registry Contract:**
- **Action:** Send a transaction to the registry contract with the `RegisterContract` redeemer, providing a unique `contract_id` and the `contract_address` of the deployed escrow contract.
- **Outcome:** The registry contract updates its contracts map to include the new escrow contract.

```aiken
when redeemer is {
  RegisterContract { contract_id, contract_address } -> {
    ...
    output.datum == InlineDatum(Registry { contracts: updated_contracts })
  }
}
```

**Notes:**
- **Authorization:** Currently, any user can register contracts. To enhance security, consider restricting this action to authorized users only.
- **Uniqueness:** Ensure that each `contract_id` is unique to prevent overwriting existing entries.

#### Step 3: Initiating an Escrow

**User A (Initiator) Creates an Escrow:**
- **Action:** User A sends a transaction to the escrow contract with the following:
  - **Datum:** `Initiation` containing:
    - `initiator`: User A's address.
    - `initiator_assets`: Assets User A is depositing.
    - `unique_nft`: A unique NFT representing this escrow instance.
  - **Value:** Includes the `initiator_assets` and the `unique_nft`.
- **Outcome:** The escrow contract records the `Initiation` datum, effectively creating an active escrow awaiting the recipient's deposit.

```aiken
expect Initiation { initiator, initiator_assets, unique_nft }: EscrowDatum = raw_input_datum
```

**NFT Details:**
- **PolicyId & AssetName:** Define the uniqueness of the NFT.
- **Metadata:** Optionally includes metadata linking to the escrow details.

**Minting the Unique NFT:**
- **Action:** During the initiation, a minting policy (not fully shown in your code) should handle the minting of the `unique_nft`.
- **Outcome:** The NFT is minted and associated with this specific escrow instance.

**Considerations:**
- **Minting Policy:** Ensure that the minting policy for `unique_nft` is secure and restricts unauthorized minting.
- **Metadata:** Embed relevant metadata within the NFT to link it to the escrow details (e.g., `contract_id`, `initiator`, timestamp).

#### Step 4: Recipient Deposits Assets

**User B (Recipient) Deposits Assets:**
- **Action:** User B sends a transaction to the same escrow contract with the following:
  - **Redeemer:** `RecipientDeposit` containing:
    - `recipient`: User B's address.
    - `recipient_assets`: Assets User B is depositing.
  - **Value:** Includes `recipient_assets`.
- **Outcome:** The escrow contract transitions the escrow state from `Initiation` to `ActiveEscrow`.

```aiken
expect output_datum: EscrowDatum = raw_output_datum
let is_datum_updated =
  output_datum == ActiveEscrow {
    initiator,
    recipient,
    initiator_assets,
    recipient_assets,
    unique_nft,
  }
```

**Updating the Datum:**
- **Action:** The escrow validator updates the datum to `ActiveEscrow`, reflecting the receipt of assets from the recipient.
- **Outcome:** The escrow is now active and ready for cancellation or completion.

```aiken
let is_datum_updated = output_datum == ActiveEscrow { ... }
let is_value_deposited = value_geq(...)
is_datum_updated && is_value_deposited
```

**Notes:**
- **Asset Verification:** Ensures that the deposited assets meet or exceed the expected values.
- **Integrity Check:** Confirms that the datum is correctly updated to reflect the new state.

#### Step 5: Managing the Escrow

The escrow can be either cancelled or completed based on the actions of the parties involved.

**5.1. Cancelling the Escrow**

**User A or User B Cancels the Trade:**
- **Action:** Either party sends a transaction to the escrow contract with the `CancelTrade` redeemer.
- **Outcome:** The escrow transitions to the `Cancelled` state, returning assets to the respective parties.

```aiken
when redeemer is {
  CancelTrade -> { ... }
}
```

**Conditions for Cancellation:**

- **From Initiation:**
  - **Signature Required:** Ensures that only the initiator can cancel before the recipient deposits.
  - **Outcome:** Returns the initiator's assets and marks escrow as `Cancelled`.

- **From ActiveEscrow:**
  - **Signatures Required:** At least one of the initiator or recipient must sign.
  - **Outcome:** Returns both parties' assets and marks escrow as `Cancelled`.

**Datum Update:**
- **Action:** The datum is updated to `Cancelled`, reflecting the termination of the escrow.
- **Outcome:** Assets are returned, and the escrow is no longer active.

**5.2. Completing the Escrow**

**User A and User B Complete the Trade:**
- **Action:** Both parties collaboratively send a transaction with the `CompleteTrade` redeemer.
- **Outcome:** The escrow finalizes, transferring assets appropriately and triggering the minting of the `ALLI` token.

```aiken
when redeemer is {
  CompleteTrade -> { ... }
}
```

**Conditions for Completion:**

- **Both Parties' Signatures Required:** Ensures mutual agreement to complete the trade.
- **Asset Transfer Verification:**
  - **Initiator Receives Recipient's Assets:** Ensures the initiator gets what they are owed.
  - **Recipient Receives Initiator's Assets:** Ensures the recipient receives their deposited assets.

**Datum Update:**
- **Action:** Datum is updated to `Completed`.
- **Outcome:** Marks the escrow as finalized.

**Minting the ALLI Token:**
- **Trigger:** The `CompleteTrade` action.
- **Minting Policy (alli_token):**
  - **Allows Minting:** Only when the `CompleteTrade` redeemer is used.
  - **Restriction Needed:** To prevent unauthorized minting, ensure that only specific escrow contracts can trigger this action.
- **Outcome:** The `ALLI` token is minted, potentially serving as a reward or record of the completed trade.

```aiken
minting_policy alli_token {
  mint(redeemer: EscrowRedeemer, _ctx: Transaction) {
    when redeemer is {
      CompleteTrade -> true
      else -> false
    }
  }
}

```
# Section 3: Detailed Contract Flow

Let's walk through the entire lifecycle of an escrow transaction, highlighting the actions of both users, the minting of NFTs, and the interaction with the ALLI minting policy.

## 3.1. Actors and Their Roles

### User A (Wallet A - Initiator):
- Initiates the escrow by depositing assets and a unique NFT.
- Can cancel or complete the escrow.

### User B (Wallet B - Recipient):
- Deposits assets into the escrow.
- Can cancel or complete the escrow.

### Escrow Contract:
- Manages the state transitions of the escrow.
- Ensures secure and verified asset transfers.

### Registry Contract:
- Maintains a registry of all deployed escrow contracts.
- Facilitates management and tracking of multiple escrows.

### ALLI Minting Policy:
- Governs the minting of the ALLI token upon escrow completion.

## 3.2. Step-by-Step Flow

### Step 1: Deploying the Contracts

#### Deploy the Registry Contract:
- **Action**: User A deploys the registry contract.
- **Outcome**: The registry contract is live and ready to track escrow contracts.

#### Deploy the Escrow Contract(s):
- **Action**: For each new escrow, a separate escrow contract is deployed.
- **Outcome**: Each escrow contract has a unique address and is ready to manage an individual escrow instance.

### Step 2: Registering an Escrow Contract

#### User A Registers the Escrow Contract:
- **Action**: User A sends a transaction to the registry contract with the `RegisterContract` redeemer, providing a unique `contract_id` and the escrow contract's address.
- **Outcome**: The registry contract updates its contracts map to include the new escrow contract.

```aiken
expect Registry { contracts }: RegistryDatum = raw_input_datum
let updated_contracts = contracts.insert(contract_id, contract_address)
let is_registry_updated = output.datum == InlineDatum(Registry { contracts: updated_contracts })
```

### Step 3: Initiating the Escrow

#### User A Deposits Assets and Mints `unique_nft`:
- **Action**: User A sends a transaction to the escrow contract with the following:
  - **Datum**: `Initiation` containing:
    - `initiator`: User A's address.
    - `initiator_assets`: Assets User A is depositing.
    - `unique_nft`: A unique NFT representing this escrow instance.
  - **Value**: Includes `initiator_assets` and `unique_nft`.
- **Outcome**: The escrow contract records the `Initiation` datum, effectively locking the initiator's assets and the unique NFT.

```aiken
expect Initiation { initiator, initiator_assets, unique_nft }: EscrowDatum = raw_input_datum
```

#### Minting the `unique_nft`:
- **Action**: The NFT is minted via a separate minting policy or through the same transaction, ensuring that it's uniquely tied to this escrow instance.
- **Metadata**: The NFT can include metadata such as `contract_id`, `timestamp`, or other identifiers linking it to the escrow.

#### Example Metadata Structure:

```json
{
  "contract_id": "escrow123",
  "initiator": "addr1...",
  "timestamp": "2025-01-10T12:00:00Z"
}
```

- **Outcome**: The NFT serves as a unique identifier for the escrow, preventing duplication and facilitating tracking.

### Step 4: Recipient Deposits Assets

#### User B Deposits Assets into the Escrow:
- **Action**: User B sends a transaction to the escrow contract with the `RecipientDeposit` redeemer, specifying:
  - `recipient`: User B's address.
  - `recipient_assets`: Assets User B is depositing.
  - **Value**: Includes `recipient_assets`.
- **Outcome**: The escrow transitions to `ActiveEscrow`, recording both parties' assets.

```aiken
expect output_datum: EscrowDatum = raw_output_datum
let is_datum_updated =
  output_datum == ActiveEscrow {
    initiator,
    recipient,
    initiator_assets,
    recipient_assets,
    unique_nft,
  }
let is_value_deposited =
  value_geq(
    output.value,
    input.output.value
      |> merge(recipient_assets |> from_asset_list()),
  )
is_datum_updated && is_value_deposited
```

#### Updating the Datum:
- **Action**: The `ActiveEscrow` datum is set, reflecting the receipt of assets from both parties.
- **Outcome**: The escrow is now active, awaiting either cancellation or completion.

### Step 5: Managing the Escrow

#### 5.1. Cancelling the Escrow

##### User Initiates Cancellation:
- **Action**: Either User A or User B sends a transaction with the `CancelTrade` redeemer.
- **Outcome**: The escrow transitions to the `Cancelled` state, returning assets appropriately.

```aiken
when redeemer is {
  CancelTrade -> { ... }
}
```

##### Conditions for Cancellation:

###### From `Initiation`:
- **Signature Required**: Initiator's signature ensures that only they can cancel before recipient's deposit.
- **Outcome**: Returns initiator's assets and marks escrow as `Cancelled`.

###### From `ActiveEscrow`:
- **Signatures Required**: At least one of the initiator or recipient must sign.
- **Outcome**: Returns both parties' assets and marks escrow as `Cancelled`.

##### Datum Update:
- **Action**: The datum is updated to `Cancelled`, ensuring no further actions can be performed on this escrow.
- **Outcome**: Assets are returned, and the escrow is terminated.

#### 5.2. Completing the Escrow

##### Both Parties Agree to Complete the Trade:
- **Action**: User A and User B collaboratively send a transaction with the `CompleteTrade` redeemer.
- **Outcome**: The escrow finalizes, transferring assets and triggering the minting of the ALLI token.

```aiken
when redeemer is {
  CompleteTrade -> { ... }
}
```

##### Conditions for Completion:

###### Signatures Required:
- Both initiator and recipient must sign, ensuring mutual agreement.

###### Asset Transfer Verification:
- **Initiator Receives Recipient's Assets**: Ensures the initiator gets what they were owed.
- **Recipient Receives Initiator's Assets**: Ensures the recipient receives their deposited assets.

##### Datum Update:
- **Action**: Datum is updated to `Completed`.
- **Outcome**: Marks the escrow as finalized and records the completion.

#### Minting the ALLI Token:
- **Trigger**: The `CompleteTrade` action.
- **Minting Policy (`alli_token`)**:
  - **Allows Minting**: Only when the `CompleteTrade` redeemer is used.
  - **Restriction Needed**: To prevent unauthorized minting, ensure that only specific escrow contracts can trigger this action.
- **Outcome**: The ALLI token is minted, potentially serving as a reward, badge, or record of the successful escrow.

```aiken
minting_policy alli_token {
  mint(redeemer: EscrowRedeemer, _ctx: Transaction) {
    when redeemer is {
      CompleteTrade -> true
      else -> false
    }
  }
}
```

# 4. Summary and Recommendations

## 4.1. Code Enhancements

### Strengthen Minting Policy

#### Restrict Minting
Ensure that only specific, registered escrow contracts can trigger the minting of the ALLI token.

#### Incorporate Unique Identifiers
Use `unique_nft` or similar identifiers to enforce one-time minting per escrow instance.

**Example Enhancement:**

```aiken
minting_policy alli_token {
  mint(redeemer: EscrowRedeemer, ctx: Transaction) {
    when redeemer is {
      CompleteTrade -> {
        let scripts = ctx.scripts
        expect count(scripts.filter(s => s.hash == expected_escrow_hash)) >= 1
        true
      }
      else -> false
    }
  }
}
```

### Implement Access Control in Registry

#### Restrict Contract Registration
Allow only authorized users (e.g., contract deployers) to register new escrow contracts.

**Example Modification:**

```aiken
when redeemer is {
  RegisterContract { contract_id, contract_address } -> {
    expect key_signed(extra_signatories, authorized_pub_key)
    ...
  }
}
```

### Enhanced Error Handling

#### Granular Failures
Provide specific error messages for different failure scenarios to aid in debugging and user feedback.

---

## 4.2. Operational Best Practices

### Maintain Accurate Metadata

#### NFT Metadata
Ensure that each `unique_nft` contains comprehensive metadata linking it to its escrow instance.

#### ALLI Token Metadata
Include identifiers tying each ALLI token to its corresponding escrow completion.

### Thorough Testing on Testnets

#### Deploy and Test
Before moving to mainnet, rigorously test all functionalities on testnets like preprod or preview to identify and rectify issues.

#### Simulate Scenarios
Test various scenarios, including normal operations, cancellations, and potential edge cases.

### Monitor and Audit

#### Regular Audits
Periodically review contract code and deployments to ensure ongoing security and correctness.

#### Use Monitoring Tools
Employ blockchain monitoring tools to track contract interactions and token minting activities.

### Engage with the Community

#### Seek Feedback
Engage with the Cardano and Aiken communities for insights, feedback, and support.

#### Stay Updated
Keep abreast of updates in Aiken, Cardano's smart contract capabilities, and best practices.

---

## 4.3. Recommendations Summary

### Key Takeaways

1. **Robust State Management:** Your contract effectively manages the escrow's lifecycle through well-defined datums and redeemers.
2. **Secure Asset Transfers:** Proper verification of asset transfers ensures the integrity of the escrow process.
3. **Minting Policy Enhancements:** Strengthening the `alli_token` minting policy is crucial to prevent unauthorized token creation and ensure one-time minting per escrow instance.
4. **Centralized Contract Management:** The registry contract facilitates scalable management of multiple escrow contracts, enhancing operational efficiency.





