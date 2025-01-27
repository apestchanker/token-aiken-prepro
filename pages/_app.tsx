import React from 'react';
import type { AppProps } from 'next/app';
import { WalletProvider } from '../utils/WalletContext';
import { MeshProvider } from "@meshsdk/react";
import { EscrowProvider } from '../utils/EscrowContext';

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <MeshProvider>
            <WalletProvider>
                <EscrowProvider>
                    <Component {...pageProps} />
                </EscrowProvider>
            </WalletProvider>
        </MeshProvider>
    );
}

export default MyApp;
