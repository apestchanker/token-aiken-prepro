import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../utils/WalletContext';
import { MeshEscrowContract, initKoios } from '../utils/escrowUtils';
import { Asset, UTxO } from '@meshsdk/core';
import { useRouter } from 'next/router';

interface EscrowDetails {
  txHash: string;
  walletAddress: string;
  initiatorDatum: any;
  refHash: string;
  refIndex: number;
  scriptHash: string;
  scriptCbor: string;
  timestamp: number;
}

export default function RecipientDeposit() {
  const { connected, wallet, connectedAddress } = useContext(WalletContext);
  const [loading, setLoading] = useState<boolean>(false);
  const [deposit, setDeposit] = useState<string>('5000000'); // Default 5 ADA
  const [escrowDetails, setEscrowDetails] = useState<EscrowDetails | null>(null);
  const [escrowUtxo, setEscrowUtxo] = useState<UTxO | null>(null);
  const [legend, setLegend] = useState<string>('');
  
  const router = useRouter();
  const koios = initKoios();
  useEffect(() => {
    // Load escrow details from localStorage
    const lastEscrow = localStorage.getItem('lastEscrow');
    if (lastEscrow) {
      setEscrowDetails(JSON.parse(lastEscrow));
    }
  }, []);

  useEffect(() => {
    if (escrowDetails && connected) {
      loadEscrowUtxo();
    }
  }, [escrowDetails, connected]);

  const loadEscrowUtxo = async () => {
    try {
      const meshContract = new MeshEscrowContract({
        fetcher: koios,
        submitter: koios,
        networkId: 0, // 0 for testnet
      });

      const utxo = await meshContract.getUtxoByTxHash(escrowDetails!.txHash);
      if (utxo) {
        setEscrowUtxo(utxo);
        setLegend('Escrow UTXO found. Ready to deposit.');
      } else {
        setLegend('Escrow UTXO not found. The transaction might still be processing.');
      }
    } catch (error) {
      console.error('[RecipientDeposit] Error loading UTXO:', error);
      setLegend(`Error loading UTXO: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDeposit = async () => {
    if (!escrowUtxo || !connected) {
      setLegend('Please connect wallet and wait for UTXO to load');
      return;
    }

    setLoading(true);
    try {
      const meshContract = new MeshEscrowContract({
        fetcher: wallet,
        submitter: wallet,
        networkId: 0, // 0 for testnet
      });

      const assets: Asset[] = [{
        unit: 'lovelace',
        quantity: deposit
      }];

      // Create and submit the transaction
      const txHex = await meshContract.recipientDeposit(escrowUtxo, assets);
      const txHash = await wallet.submitTx(txHex);

      console.log('[RecipientDeposit] Deposit successful. Hash:', txHash);
      setLegend('Deposit successful! Transaction submitted.');

      // Store the recipient deposit details
      const depositDetails = {
        originalEscrowTxHash: escrowDetails!.txHash,
        depositTxHash: txHash,
        recipientAddress: connectedAddress,
        depositAmount: deposit,
        timestamp: Date.now()
      };

      localStorage.setItem('lastDeposit', JSON.stringify(depositDetails));

      // Optionally redirect to a confirmation page
      router.push('/escrowStatus');

    } catch (error) {
      console.error('[RecipientDeposit] Error:', error);
      setLegend(`Error making deposit: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Recipient Deposit</h1>

      {escrowDetails ? (
        <div style={{ marginBottom: '20px' }}>
          <h2>Original Escrow Details</h2>
          <p>Initiator: {escrowDetails.walletAddress}</p>
          <p>Transaction: {escrowDetails.txHash}</p>
          <p>Created: {new Date(escrowDetails.timestamp).toLocaleString()}</p>
        </div>
      ) : (
        <p>No escrow details found. Please initiate an escrow first.</p>
      )}

      <div style={{ marginTop: '20px' }}>
        <label>Your Deposit Amount (lovelace): </label>
        <input
          type="number"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          disabled={loading}
          style={{ width: '200px', marginLeft: '10px' }}
        />
      </div>

      <button
        onClick={handleDeposit}
        disabled={loading || !escrowUtxo || !connected}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Processing...' : 'Make Deposit'}
      </button>

      {legend && (
        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px'
        }}>
          {legend}
        </div>
      )}
    </div>
  );
}