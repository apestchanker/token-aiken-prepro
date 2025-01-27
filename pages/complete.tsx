// pages/complete.tsx
import React, { useState } from 'react';
import { BrowserWallet, MeshTxBuilder } from '@meshsdk/core';
import { initKoios, getEscrowScriptCbor, signAndSubmit } from '../utils/meshUtils';

export default function CompletePage() {
  const [wallet, setWallet] = useState<any>(null);
  const [scriptUtxo, setScriptUtxo] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const connectWallet = async () => {
    const w = await BrowserWallet.enable('eternl');
    setWallet(w);
  };

  const completeTrade = async () => {
    if (!wallet) return alert('No wallet connected');
    setLoading(true);

    try {
      console.log('[completeTrade] Starting trade completion...');
      const koios = initKoios();
      const cbor = await getEscrowScriptCbor();

      // parse script utxo
      const [txHash, outIndexStr] = scriptUtxo.split('#');
      const outIndex = Number(outIndexStr);

      const utxos = await wallet.getUtxos();
      const scriptOwnedUtxo = utxos.find((u: any) => {
        return u.input.txHash === txHash && u.input.outputIndex === outIndex;
      });
      if (!scriptOwnedUtxo) {
        throw new Error('Could not find script UTxO in wallet');
      }

      // Redeemer for "CompleteTrade"
      const redeemerData = {
        constructor: 2, // match your Aiken "CompleteTrade"
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
      console.log('[completeTrade] Trade completed successfully');
      alert('Trade completed successfully');
    } catch (err) {
      console.error('[completeTrade] Error:', err);
      alert(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: '20px' }}>
      <h1>Complete Page</h1>
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

      <button disabled={loading} onClick={completeTrade} style={{ marginTop: '10px' }}>
        {loading ? 'Completing...' : 'Complete Trade'}
      </button>
    </div>
  );
}
