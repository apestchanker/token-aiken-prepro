// pages/cancel.tsx
import React, { useState } from 'react';
import { BrowserWallet, MeshTxBuilder } from '@meshsdk/core';
import { initKoios, getEscrowScriptCbor, signAndSubmit } from '../utils/meshUtils';

export default function CancelPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [scriptUtxo, setScriptUtxo] = useState<string>(''); 
  const [loading, setLoading] = useState(false);

  // scriptUtxo might be "TxHash#OutputIndex" from an explorer
  // Because to cancel, we must spend the script UTxO

  const connectWallet = async () => {
    const w = await BrowserWallet.enable('eternl');
    setWallet(w);
  };

  const cancelTrade = async () => {
    if (!wallet) return alert('No wallet connected');
    setLoading(true);

    try {
      console.log('[cancelTrade] Starting cancel flow...');
      const koios = initKoios();
      const cbor = await getEscrowScriptCbor();

      // parse UTxO
      const [txHash, outIndexStr] = scriptUtxo.split('#');
      const outIndex = Number(outIndexStr);

      // CIP-30 method to find that script utxo
      const utxos = await wallet.getUtxos();
      const scriptOwnedUtxo = utxos.find((u: any) => {
        return u.input.txHash === txHash && u.input.outputIndex === outIndex;
      });

      if (!scriptOwnedUtxo) {
        throw new Error('Could not find the script UTxO in wallet');
      }

      // Build the Tx with "CancelTrade" redeemer
      const redeemerData = {
        constructor: 1, // or whatever matches your Aiken "CancelTrade"
        fields: [],
      };

      const txBuilder = new MeshTxBuilder({ fetcher: koios });

      txBuilder
        .txIn(
          scriptOwnedUtxo.input.txHash,
          scriptOwnedUtxo.input.outputIndex,
          scriptOwnedUtxo.output.amount,
          scriptOwnedUtxo.output.address
        )
        .redeemer(redeemerData)
        .changeAddress(scriptOwnedUtxo.output.address);

      txBuilder.complete();

      await signAndSubmit(wallet, txBuilder.txHex);
      console.log('[cancelTrade] Trade canceled successfully');
      alert('Cancel successful');
    } catch (err) {
      console.error('[cancelTrade] Error:', err);
      alert(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: '20px' }}>
      <h1>Cancel Page</h1>
      <button onClick={connectWallet}>Connect Wallet</button>

      <div style={{ marginTop: '10px' }}>
        <label>Script UTxO: </label>
        <input
          type="text"
          placeholder="TxHash#Index"
          value={scriptUtxo}
          onChange={(e) => setScriptUtxo(e.target.value)}
          style={{ width: '400px' }}
        />
      </div>

      <button disabled={loading} onClick={cancelTrade} style={{ marginTop: '10px' }}>
        {loading ? 'Cancelling...' : 'Cancel Trade'}
      </button>
    </div>
  );
}
