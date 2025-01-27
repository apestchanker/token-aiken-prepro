// pages/recipientDeposit.tsx
import React, { useState, useEffect } from 'react';
import {   MeshTxBuilder,
  initKoios,
  signAndSubmit,
  } from '../utils/meshUtils';
import { useContext } from 'react';
import { WalletContext } from '../utils/WalletContext';
import { useRouter } from 'next/router';
import { initiateEscrowDatum } from '../utils/escrowUtils';
import { Asset } from '@meshsdk/core';
import { useEscrow } from '@/utils/EscrowContext';


export default function InvestorDepositPage() {
  const { connected, wallet, connectedAddress, walletforTx } = useContext(WalletContext);
  const [refUtxo, setRefUtxo] = useState<string>('');
  const [userDeposit, setUserDeposit] = useState<string>('5000000');
  const [scriptAddress, setScriptAddress] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [scriptExists, setScriptExists] = useState<boolean>(false);
  const [legend, setLegend] = useState<string>('');
  const [scriptHash, setScriptHash] = useState<string>('');
  const [scriptCbor, setScriptCbor] = useState<string>('');
  const [deploymentResult, setDeploymentResult] = useState<{
    txHash: string;
    utxo: string;
    index: number;
  } | null>(null);
  const [verificationInProgress, setVerificationInProgress] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    referenceUtxo: string;
    message: string;
  } | null>(null);
  
  const router = useRouter();
  const estimatedFees = 300000;
  const { escrowDetails, setEscrowDetails } = useEscrow();
 
  useEffect(() => {
    if (connected && wallet) {
      fetchData();
    }
  }, [connected, wallet, escrowDetails]);

  const fetchData = async () => {
    try {
      
      setScriptCbor(escrowDetails?.scriptCbor || '');
      setScriptHash(escrowDetails?.scriptHash || '');
      setScriptAddress(escrowDetails?.scriptAddress || '');
      setDeploymentResult({
        txHash: escrowDetails?.txHash || '',
        utxo: escrowDetails?.txHash || '',
        index: 0
      });

      console.log('[initiateEscrow] script Address', scriptAddress);
      console.log('[initiateEscrow] script Cbor', scriptCbor);
      console.log('[initiateEscrow] Script Hash', scriptHash);
    } catch (error) {
      console.error("[initiateEscrow] Error fetching script data:", error);
      setLegend('Error fetching script data. Please try again.');
    }
  };

  const verifyScriptReference = async (refTxHash?: string, refTxIndex?: number) => {
    setVerificationInProgress(true);
    setVerificationResult(null);
    
    try {
      console.log('[verifyScript] Starting verification...');
      const utxos = await wallet.getUtxos();
      
      // Use the same txHash as checkForExistingScript if no specific hash is provided
      const txHashToCheck = refTxHash || "4c39e4d22ec8a95c06d235725dfd40ae7024f8ab78952adef0e7844897a70f42";
      const indexToCheck = refTxIndex ?? 0;

      console.log('[verifyScript] Checking for script at:', txHashToCheck, indexToCheck);
      
      const scriptUtxo = utxos.find((utxo: any) => 
        utxo.input.txHash === txHashToCheck && 
        utxo.input.outputIndex === indexToCheck
      );

      if (scriptUtxo) {
        const utxoRef = `${scriptUtxo.input.txHash}#${scriptUtxo.input.outputIndex}`;
        setVerificationResult({
          isValid: true,
          referenceUtxo: utxoRef,
          message: 'Script reference found and valid!'
        });
        setRefUtxo(utxoRef);
        setScriptExists(true);
      } else {
        // Don't clear existing values if we're checking a specific deployment
        if (!refTxHash) {
          setRefUtxo('');
          setScriptExists(false);
        }
        setVerificationResult({
          isValid: false,
          referenceUtxo: '',
          message: 'No valid script reference found. Please deploy the script first.'
        });
      }
    } catch (error) {
      console.error('[verifyScript] Error:', error);
      setVerificationResult({
        isValid: false,
        referenceUtxo: '',
        message: `Error during verification: ${error?.message || 'Unknown error'}`
      });
    } finally {
      setVerificationInProgress(false);
    }
  };

  const initiateEscrow = async () => {
    if (!verificationResult?.isValid) {
      return setLegend('Please verify script reference first');
    }

    setLoading(true);
    try {
      console.log('[initiateEscrow] Starting...');
      const koios = initKoios();

      console.log('[initiateEscrow] Script Address:', scriptAddress);

      const freshUtxos = await wallet.getUtxos();
      console.log('[initiateEscrow] Fresh UTXOs:', freshUtxos);

      if (!freshUtxos.length) throw new Error('No UTxOs in wallet');

      const neededLovelace = Number(userDeposit);
      const minimumLovelace = neededLovelace + estimatedFees;
      
      const availableUtxos = freshUtxos.filter((u: any) => 
        u.output.amount.length === 1 && 
        !u.output.plutusData && 
        !u.output.scriptRef
      );

      availableUtxos.sort((a, b) => {
        const aAmount = Number(a.output.amount.find((amt: any) => amt.unit === 'lovelace')?.quantity || 0);
        const bAmount = Number(b.output.amount.find((amt: any) => amt.unit === 'lovelace')?.quantity || 0);
        return bAmount - aAmount;
      });

      let totalLovelace = 0;
      const selectedUtxos = [];
      
      for (const utxo of availableUtxos) {
        const amount = Number(utxo.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity || 0);
        totalLovelace += amount;
        selectedUtxos.push(utxo);
        
        if (totalLovelace > minimumLovelace) break;
      }

      if (totalLovelace <= minimumLovelace) {
        throw new Error(`Not enough ADA to cover deposit (${neededLovelace}) and fees (est. ${estimatedFees})`);
      }

      const [refHash, refIndexStr] = verificationResult.referenceUtxo.split('#');
      const refIndex = parseInt(refIndexStr, 10);

      const txBuilder = new MeshTxBuilder({ fetcher: koios, submitter: koios, verbose: true });

      for (const utxo of selectedUtxos) {
        txBuilder.txIn(
          utxo.input.txHash,
          utxo.input.outputIndex,
          utxo.output.amount,
          utxo.output.address
        );
      }
      txBuilder.setNetwork('preprod');
      const asset: Asset[] = [{
        unit: 'lovelace',
        quantity: String(userDeposit)
      }];

      txBuilder.txOut(
        scriptAddress,
        asset,
      );

      console.log('[initiateEscrow] Initiator Address y deposit:', walletforTx, userDeposit);

      const initDatum = initiateEscrowDatum(walletforTx, asset);

      console.log('[initiateEscrow] Initiator Datum:', initDatum);

      const error = txBuilder.txOutInlineDatumValue(initDatum,"JSON")
  
      console.log('[initiateEscrow] tx after Datum:', error, txBuilder.meshTxBuilderBody);

      console.log('[initiateEscrow] ScriptInRefs:', refHash, refIndex, scriptHash);

      txBuilder.simpleScriptTxInReference(
        refHash,
        refIndex,
        scriptHash
      );

      txBuilder.changeAddress(selectedUtxos[0].output.address);
      txBuilder.setFee(estimatedFees.toString());
      console.log('[initiateEscrow] Building escrow transaction...');
      await txBuilder.complete();
      
      const txHash = await signAndSubmit(wallet, txBuilder.txHex);
      console.log('[initiateEscrow] Escrow initiated. Hash:', txHash);
      setLegend('Escrow successfully initiated!');
      
      // Store the escrow details
      setEscrowDetails({
        txHash,
        txIndex: refIndex,
        walletAddress: walletforTx,
        initiatorDatum: initDatum,
        scriptAddress,
        scriptHash,
        scriptCbor,
        timestamp: Date.now()
      });

      // Store in localStorage
      const existingEscrows = JSON.parse(localStorage.getItem('escrows') || '[]');
      existingEscrows.push(escrowDetails);
      localStorage.setItem('escrows', JSON.stringify(existingEscrows));
      // Optional: Store the most recent escrow separately
      localStorage.setItem('lastEscrow', JSON.stringify(escrowDetails));

      setLegend('Escrow initiated successfully!');

      setTimeout(() => {
        router.push('/');
      }, 3000);

    } catch (error) {
      console.error("[initiateEscrow] Error:", error);
      setLegend(`Error: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: '20px' }}>
      <h1>Investor Deposit (User)</h1>
      <p>Wallet Address: {walletforTx}</p>

      <div>
        <label>Reference Script UTxO TxHash#Index: </label>
        <input
          type="text"
          value={refUtxo}
          onChange={(e) => setRefUtxo(e.target.value)}
          style={{ width: '400px' }}
        />
      </div>
      {/* Step 2: Verify and Send */}
      <div style={{ 
        marginBottom: '30px',
        padding: '20px',
        border: '1px solid #dee2e6',
        borderRadius: '5px'
      }}>
        <h2>Step 2: Verify & Send Deposit</h2>
        
        <button 
          onClick={() => verifyScriptReference(deploymentResult?.txHash, deploymentResult?.index)}
          disabled={verificationInProgress}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: verificationInProgress ? 'not-allowed' : 'pointer'
          }}
        >
          {verificationInProgress ? 'Verifying...' : 'Verify Script Reference'}
        </button>
        
        {verificationResult && (
          <div style={{ marginTop: '10px', backgroundColor: '#e9ecef', padding: '10px', borderRadius: '5px' }}>
            <label>Deposit (lovelace): </label>
            <input 
              type="number"
              value={userDeposit}
              onChange={(e) => setUserDeposit(e.target.value)}
              style={{ width: '200px' }}
            />
            <h3>Verification Details:</h3>
            <p><strong>Result:</strong> <br/>{verificationResult.isValid ? '✓ Valid' : '✗ Invalid'}</p>
            <p><strong>Message:</strong> <br/>{verificationResult.message}</p>
            {verificationResult.isValid ? (
              <button 
                onClick={initiateEscrow}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Initiate Escrow
              </button>
            ) : (
              <button 
                onClick={() => verifyScriptReference(deploymentResult?.txHash, deploymentResult?.index)}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Retry Verification
              </button>
            )}
          </div>
        )}
      </div>

      <p>Script Address: {scriptAddress}</p>
    </div>
      
  );
}
