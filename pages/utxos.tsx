import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../utils/WalletContext';
import { initKoios, signAndSubmit } from '../utils/meshUtils';
import { MeshTxBuilder } from '@meshsdk/core';
import { useEscrow } from '@/utils/EscrowContext';
import { Table, Tooltip, IconButton } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import WithdrawIcon from '@mui/icons-material/AccountBalanceWallet';

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
      <Table>
        <thead>
          <tr>
            <th>TxHash</th>
            <th>OutputIndex</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {utxos.map((utxo, index) => (
            <tr key={index}>
              <td>{utxo.input.txHash}</td>
              <td>{utxo.input.outputIndex}</td>
              <td>{utxo.output.amount.map((a: any) => `${a.quantity} ${a.unit}`).join(', ')}</td>
              <td>
                <Tooltip title="Cancel">
                  <IconButton onClick={() => handleAction(utxo, 'cancel')} disabled={loading}>
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Withdraw">
                  <IconButton onClick={() => handleAction(utxo, 'withdraw')} disabled={loading}>
                    <WithdrawIcon />
                  </IconButton>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
