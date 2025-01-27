use aiken/builtin.{b_data, constr_data, i_data, list_data, un_constr_data}
use aiken/primitive/string
use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId, find_policy_id, from_asset_list, merge}
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
use modules/helper_functions.{
  encode_registry_datum, expect_single_output, expect_some, find_registry_datum,
}
use validators/escrow.{
  authorized_signatories
}

// -----------------------------------------------------------------------------
// Registry Types
// -----------------------------------------------------------------------------

pub type RegistryDatum {
  Registry {
    contract_ids: List<ByteArray>,
    // Registered contract IDs
    total_minted: Int,
  }
}

// Total minted ALLI tokens

pub type RegistryRedeemer {
  RegisterContract { contract_id: ByteArray }
  // Register a new contract ID
  UpdateMinted { minted_amount: Int }
}

// -----------------------------------------------------------------------------
// ALLI Minting Policy Validator
// -----------------------------------------------------------------------------

validator mint_alli {
  mint(
    redeemer: RegistryRedeemer,
    policy_id: PolicyId,
    ctx: Transaction,
  ) {
    let Transaction {
      mint,
      redeemers,
      inputs,
      outputs,
      extra_signatories,
      ..
    } = ctx

    let tomint_amount = when redeemer is {
      UpdateMinted { minted_amount } -> minted_amount
      _ -> fail
    }

    // Ensure the transaction is signed by one of the authorized signatories
    let is_authorized_signatory =
      one_of_keys_signed(extra_signatories, authorized_signatories)
        |> expect("Unauthorized signatory")

    // Ensure the correct amount is minted
    let is_correct_mint =
      mint == from_asset_list([AssetName("ALLI", policy_id)], tomint_amount)
        |> expect("Minting redeemer is correct")

    // Check if the registry tracks the minting (via inputs/outputs)
    expect Some(registry: RegistryDatum) =
      find_registry_datum(inputs)
    let new_total_minted = registry.total_minted + tomint.amount

    when new_total_minted > 1_000_000_000 is {
      True -> fail "Minting exceeds maximum supply"
      False -> {
        // Ensure registry output reflects the updated minting total
        let registry_output: Input =
          outputs_at(outputs, registry.output_address)
            |> expect_single_output(@"Registry output not found or invalid")

        let updated_datum =
          Registry {
            contract_ids: registry.contract_ids,
            total_minted: new_total_minted,
          }

        let raw_registry_datum = encode_registry_datum(updated_datum)
        raw_registry_datum == registry_output.datum
      }
    }
  }

  else(_) {
    fail
  }
}
