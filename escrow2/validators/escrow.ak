use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId, from_asset_list, merge}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction, find_input,
}
// Adjust or remove these if your environment does not have them
use cocktail/vodka_address.{address_pub_key}
use cocktail/vodka_extra_signatories.{
  all_key_signed, key_signed, one_of_keys_signed,
}
use cocktail/vodka_inputs.{inputs_at}
use cocktail/vodka_outputs.{outputs_at}
use cocktail/vodka_value.{get_all_value_to, value_geq}

// -----------------------------------------------------------------------------
// Shared Types
// -----------------------------------------------------------------------------

pub type MValue =
  Pairs<PolicyId, Pairs<AssetName, Int>>

// -----------------------------------------------------------------------------
// Escrow Types
// -----------------------------------------------------------------------------

pub type EscrowDatum {
  Initiation {
    fund: ByteArray,
    initiator: Address,
    initiator_assets: MValue,
    exchange_rate: Int,
  }
  ActiveEscrow {
    fund: ByteArray,
    initiator: Address,
    initiator_assets: MValue,
    recipient: Address,
    alli_assets: MValue,
    exchange_rate: Int,
    unique_nft: MValue,
  }
  Cancelled { 
    fund: ByteArray,
    initiator_assets: MValue,
    unique_nft: MValue }
  Completed { 
    fund: ByteArray,
    exchange_rate: Int,
    alli_assets: MValue,
    initiator_assets: MValue,
    unique_nft: MValue }
}

pub type EscrowRedeemer {
  TokenAlliesActivates { fund: ByteArray, recipient: Address, exchange_rate: Int }
  CancelTrade { fund: ByteArray, initiator: Address, initiator_assets: MValue }
  CompleteTrade { fund: ByteArray, initiator: Address, initiator_assets: MValue, alli_assets: MValue }
}

pub const ta_addr1="addr_test1qzy5dkv6mj7p3tk2axl89nnslumv8kf4a7dq909hmjzvm723yn3dl9k68aswy3z5t3c92zyt3vdknjl0luun8gwtjevsnqg0ng"
pub const ta_addr2="addr_test1qpgzv6fytsl7fg4htxkvrlhq83ytmx6wryh0rzrmvs9asqrvawkzn6eqgpekwadfakznxj70tzepz54g0ppfqyuzefnq7lcxng"
pub const ta_addr3="addr_test1qp35p3y4le3glcmueytdfvd7yfzu5gfgnj5jnra5jp7s26z7na8mpsdm8cj6svpvdv7a5yp96gvwwflm8ae6xjymwm2snkd6ep"
   // List of authorized signatories TOB REPLACED IN DATUM
pub const authorized_signatories = [
      address_pub_key(ta_addr1), 
      address_pub_key(ta_addr2),
      address_pub_key(ta_addr3)
  ]
// -----------------------------------------------------------------------------
// Escrow Validator
// -----------------------------------------------------------------------------

validator escrow {
  spend(
    datum: Option<EscrowDatum>,
    redeemer: EscrowRedeemer,
    input: OutputReference,
    tx: Transaction,
  ) {
    let Transaction { inputs, outputs, extra_signatories, .. } = tx
    expect Some(own_input) = find_input(inputs, input)
    let own_address = own_input.output.address
    
     // We will be using exactly one input from this script address
    expect ([script_input]) =
      inputs_at(inputs, own_address)

    // Pull out inline data from input
    expect InlineDatum(raw_input_datum) = script_input.output.datum

    when raw_input_datum is {
      Some(EscrowDatum) -> {
        when redeemer is {
          // Token allies ACTIVATES the Escrow after investor Deposits
          TokenAlliesActivates { fund, recipient, exchange_rate } -> {

            expect ([script_output]) =
              outputs_at(outputs, own_address)

            // Pull out inline data from input/output
            expect InlineDatum(raw_output_datum) = script_output.datum
            expect output_datum: EscrowDatum = raw_output_datum
            
            let is_datum_updated =
              output_datum == datum

            let is_value_deposited =
              value_geq(
                script_output.value,
                script_input.output.value
                  |> merge(initiator_assets |> from_asset_list()),
              )

            is_datum_updated && is_value_deposited
            
            fund == output_datum.fund
            exchange_rate > 0

            one_of_keys_signed(extra_signatories, authorized_signatories)
            
            when recipient is {
              ta_addr1 -> True
              ta_addr2 -> True
              ta_addr3 -> True
              _ -> False
            }
          }

          CancelTrade { fund, initiator, initiator_assets }-> {
            fund == raw_input_datum.fund
            initiator == raw_input_datum.initiator
            initiator_assets == raw_input_datum.initiator_assets

            when raw_input_datum is {
              or {Initiation { initiator, .. }, ActiveEscrow {
                initiator,
                recipient,
                initiator_assets,
                unique_nft,
              }} -> {
                // If contract is in Initiation or ActiveEscrow, only TokenAllies can cancel
                
                one_of_keys_signed(extra_signatories, authorized_signatories)
                let initiator_received = get_all_value_to(outputs, initiator)
                let is_initiator_received_value =
                  value_geq(
                    initiator_received,
                    initiator_assets |> from_asset_list(),
                  )
                is_initiator_received_value
                expect (policy_id, _) = unique_nft
                expect ([script_output]) = outputs_at(outputs, own_address)
                expect Some(Output) = outputs_with_policy(script_output, policy_id)
              }

              _ -> False
            }
          }

          CompleteTrade { fund, initiator, initiator_assets, alli_assets } -> {

            // Must be in ActiveEscrow to complete
            expect ActiveEscrow {
              d_fund,
              d_initiator,
              d_recipient,
              d_initiator_assets,
              d_alli_assets,
              d_exchange_rate,
              d_unique_nft,
            }: EscrowDatum = raw_input_datum

            expect d_initiator == initiator
            expect d_initiator_assets == initiator_assets
            expect d_alli_assets == alli_assets
            expect d_exchange_rate > 0
            expect d_fund == fund
            expect (MValue) = d_unique_nft
            
            // initiator receives the recipient_assets, recipient receives initiator_assets
            let initiator_received = get_all_value_to(outputs, d_initiator)
            let recipient_received = get_all_value_to(outputs, d_recipient)

            let is_initiator_received_value =
              value_geq(initiator_received, d_alli_assets |> from_asset_list())
            let is_recipient_received_value =
              value_geq(recipient_received, d_initiator_assets |> from_asset_list())

            expect Some(initiator_pub_key) = address_pub_key(d_initiator)
            expect Some(recipient_pub_key) = address_pub_key(d_recipient)

            let is_alli_signed =
              one_of_keys_signed(
                extra_signatories,
                authorized_signatories,
              )

            is_alli_signed && is_initiator_received_value && is_recipient_received_value
          }
        }
      }
      //Catch bogus money sent to the contract address
      _ -> { 
        one_of_keys_signed(extra_signatories, 
          authorized_signatories)
        outputs_at (outputs, ta_addr1)
      }
    }
  }

  else(_) {
    fail
  }
}
