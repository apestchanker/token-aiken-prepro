import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../utils/WalletContext';
import { initKoios, signAndSubmit } from '../utils/meshUtils';
import { MeshTxBuilder } from '@meshsdk/core';
import { useEscrow } from '@/utils/EscrowContext';

export default function UtxosPage() {
  const { connected, wallet, connectedAddress } = useContext(WalletContext);
  const [utxos, setUtxos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { escrowDetails } = useEscrow();

  const fetchUtxos = async () => {
    try {
      const koios = initKoios();
      const data = await koios.fetchAddressUTxOs(escrowDetails.scriptAddress);
      setUtxos(data);
    } catch (err) {
      console.error('[UtxosPage] Error:', err);
    }
  };

  useEffect(() => {
    if (connected) {
      fetchUtxos();
    }
  }, [connected]);

  const handleAction = async (utxo: any, action: 'cancel' | 'withdraw') => {
    if (!wallet) return alert('No wallet connected');
    setLoading(true);

    try {
      const koios = initKoios();
      const txBuilder = new MeshTxBuilder({ fetcher: koios });

      txBuilder.txIn(
        utxo.input.txHash,
        utxo.input.outputIndex,
        utxo.output.amount,
        utxo.output.address
      );

      if (action === 'cancel') {
        const redeemerData = {
          constructor: 1, // CancelTrade
          fields: [],
        };
        txBuilder.redeemer(redeemerData);
      } else if (action === 'withdraw') {
        const redeemerData = {
          constructor: 2, // Withdraw
          fields: [],
        };
        txBuilder.redeemer(redeemerData);
      }

      txBuilder.changeAddress(connectedAddress);
      txBuilder.complete();

      await signAndSubmit(wallet, txBuilder.txHex);
      alert(`${action.charAt(0).toUpperCase() + action.slice(1)} successful`);
      fetchUtxos();
    } catch (err) {
      console.error(`[UtxosPage] ${action} Error:`, err);
      alert(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: '20px' }}>
      <h1>UTXOs Page</h1>
      <button onClick={fetchUtxos}>Refresh</button>
      <ul>
        {utxos.map((utxo, index) => (
          <li key={index}>
            <p>TxHash: {utxo.input.txHash}</p>
            <p>OutputIndex: {utxo.input.outputIndex}</p>
            <p>Amount: {utxo.output.amount.map((a: any) => `${a.quantity} ${a.unit}`).join(', ')}</p>
            <button onClick={() => handleAction(utxo, 'cancel')} disabled={loading}>
              {loading ? 'Cancelling...' : 'Cancel'}
            </button>
            <button onClick={() => handleAction(utxo, 'withdraw')} disabled={loading}>
              {loading ? 'Withdrawing...' : 'Withdraw'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
