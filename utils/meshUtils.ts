// utils/meshUtils.ts
import { 
  KoiosProvider, 
  MeshTxBuilder,
  fromBech32,
  serializePlutusScript,
  LanguageVersion,
  UTxO, 
  IFetcher,
  IWallet,
} from '@meshsdk/core';
import { applyParamsToScript } from '@meshsdk/core-csl';

export const initKoios = () => {
  // If Koios requires auth, set it via env, otherwise pass no token
  return new KoiosProvider(
    'preprod',                         // or 'preview' if your wallet is on preview testnet
    process.env.NEXT_PUBLIC_koiosauth, // Or undefined if no key needed
    {
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_KOIOS_KEY}`,
      },
    }
  );
};

// We'll define an interface for the escrow script we have
export interface EscrowScript {
  validators: {
    compiledCode: string; // This is your cborHex
    hash: string; // This is the hash of the compiled code
    address: string;
  }[];
}

export const getProtocolParameters = async (koios: KoiosProvider) => {
  const protocolParameters = await koios.fetchProtocolParameters();
  return protocolParameters;
};

// Read the plutus.json from public directory at runtime
// or you can import it directly if it's small
export const getEscrowScriptData = async (): Promise<{ cbor: string; hash: string; address: string }> => {
  const res = await fetch('/plutus.json');
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data: EscrowScript = await res.json();
  const cbor = applyParamsToScript(data.validators[0].compiledCode, []);
  const hash = data.validators[0].hash;
  const address = serializePlutusScript({
    code: cbor,
    version: 'V3',
  }).address;

  if (!cbor || !hash || !address) {
    throw new Error('Invalid script data');
  }

  return { cbor, hash, address };
};

// A function to get the user's stake credential from CIP-30 wallet
export const getStakeCredentialFromWallet = async (wallet: IWallet): Promise<string | null> => {
  const rewardAddresses = await wallet.getRewardAddresses();
  if (rewardAddresses.length === 0) return null;

  const stakeBech32 = rewardAddresses[0];
  const stakeAddrObj = fromBech32(stakeBech32);
  if (!stakeAddrObj.stakeCredential?.hash) return null;
  return stakeAddrObj.stakeCredential.hash;
};

export { MeshTxBuilder };
// Utility to sign & submit a transaction
export const signAndSubmit = async (wallet: IWallet, txHex: string): Promise<string> => {
  console.log('[signAndSubmit] About to sign transaction');
  const signedTx = await wallet.signTx(txHex);
  console.log('[signAndSubmit] Transaction signed, now submitting...');
  const txHash = await wallet.submitTx(signedTx);
  console.log('[signAndSubmit] TxHash:', txHash);
  return txHash;
};
