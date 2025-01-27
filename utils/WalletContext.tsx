import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useWallet as useMeshWallet } from "@meshsdk/react";

interface WalletContextProps {
  connected: boolean;
  wallet: any;
  walletName: string;
  connectedAddress: string;
  walletforTx: string;
  getAddress: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextProps>({
  connected: false,
  wallet: null,
  walletName: '',
  connectedAddress: '',
  walletforTx: '',
  getAddress: async () => {},
});

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { connected, wallet, name } = useMeshWallet();
  const [walletName, setWalletName] = useState<string>('');
  const [connectedAddress, setConnectedAddress] = useState<string>('');
  const [walletforTx, setWalletforTx] = useState<string>('');
  const getAddress = async () => {
    try {
      console.log("Attempting to retrieve wallet addresses...");
      const usedAddresses = await wallet.getChangeAddress();
      const walletforTx = (await wallet.getUnusedAddresses())?.[0];
      console.log('Used Addresses:', usedAddresses);
      
      if (usedAddresses) {
        setWalletName(name ?? 'No wallet name found');
        setConnectedAddress(usedAddresses);
        setWalletforTx(walletforTx);  
      } else {
        setConnectedAddress('No used address found');
      }
    } catch (err) {
      console.error('[getAddress] Error:', err);
    }
  };

  useEffect(() => {
    console.log("Wallet State Changed:", { connected, wallet, name });
    if (connected) {
      getAddress();
    } else {
      setWalletName('');
      setConnectedAddress('');
    }
  }, [connected, wallet, name]);

  return (
    <WalletContext.Provider
      value={{
        connected,
        wallet,
        walletName,
        connectedAddress,
        walletforTx,
        getAddress,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
