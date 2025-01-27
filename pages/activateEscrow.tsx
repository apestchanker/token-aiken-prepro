 // This will spend the script UTxO with "RecipientDeposit" redeemer
  // and produce a new UTxO at the same script address with an "ActiveEscrow" datum.
  const deposit = async () => {
    if (!wallet) return alert('No wallet connected');

    setLoading(true);

    try {
      console.log('[recipientDeposit] Starting...');
      const koios = initKoios();

      const initDatum = InitiationDatum; 

      // 1) Identify the script UTxO (the "Initiation" UTxO)
      const [scriptTxHash, scriptIndexStr] = scriptUtxo.split('#');
      const scriptIndex = parseInt(scriptIndexStr);

      // 2) Identify reference script
      const [refTxHash, refIndexStr] = refUtxo.split('#');
      const refIndex = parseInt(refIndexStr);

      // 3) We'll pick an input from B's wallet with enough to deposit
      const utxos = await wallet.getUtxos();
      const needed = Number(recipientDeposit);
      const chosen = utxos.find((u: any) => {
        const lov = u.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity;
        return Number(lov) > needed + 2000000;
      });
      if (!chosen) throw new Error('No suitable deposit UTxO from recipient');

      // 4) Build the correct redeemer & new inline datum

      // Redeemer: `RecipientDeposit { recipient, recipient_assets }`
      // -> constructor=0, fields=[ recipientAddress, MValue ]
      const redeemer = {
        constructor: 0,
        fields: [
          walletforTx, // recipient
          [
            // MValue for e.g. 5 ADA
            [
              "",
              [
                ["", needed]
              ]
            ]
          ],
        ],
      };

      // New datum => `ActiveEscrow` is constructor=1
      // fields=[ initiator, initiator_assets, recipient, recipient_assets ]
      // But we need the original `initiator` and `initiator_assets` from the old datum.
      // Typically, you read them from the chain's inline datum before building the new one.
      // For a simple demo, we'll HARDCODE or fetch from user input. 
      // Let's pretend we know initiator = "addr_test1..." etc.

      const initiator = "addr_test1qp...."; // You should decode from the old datum in real code
      const initiator_assets = [
        [
          "", 
          [
            ["", 7000000]
          ]
        ]
      ];

      const activeEscrowDatum = {
        constructor: 1,
        fields: [
          initiator,
          initiator_assets,
          walletforTx,    // current user B
          [
            [
              "",
              [
                ["", needed]
              ]
            ]
          ],
        ],
      };

      console.log('[recipientDeposit] Redeemer:', redeemer);
      console.log('[recipientDeposit] New Datum (ActiveEscrow):', activeEscrowDatum);

      const txBuilder = new MeshTxBuilder({ fetcher: koios });

      // The original script UTxO has some lovelace (7 ADA from A).
      // We'll spend that UTxO, applying the "RecipientDeposit" redeemer.
      // We'll also add B's deposit from B's own wallet input.
      txBuilder
        // a) script input
        .txIn(
          scriptTxHash,
          scriptIndex,
          [], // The script input's amounts can be discovered from chain or from CIP-30 getUtxos
          '', // We'll re-fetch amounts, see note below
        )
        .txInRedeemerValue(redeemer)
        
        // b) reference script
        .simpleScriptTxInReference(refTxHash, refIndex, scriptTxHash)

        // c) user B input (the deposit)
        .txIn(
          chosen.input.txHash,
          chosen.input.outputIndex,
          chosen.output.amount,
          chosen.output.address
        )

        // d) produce new output with updated datum
        .txOut(
          // same script address
          // (we can compute the script address if needed or we might store it from the previous step)
          "addr_test1wr5...THE_SCRIPT_ADDRESS...",
          [
            // Combine original 7 ADA + B's deposit 
            // For demonstration, let's just place (7 + deposit) ADA here. 
            // Aiken code checks that we increased value by B's deposit. 
            { unit: 'lovelace', quantity: String(7000000 + needed) }
          ],
          {
            datum: activeEscrowDatum,
          }
        )

        // e) leftover change to B
        .changeAddress(chosen.output.address);

      console.log('[recipientDeposit] Building...');
      txBuilder.complete();

      // 5) sign & submit
      const txHash = await signAndSubmit(wallet, txBuilder.txHex);
      console.log('[recipientDeposit] Done. txHash:', txHash);
      alert(`Recipient deposit complete! ${txHash}`);
    } catch (err) {
      console.error('[recipientDeposit] Error:', err);
      alert(String(err));
    } finally {
      setLoading(false);
    }
  };