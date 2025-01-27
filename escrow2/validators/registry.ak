use modules/helper_functions.{decode_registry_datum, expect_some, compare_output_datum}
use aiken/primitive/string
use aiken/builtin.{
  un_constr_data,
  constr_data,
  b_data,
  i_data,
  list_data,
}
use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId, from_asset_list, merge}
use cardano/transaction.{InlineDatum, OutputReference, Transaction, Input, Output, find_input}

// Adjust or remove these if your environment does not have them
use cocktail/vodka_address.{address_pub_key}
use cocktail/vodka_extra_signatories.{all_key_signed, key_signed, one_of_keys_signed}
use cocktail/vodka_inputs.{inputs_at}
use cocktail/vodka_outputs.{outputs_at}
use cocktail/vodka_value.{get_all_value_to, value_geq}
// -----------------------------------------------------------------------------
// Registry Types
// -----------------------------------------------------------------------------

pub type RegistryDatum {
  Registry {
    contract_ids: List<ByteArray>,  // Registered contract IDs
    total_minted: Int,             // Total minted ALLI tokens
  }
}

pub type RegistryRedeemer {
  RegisterContract { contract_id: ByteArray }  // Register a new contract ID
  UpdateMinted { minted_amount: Int }          // Update the total minted tokens
}

// -----------------------------------------------------------------------------
// Registry Validator
// -----------------------------------------------------------------------------

validator registry {
  spend(
    datum: Option<RegistryDatum>,
    redeemer: RegistryRedeemer,
    input: OutputReference,
    tx: Transaction,
  ) {
    let Transaction { inputs, outputs, .. } = tx

    // Extract and decode the current datum
    let registry_datum = extract_and_decode_registry_datum(input, inputs)

    when redeemer is {
      RegisterContract { contract_id } -> {
        validate_registration(registry_datum, contract_id, outputs, input)
      }
      UpdateMinted { minted_amount } -> {
        validate_update_minted(registry_datum, minted_amount, outputs, input)
      }
    }
  }
}

