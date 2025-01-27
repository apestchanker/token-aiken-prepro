// pages/initiateEscrow.tsx
import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../utils/WalletContext';
import {
  MeshTxBuilder,
  initKoios,
  getEscrowScriptData,
  signAndSubmit,
  getProtocolParameters,
} from '../utils/meshUtils';
import { useRouter } from 'next/router';
import { useEscrow } from '@/utils/EscrowContext';

//Escrow contract Address addr_test1wq32vhm8agv7af2dffekuehddjtlppeuu2ysl7v5e0653kglnqchw
//Escrow contract Hash 22a65f67ea19eea54d4a736e66ed6c97f0873ce2890ff994cbf548d9
export default function DeployEscrow() {
  const { connected, wallet, connectedAddress, walletforTx } = useContext(WalletContext);
  const [refUtxo, setRefUtxo] = useState<string>('');
  const [scriptAddress, setScriptAddress] = useState<string>('');
  const [scriptExists, setScriptExists] = useState<boolean>(false);
  const [legend, setLegend] = useState<string>('');
  const [scriptHash, setScriptHash] = useState<string>('');
  const [scriptCbor, setScriptCbor] = useState<string>('');
  const [deploymentInProgress, setDeploymentInProgress] = useState<boolean>(false);
  const [deploymentResult, setDeploymentResult] = useState<{
    txHash: string;
    index: number;
  } | null>(null);
  const [verificationInProgress, setVerificationInProgress] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    referenceUtxo: string;
    message: string;
  } | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState<boolean>(false);
  
  const router = useRouter();
  const estimatedFees = 300000;
  const { escrowDetails, setEscrowDetails } = useEscrow();

  useEffect(() => {
    if (connected && wallet) {
      fetchScriptData();
    }
  }, [connected, wallet]);
    
  useEffect(() => {
    if (scriptAddress && scriptHash) {
      checkForExistingScript();
      setEscrowDetails({
        txHash: deploymentResult?.txHash || '',
        txIndex: deploymentResult?.index || 0,
        walletAddress: connectedAddress,
        initiatorDatum: {},
        scriptAddress: scriptAddress,
        scriptHash: scriptHash,
        scriptCbor: scriptCbor,
        timestamp: Date.now(),
      });
    };
  }, [scriptAddress, scriptHash, deploymentResult]);

  useEffect(() => {
    if (deploymentResult) {
      verifyScriptReference(deploymentResult.txHash, deploymentResult.index);
    }
  }, [deploymentResult]);

  const fetchScriptData = async () => {
    try {
      const { cbor, hash, address } = await getEscrowScriptData();

      setScriptCbor(cbor);
      setScriptHash(hash);
      setScriptAddress(address);

      console.log('[deployEscrow] script Address', scriptAddress);
      console.log('[deployEscrow] script Cbor', scriptCbor);
      console.log('[deployEscrow] Script Hash', scriptHash);
    } catch (error) {
      console.error("[initiateEscrow] Error fetching script data:", error);
      setLegend('Error fetching script data. Please try again.');
    }
  };

  const checkForExistingScript = async () => {
    try {
      console.log("[checkForExistingScript] Looking for script:", scriptHash);
      console.log("[checkForExistingScript] Looking for script cbor:", scriptCbor);
      const utxos = await wallet.getUtxos();
      //const txHash= "8fceb0617799542bf2a68d95d40516d21ac4e793fc907699e53e1845b258d213";
      // for (const utxo of utxos)
      // {
      //   if(utxo.input.txHash=="8fceb0617799542bf2a68d95d40516d21ac4e793fc907699e53e1845b258d213" && utxo.input.outputIndex==0) {
      //   console.log("Hash from utxos..utxo ref", utxo, utxo.output.scriptRef)
      //   }
      // };
      const cborplus = "8201"+scriptCbor;
      console.log("Hash from utxos..utxo cbor", cborplus);

      const scriptUtxo = utxos.find((utxo: any) => 
        utxo.output.scriptRef === cborplus
        //utxo.input.txHash=== txHash && 
        //utxo.input.outputIndex === 0
      );

      if (scriptUtxo) {
        const scriptUtxoString = `${scriptUtxo.input.txHash}#${scriptUtxo.input.outputIndex}`;
        setRefUtxo(scriptUtxoString);
        setDeploymentResult({
          txHash: scriptUtxo.input.txHash,
          index: scriptUtxo.input.outputIndex
        });
        setScriptExists(true);
        setLegend('Found existing script reference. Ready to initiate escrow.');
        console.log(`[checkForExistingScript] Found script at: ${scriptUtxoString}`);
      } else {
        setLegend('No script reference found in wallet. Please deploy the script first.');
        console.log("[checkForExistingScript] No script found.");
      }
    } catch (err: any) {
      console.error("[checkForExistingScript] Error:", err);
      setLegend(`Error checking script status: ${err?.message || 'Unknown error'}`);
    } finally {
      setInitialCheckDone(true);
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

  const deployScript = async () => {
    if (!confirm('Are you sure you want to deploy the script? This will require a transaction fee.')) {
      return;
    }

    setDeploymentInProgress(true);
    setDeploymentResult(null);
    try {
      console.log('[deployScript] Starting script deployment...');
      const koios = initKoios();
      const protocolParameters = await getProtocolParameters(koios);
      console.log('[deployScript] Protocol Parameters:', protocolParameters);

      const utxos = await wallet.getUtxos();
      if (!utxos.length) throw new Error('No UTXOs available for fees');

      // Calculate minimum needed: 2 ADA for min UTxO + 0.5 ADA for fees
      const minLovelace = 25000000; // 25 ADA in lovelace

      // Filter and sort available UTXOs
      const availableUtxos = utxos
        .filter((u: any) => {
          const lovelace = u.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity || 0;
          return Number(lovelace) > 0 && 
                 u.output.amount.length === 1 && // Only ADA
                 !u.output.plutusData && // Not a script output
                 !u.output.scriptRef; // Not already a reference script
        })
        .sort((a, b) => {
          const aAmount = Number(a.output.amount.find((amt: any) => amt.unit === 'lovelace')?.quantity || 0);
          const bAmount = Number(b.output.amount.find((amt: any) => amt.unit === 'lovelace')?.quantity || 0);
          return bAmount - aAmount;
        });

      // Select UTXOs until we have enough
      let totalLovelace = 0;
      const selectedUtxos = [];
      
      for (const utxo of availableUtxos) {
        const amount = Number(utxo.output.amount.find((a: any) => a.unit === 'lovelace')?.quantity || 0);
        totalLovelace += amount;
        selectedUtxos.push(utxo);
        
        if (totalLovelace > minLovelace) break;
      }

      if (totalLovelace <= minLovelace) {
        throw new Error(`Not enough ADA to cover minimum UTxO (2 ADA) and fees (0.5 ADA)`);
      }

      const txBuilder = new MeshTxBuilder({ fetcher: koios, submitter: koios, verbose: true });

      const outputaddress = selectedUtxos[0].output.address;
      console.log('outputaddress', outputaddress);
      // Add all selected inputs
      for (const utxo of selectedUtxos) {
        txBuilder.txIn(
          utxo.input.txHash,
          utxo.input.outputIndex,
          utxo.output.amount,
          outputaddress,
          0
        );
      }
      txBuilder.setNetwork('preprod');
      
      console.log('[deployScript] Adding output with minimum ADA', selectedUtxos[0]);
      // Add output with minimum ADA
      txBuilder.txOut(
        selectedUtxos[0].output.address,
        [{ unit: 'lovelace', quantity: '20000000' }]
      );

      // Add script reference
      txBuilder.txOutReferenceScript(
        scriptCbor
      );

      txBuilder.changeAddress(selectedUtxos[0].output.address);
      //txBuilder.setFee(estimatedFees.toString());
      console.log('[deployScript] Building deployment transaction...', {
        selectedUtxos: selectedUtxos.length,
        totalLovelace,
        minLovelace
      });
      console.log('TxBuilder before complete', txBuilder.meshTxBuilderBody);

      await txBuilder.complete();

      const txHash = await signAndSubmit(wallet, txBuilder.txHex);
      console.log('[deployScript] Script deployed. Hash:', txHash);
      console.log('[deployScript] Script deployed. Cbor:', scriptCbor);
      
      const timer = setTimeout(async () => {
        if (txHash)
        {
          setDeploymentResult({
            txHash,
            utxo: `${txHash}#0`,
            index: 0
          });
          clearTimeout(timer);
        }
      }, 5000);
      
      
      setLegend('Script deployment successful! Waiting for confirmation...');

    } catch (err: any) {
      console.error("[deployScript] Error:", err);
      setLegend(`Deployment error: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeploymentInProgress(false);
    }
  };

  return (
    <div style={{ margin: '20px' }}>
      <h1>Deploy Escrow (Token Allies Admin)</h1>
      <p>Wallet Address: {connectedAddress}</p>

      {!initialCheckDone ? (
        <div style={{ 
          padding: '20px',
          backgroundColor: '#e9ecef',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          Checking for existing script reference...
        </div>
      ) : !scriptExists ? (
        <div style={{ 
          padding: '20px',
          backgroundColor: '#fff3cd',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <strong>⚠️ Script Reference Not Found:</strong>
          <p>No script reference was found in your wallet. You need to deploy the script before you can initiate an escrow.</p>
          <p>Click the "Deploy Script Reference" button below to proceed.</p>
        </div>
      ) : (
        <div style={{ 
          padding: '20px',
          backgroundColor: '#d4edda',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <strong>✓ Script Reference Found:</strong>
          <p>Script reference is available at: {refUtxo}</p>
          <p>You can proceed to verify and send your deposit.</p>
        </div>
      )}

      {/* Step 1: Deploy Script */}
      <div style={{ 
        marginBottom: '30px',
        padding: '20px',
        border: '1px solid #dee2e6',
        borderRadius: '5px'
      }}>
        <h2>Step 1: Deploy Script Reference</h2>
        {!scriptExists ? (
          <>
            <button 
              onClick={deployScript} 
              disabled={deploymentInProgress}
              style={{ 
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: deploymentInProgress ? 'not-allowed' : 'pointer'
              }}
            >
              {deploymentInProgress ? 'Deploying Script...' : 'Deploy Script Reference'}
            </button>
            
            {deploymentResult && (
              <div style={{ marginTop: '10px', backgroundColor: '#e9ecef', padding: '10px', borderRadius: '5px' }}>
                <h3>Deployment Details:</h3>
                <p><strong>Transaction Hash:</strong> <br/>{deploymentResult.txHash}</p>
                <p><strong>Script Reference UTXO:</strong> <br/>{deploymentResult.utxo}</p>
                <a href={`https://preprod.cardanoscan.io/transaction/${deploymentResult.txHash}`} 
                   target="_blank" rel="noopener noreferrer">
                  View on Cardanoscan →
                </a>
              </div>
            )}
          </>
        ) : (
          <div style={{ backgroundColor: '#d4edda', padding: '10px', borderRadius: '5px' }}>
            ✓ Script already deployed at: {refUtxo}
          </div>
        )}
      </div>
    </div>

  );
}
