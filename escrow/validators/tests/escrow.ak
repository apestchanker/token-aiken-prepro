use cardano/address.{Address, from_verification_key}
use cardano/assets.{add, from_asset, from_lovelace}
use cardano/transaction.{Transaction}
use escrow.{
  ActiveEscrow, CancelTrade, CompleteTrade, EscrowDatum, Initiation, MValue,
  Activate
}
use cocktail/vodka_address.{address_payment_key}

use mocktail.{
  complete, mocktail_tx, required_signer_hash, tx_in, tx_in_inline_datum, tx_out,
  tx_out_inline_datum,
}
use mocktail/virgin_address.{mock_pub_key_address, mock_script_address}
use mocktail/virgin_output_reference.{mock_tx_hash, mock_utxo_ref}
use aiken/builtin 

type CancelTestCase {
  is_at_initiation: Bool,
  is_initiator_received_value: Bool,
  is_recipient_received_value: Bool,
  is_recipient_signed: Bool,
}

fn test_lovelace() -> MValue {
  [Pair("", [Pair("", 2_000_000)])]
}

fn test_nft() -> MValue {
  [Pair("investor_policy", [Pair("INV", 1)])]
}

fn test_alli() -> MValue {
  [Pair("alli_policy", [Pair("ALLI", 2_000_000)])]
}

fn initiator_address() -> Address {
  mock_pub_key_address(0, None)
}

fn recipient_address() -> Address {
  mock_pub_key_address(1, None)
}

fn fund1() -> ByteArray {
  "Fund1"
}

fn initiation_datum() -> EscrowDatum {
  let initiator_assets: MValue = test_lovelace()
  let fund: ByteArray = fund1()
  Initiation { fund, initiator: initiator_address(), initiator_assets }
}

fn active_datum(recipient: Address, investor_nft: MValue) -> EscrowDatum {
  ActiveEscrow {
    fund: fund1(),
    initiator: initiator_address(),
    initiator_assets: test_lovelace(),
    recipient,
    alli_assets: test_alli(),
    investor_nft,
  }
}

fn get_ta_signing_key() -> ByteArray {
    let payment_cred1 = builtin.blake2b_224(
        "8946d99adcbc18aecae9be72ce70ff36c3d935ef9a02bcb7dc84cdf95124e2d"
    )
    //let stake_crede1: StakeCredential = builtin.blake2b_224("f96da3f60e244545c7055088b8b1b69cbefff3933a1cb9659")
    let ta_address = from_verification_key(payment_cred1)
    let ta_signing_key = address_payment_key (ta_address)
    ta_signing_key
}

fn get_cancel_test_tx(test_case: CancelTestCase) -> Transaction {
  let CancelTestCase {
    is_at_initiation,
    is_initiator_received_value,
    is_recipient_received_value,
    is_recipient_signed,
  } = test_case

  let initiator_output_value =
    if is_initiator_received_value {
      from_lovelace(2_000_000)
    } else {
      from_asset("alli_policy", "ALLI", 2_000_000)
    }
  let recipient_output_value =
    if is_recipient_received_value {
      from_asset("alli_policy", "ALLI", 2_000_000)
    } else {
      from_lovelace(2_000_000)
    }

  mocktail_tx()
    |> tx_in(
        True,
        mock_tx_hash(0),
        1,
        from_lovelace(2_000_000),
        mock_script_address(0, None),
      )
    |> tx_in_inline_datum(is_at_initiation, initiation_datum())
    |> tx_in_inline_datum(
        !is_at_initiation,
        active_datum(
          mock_pub_key_address(1, None),
          [Pair("alli_policy", [Pair("ALLI", 1)])],
        ),
      )
    |> tx_out(True, initiator_address(), initiator_output_value)
    |> tx_out(True, recipient_address(), recipient_output_value)
    |> required_signer_hash(is_recipient_signed, get_ta_signing_key())
    |> complete()
}

test success_cancel_alltrue() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CancelTrade
  let test_case =
    CancelTestCase {
      is_at_initiation: True,
      is_initiator_received_value: True,
      is_recipient_received_value: True,
      is_recipient_signed: True,
    }

  let tx = get_cancel_test_tx(test_case)
  escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test success_cancel_at_active_signed() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CancelTrade
  let test_case =
    CancelTestCase {
      is_at_initiation: False,
      is_initiator_received_value: True,
      is_recipient_received_value: True,
      is_recipient_signed: True,
    }

  let tx = get_cancel_test_tx(test_case)
  escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test success_cancel_at_active_with_recipient_not_receiving() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CancelTrade
  let test_case =
    CancelTestCase {
      is_at_initiation: True,
      is_initiator_received_value: True,
      is_recipient_received_value: False,
      is_recipient_signed: True,
    }

  let tx = get_cancel_test_tx(test_case)
  escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_cancel_at_initiation_without_signature() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CancelTrade
  let test_case =
    CancelTestCase {
      is_at_initiation: True,
      is_initiator_received_value: True,
      is_recipient_received_value: True,
      is_recipient_signed: False,
    }

  let tx = get_cancel_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_cancel_at_active_without_signature() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CancelTrade
  let test_case =
    CancelTestCase {
      is_at_initiation: False,
      is_initiator_received_value: True,
      is_recipient_received_value: True,
      is_recipient_signed: False,
    }

  let tx = get_cancel_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_cancel_without_initiator_value_returned() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CancelTrade
  let test_case =
    CancelTestCase {
      is_at_initiation: False,
      is_initiator_received_value: False,
      is_recipient_received_value: True,
      is_recipient_signed: True,
    }

  let tx = get_cancel_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

type ActivateTestCase {
  is_datum_updated: Bool,
  is_nft_deposited: Bool,
  is_recipient_signed: Bool,
}

fn get_deposit_test_tx(test_case: ActivateTestCase) -> Transaction {
  let ActivateTestCase { is_datum_updated, is_nft_deposited, is_recipient_signed } =
    test_case
  let input_value = from_lovelace(2_000_000)
  let output_value =
    input_value
        |> if is_nft_deposited {
            add(_,"investor_policy", "INV", 1)
        } else {
            add(_, "", "", 0)
        }

  mocktail_tx()
    |> tx_in(True, mock_tx_hash(0), 1, input_value, mock_script_address(0, None))
    |> tx_in_inline_datum(True, initiation_datum())
    |> tx_out(True, mock_script_address(0, None), output_value)
    |> tx_out_inline_datum(
        is_datum_updated,
        active_datum(
            mock_pub_key_address(1, None),
            [Pair("investor_policy", [Pair("INV", 1)])],
        ),
      )
    |> tx_out_inline_datum(!is_datum_updated, initiation_datum())
    |> required_signer_hash(is_recipient_signed, get_ta_signing_key())
    |> complete()
}

test success_activate() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer =
    Activate {
        fund: fund1(),
        recipient: mock_pub_key_address(1, None),
        alli_assets: test_alli(),
        investor_nft: test_nft(),
    }
  let test_case =
    ActivateTestCase {
      is_datum_updated: True,
      is_nft_deposited: True,
      is_recipient_signed: True,
    }

  let tx = get_deposit_test_tx(test_case)
  escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_activate_without_updating_datum() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer =
    Activate {
        fund: fund1(),
        recipient: mock_pub_key_address(1, None),
        alli_assets: test_alli(),
        investor_nft: test_nft(),
    }
  let test_case =
    ActivateTestCase {
      is_datum_updated: False,
      is_nft_deposited: True,
      is_recipient_signed: True,
    }

  let tx = get_deposit_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_activate_without_depositing_nft() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer =
    Activate {
        fund: fund1(),
        recipient: mock_pub_key_address(1, None),
        alli_assets: test_alli(),
        investor_nft: test_nft(),
    }
  let test_case =
    ActivateTestCase {
      is_datum_updated: True,
      is_nft_deposited: False,
      is_recipient_signed: True,
    }

  let tx = get_deposit_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_activate_without_signing() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer =
    Activate {
        fund: fund1(),
        recipient: mock_pub_key_address(1, None),
        alli_assets: test_alli(),
        investor_nft: test_nft(),
    }
  let test_case =
    ActivateTestCase {
      is_datum_updated: True,
      is_nft_deposited: True,
      is_recipient_signed: False,
    }

  let tx = get_deposit_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

type CompleteTestCase {
    is_nft_added: Bool,
    is_initiator_received_value: Bool,
    is_recipient_signed: Bool,
    is_recipient_received_value: Bool,
}

fn get_complete_test_tx(test_case: CompleteTestCase) -> Transaction {
  let CompleteTestCase {
    is_nft_added,
    is_initiator_received_value,
    is_recipient_signed,
    is_recipient_received_value,
  } = test_case
  let input_datum =
    ActiveEscrow {
        fund: fund1(),
        initiator: mock_pub_key_address(0, None),
        initiator_assets: test_lovelace(),
        recipient: mock_pub_key_address(1, None),
        alli_assets: test_alli(),
        investor_nft: test_nft(),
    }

  mocktail_tx()
    |> required_signer_hash(is_recipient_signed, get_ta_signing_key())
    |> tx_in(
        True,
        mock_tx_hash(0),
        1,
        from_lovelace(2_000_000) |> add("alli_policy", "ALLI", 2_000_000),
        mock_script_address(0, None),
      )
    |> tx_in_inline_datum(True, input_datum)
    |> tx_out(
        is_initiator_received_value,
        mock_pub_key_address(0, None),
        from_asset("alli_policy", "ALLI", 2_000_000),
      )
      |> tx_out(
        is_nft_added,
        mock_pub_key_address(0, None),
        from_asset("investor_policy", "INV", 1),
      )
    |> tx_out(
        is_recipient_received_value,
        mock_pub_key_address(1, None),
        from_lovelace(2_000_000),
      )
    |> complete()
}

test success_complete() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CompleteTrade
  let test_case =
    CompleteTestCase {
        is_nft_added: True,
      is_initiator_received_value: True,
      is_recipient_signed: True,
      is_recipient_received_value: True,
    }

  let tx = get_complete_test_tx(test_case)
  escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_complete_without_nft_added() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CompleteTrade
  let test_case =
    CompleteTestCase {
      is_nft_added: False,
      is_initiator_received_value: True,
      is_recipient_signed: True,
      is_recipient_received_value: True,
    }

  let tx = get_complete_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_complete_without_value_sent_to_initiator() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CompleteTrade
  let test_case =
    CompleteTestCase {
      is_nft_added: True,
      is_initiator_received_value: False,
      is_recipient_signed: True,
      is_recipient_received_value: True,
    }

  let tx = get_complete_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_complete_without_recipeint_signed() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CompleteTrade
  let test_case =
    CompleteTestCase {
      is_nft_added: True,
      is_initiator_received_value: True,
      is_recipient_signed: False,
      is_recipient_received_value: True,
    }

  let tx = get_complete_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}

test fail_complete_without_value_sent_to_recipient() {
  let output_reference = mock_utxo_ref(0, 1)
  let unused_mock_datum = Some(initiation_datum())
  let redeemer = CompleteTrade
  let test_case =
    CompleteTestCase {
      is_nft_added: True,
      is_initiator_received_value: True,
      is_recipient_signed: True,
      is_recipient_received_value: False,
    }

  let tx = get_complete_test_tx(test_case)
  !escrow.escrow.spend(unused_mock_datum, redeemer, output_reference, tx)
}