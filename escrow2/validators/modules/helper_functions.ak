use aiken/builtin.{constr_data, i_data, list_data, un_b_data, un_constr_data}
use aiken/primitive/string
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

// Update the total minted tokens
// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

pub fn extract_and_decode_registry_datum(
  input: OutputReference,
  inputs: List<Input>,
) -> RegistryDatum {
  let own_input: Input =
   when inputs_at(inputs, input.output.address) is {
      [input] -> input
      _ -> fail @"Missing script input"
    }
    
  let raw_datum =
    when own_input.output.datum is {
      InlineDatum(value) -> value
      _ -> fail @"Expected inline datum on script input"
    }

  decode_registry_datum(raw_datum)
}

pub fn decode_registry_datum(raw_datum: Data) -> RegistryDatum {
  when un_constr_data(raw_datum) is {
    Pair(0, fields) -> {
      when fields is {
        [contract_ids, total_minted] -> {
          // Extract the first field: contract IDs
          let raw_contract_ids = contract_ids

          // get_nth(fields, 0, @"Missing contract IDs")
          //   |> list_data // Convert to List<Data>
          //   |> expect_some(@"Invalid contract IDs data")
          // Ensure it is a valid List<Data>
          let contract_ids = process_contract_ids(raw_contract_ids)

          // Extract the second field: total minted
          let raw_total_minted = total_minted

          //get_nth(fields, 1, @"Missing total minted")
          let total_minted =
            raw_total_minted
              |> i_data // Convert to Int
              
            |> {
                  expect "Invalid total minted data"
                }

          // Ensure it is a valid Int
          // Construct and return the RegistryDatum
          Registry { contract_ids, total_minted }
        }
        _ -> fail @"Invalid registry datum"
      }
      // Extract the first field: contract IDs
      let raw_contract_ids = fields.contract_ids

      // get_nth(fields, 0, @"Missing contract IDs")
      //   |> list_data // Convert to List<Data>
      //   |> expect_some(@"Invalid contract IDs data")
      // Ensure it is a valid List<Data>
      let contract_ids = process_contract_ids(raw_contract_ids)

      // Extract the second field: total minted
      let raw_total_minted = fields.total_minted

      //get_nth(fields, 1, @"Missing total minted")
      let total_minted =
        raw_total_minted
          |> i_data // Convert to Int
          
        |> {
              expect "Invalid total minted data"
            }

      // Ensure it is a valid Int
      // Construct and return the RegistryDatum
      Registry { contract_ids, total_minted }
    }
    _ -> fail @"Invalid registry datum"
  }
}

pub fn process_contract_ids(raw_contract_ids: List<Data>) -> List<ByteArray> {
  process_contract_ids_rec(raw_contract_ids, [])
}

fn process_contract_ids_rec(
  remaining: List<Data>,
  acc: List<ByteArray>,
) -> List<ByteArray> {
  when remaining is {
    [] -> acc
    // Base case: empty list, return accumulated result
    [head, ..tail] -> {
      let contract_id =
        un_b_data(head)
          |> {
              expect @"Invalid contract ID data"
            }
      let new_acc = Prepend([contract_id], acc)
      // Use `append` to add to the list
      process_contract_ids_rec(tail, new_acc)
    }
  }
  // Recurse with updated accumulator
}

pub fn get_nth(data_list: List<Data>, index: Int, msg: String) -> Data {
  when (data_list, index) is {
    ([], _) -> fail msg
    // Index out of bounds
    ([head, ..tail], 0) -> head
    ([head, ..tail], n) -> get_nth(tail, n - 1, msg)
  }
  // Recurse to find the element
}

pub fn validate_registration(
  registry_datum: RegistryDatum,
  contract_id: ByteArray,
  outputs: List<a>,
  input: OutputReference,
) -> Bool {
  when List.member(registry_datum.contract_ids, contract_id) is {
    True -> fail @"Contract ID already registered"
    False -> {
      let updated_contract_ids =
        List.concat(registry_datum.contract_ids, [contract_id])

      let updated_datum =
        Registry {
          contract_ids: updated_contract_ids,
          total_minted: registry_datum.total_minted,
        }

      compare_output_datum(updated_datum, outputs, input)
    }
  }
}

pub fn validate_update_minted(
  registry_datum: RegistryDatum,
  minted_amount: Int,
  outputs: List<a>,
  input: OutputReference,
) -> Bool {
  let new_total_minted = registry_datum.total_minted + minted_amount

  when new_total_minted > 1_000_000_000 is {
    True -> fail @"Exceeds max supply"
    False -> {
      let updated_datum =
        Registry {
          contract_ids: registry_datum.contract_ids,
          total_minted: new_total_minted,
        }

      compare_output_datum(updated_datum, outputs, input)
    }
  }
}

pub fn compare_output_datum(
  updated_datum: RegistryDatum,
  outputs: List<a>,
  input: OutputReference,
) -> Bool {
  let [script_output] =
    outputs_at(outputs, input.output.address)
      |> expect_single_output(@"Expected single output at own address")

  let raw_output_datum =
    when script_output.datum is {
      InlineDatum(value) -> value
      _ -> fail @"Expected inline datum on output"
    }

  raw_output_datum == encode_registry_datum(updated_datum)
}

pub fn encode_registry_datum(datum: RegistryDatum) -> Data {
  when datum is {
    Registry { contract_ids, total_minted } -> {
      let contract_ids_data =
        list_data(List.map(contract_ids, fn(id) { b_data(id) }))
      let total_minted_data = i_data(total_minted)

      constr_data(0, [contract_ids_data, total_minted_data])
    }
  }
}

pub fn find_registry_datum(inputs: List<Input>) -> Option<RegistryDatum> {
  List.find_map(
    inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(value) -> Some(decode_registry_datum(value))
        _ -> None
      }
    },
  )
}

pub fn expect_some(opt: Option<a>, msg: String) -> a {
  when opt is {
    Some(value) -> value
    None -> fail msg
  }
}

pub fn expect_single_output(outputs: List<Input>, msg: String) -> Input {
  when outputs is {
    [output] -> output
    _ -> fail msg
  }
}
