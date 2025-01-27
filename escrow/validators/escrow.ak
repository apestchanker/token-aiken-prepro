use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId, from_asset_list}
use cardano/transaction.{InlineDatum, OutputReference, Transaction, find_input}
use cocktail/vodka_extra_signatories.{ one_of_keys_signed}
use cocktail/vodka_inputs.{inputs_at}
use cocktail/vodka_outputs.{outputs_at, outputs_with_policy}
use cocktail/vodka_value.{get_all_value_to, value_geq}
use aiken/builtin
use aiken/collection/pairs.{keys}
use aiken/collection/list.{at}


pub type MValue =
  Pairs<PolicyId, Pairs<AssetName, Int>>

pub type EscrowDatum {
  Initiation { fund: ByteArray, initiator: Address, initiator_assets: MValue }
  ActiveEscrow {
    fund: ByteArray,
    initiator: Address,
    initiator_assets: MValue,
    recipient: Address,
    alli_assets: MValue,
    investor_nft: MValue
  }
}

pub type EscrowRedeemer {
  Activate { fund: ByteArray, recipient: Address, alli_assets: MValue, investor_nft: MValue}
  CancelTrade
  CompleteTrade
}

const payment_cred1 = builtin.blake2b_224(
    "8946d99adcbc18aecae9be72ce70ff36c3d935ef9a02bcb7dc84cdf95124e2d"
)
const payment_cred2 = builtin.blake2b_224(
    "8946d99adcbc18aecae9be72ce70ff36c3d935ef9a02bcb7dc84cdf95124e2d"
)
const payment_cred3 = builtin.blake2b_224(
    "8946d99adcbc18aecae9be72ce70ff36c3d935ef9a02bcb7dc84cdf95124e2d"
)

pub const authorized_signatories = [
      payment_cred1, 
      payment_cred2,
      payment_cred3
  ]

validator escrow {
  spend(
    _datum: Option<EscrowDatum>,
    redeemer: EscrowRedeemer,
    input: OutputReference,
    tx: Transaction,
  ) {
    let Transaction { inputs, outputs, extra_signatories, .. } = tx
    expect Some(own_input) = find_input(inputs, input)
    let own_address = own_input.output.address
    when redeemer is {
      Activate { fund: fundr, recipient, alli_assets, investor_nft } -> {
        expect ([input], [output]) =
          (inputs_at(inputs, own_address), outputs_at(outputs, own_address))
        // Only 1 input & output from same address
        expect InlineDatum(raw_input_datum) = input.output.datum
        expect InlineDatum(raw_output_datum) = output.datum
        expect Initiation { fund, initiator, initiator_assets }: EscrowDatum =
          raw_input_datum
        expect output_datum: EscrowDatum = raw_output_datum
        let is_datum_updated =
          output_datum == ActiveEscrow {
            fund,
            initiator,
            initiator_assets,
            recipient,
            alli_assets,
            investor_nft
          }
        expect Some(policy_id) = list.at(keys(investor_nft),0)
        let is_nft_added = !list.is_empty(outputs_with_policy(outputs, policy_id))
        let is_ta_signed =
          one_of_keys_signed(
            extra_signatories,
            authorized_signatories,
          )
        is_datum_updated && is_nft_added && is_ta_signed && fundr==fund
      }
      CancelTrade -> {
        expect ([input], []) =
          (inputs_at(inputs, own_address), outputs_at(outputs, own_address))
        expect InlineDatum(raw_input_datum) = input.output.datum
        expect input_datum: EscrowDatum = raw_input_datum
        when input_datum is {
          Initiation { .. } -> {
            one_of_keys_signed(extra_signatories, authorized_signatories)
          }

          ActiveEscrow {
            initiator,
            initiator_assets,
            ..
          } -> {
            let initiator_received = get_all_value_to(outputs, initiator)
            let is_initiator_received_value =
              value_geq(
                initiator_received,
                initiator_assets |> from_asset_list(),
              )
            let is_ta_signed =
              one_of_keys_signed(
                extra_signatories,
                authorized_signatories,
              )
            is_ta_signed && is_initiator_received_value
          }
        }
      }
      CompleteTrade -> {
        expect ([input], []) =
          (inputs_at(inputs, own_address), outputs_at(outputs, own_address))
        expect InlineDatum(raw_input_datum) = input.output.datum
        expect ActiveEscrow {
          initiator,
          initiator_assets,
          recipient,
          alli_assets,
          investor_nft,
          ..
        }: EscrowDatum = raw_input_datum
        let initiator_received = get_all_value_to(outputs, initiator)
        let recipient_received = get_all_value_to(outputs, recipient)
        let is_initiator_received_value =
          value_geq(initiator_received, alli_assets |> from_asset_list())
        let is_recipient_received_value =
          value_geq(recipient_received, initiator_assets |> from_asset_list())
        expect Some(policy_id) = list.at(keys(investor_nft),0)
        let is_nft_added = !list.is_empty(outputs_with_policy(outputs, policy_id))
        let is_ta_signed =
          one_of_keys_signed(
            extra_signatories,
            authorized_signatories,
          )
        is_ta_signed && is_initiator_received_value && is_recipient_received_value && is_nft_added
      }
    }
  }

  else(_) {
    fail
  }
}
