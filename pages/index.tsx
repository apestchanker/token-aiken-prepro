import React, { useContext } from 'react';
import { WalletContext } from '../utils/WalletContext';
import { CardanoWallet } from "@meshsdk/react";
import ReportPage from './report';
import Link from 'next/link';

export default function Home() {
  const { connected, walletName, connectedAddress } = useContext(WalletContext);
  console.log("wallet:",connected, walletName, connectedAddress);
  return (
    <div style={{ margin: '20px' }}>
      <h1>Escrow Contract Demo</h1>
      <CardanoWallet />
      {connected && ( 
        <>
          <div style={{ marginTop: '10px' }}>
            <p>Connected wallet: {walletName}</p>
            <p>Address: {connectedAddress}</p>
          </div>
          <ReportPage/>
          <hr />
          <h3>Next Steps</h3>
          <ul>
            <li><Link href="/deployEscrow">Deploy Escrow</Link></li>
            <li><Link href="/investorDeposit">Investor Deposit</Link></li>
            <li><Link href="/activate">Activate Escrow</Link></li>
            <li><Link href="/cancel">Cancel Escrow</Link></li>
            <li><Link href="/complete">Complete Escrow</Link></li>
            <li><Link href="/utxos">View UTXOs</Link></li>
          </ul>
        </>
      )}
    </div>
  );
}
