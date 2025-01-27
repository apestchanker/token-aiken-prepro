// filepath: /home/alex/meshjs-learn/context/EscrowContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface EscrowDetails {
  txHash: string;
  txIndex: number;
  walletAddress: string;
  initiatorDatum: any; // You can make this more specific based on your datum type
  scriptAddress: string;
  scriptHash: string;
  scriptCbor: string;
  timestamp: number;
}

interface EscrowContextProps {
  escrowDetails: EscrowDetails | null;
  setEscrowDetails: (details: EscrowDetails) => void;
}

const EscrowContext = createContext<EscrowContextProps | undefined>(undefined);

export const EscrowProvider = ({ children }: { children: ReactNode }) => {
  const [escrowDetails, setEscrowDetails] = useState<EscrowDetails | null>(null);

  return (
    <EscrowContext.Provider value={{ escrowDetails, setEscrowDetails }}>
      {children}
    </EscrowContext.Provider>
  );
};

export const useEscrow = () => {
  const context = useContext(EscrowContext);
  if (context === undefined) {
    throw new Error('useEscrow must be used within an EscrowProvider');
  }
  return context;
};