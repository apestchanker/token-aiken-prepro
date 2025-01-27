import { useState, useEffect } from "react";
import type { NextPage } from "next";
import { useWallet } from "@meshsdk/react";
import { CardanoWallet } from "@meshsdk/react";
import { MeshEscrowContract } from "@meshsdk/contract";
import { KoiosProvider, MeshTxBuilder } from "@meshsdk/core";

const Home: NextPage = () => {
    const {connected, wallet} = useWallet();
    const [assets, setAssets] = useState<null | any>(null);
    const [utxos, setVar] = useState<null | any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [providers, setProviders] = useState<any>(null);

    useEffect(() => {
        if (connected && wallet) {
            const blockchainProvider = new KoiosProvider(
                'preprod',
                process.env.NEXT_PUBLIC_koiosauth,
            );
            
            const meshTxBuilder = new MeshTxBuilder({
                fetcher: blockchainProvider,
                submitter: blockchainProvider,
            });
            console.log("meshTxBuilder", meshTxBuilder);
            
            const contract = new MeshEscrowContract({
                mesh: meshTxBuilder,
                fetcher: blockchainProvider,
                wallet: wallet,
                networkId: 0,
            });
            console.log("contract", contract);

            setProviders({ blockchainProvider, meshTxBuilder, contract });
        }
    }, [connected, wallet]);

    async function getAssets() {
        if (!wallet) {
            console.error('Wallet not connected');
            return;
        }
        try {
            setLoading(true);
            const _assets = await wallet.getAssets();
            setAssets(_assets);
        } catch (error) {
            console.error('Error getting assets:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleGetWalletFunction() {
        if (!wallet || !providers) {
            console.error('Wallet not connected or providers not initialized');
            return;
        }
        try {
            setLoading(true);
            const _stake = await wallet.getRewardAddresses();
            console.log(_stake);
            const _utxos = await providers.blockchainProvider.fetchAccountInfo(_stake.join());
            const _objects = await providers.blockchainProvider.fetchAssetAddresses('5413911679525158254c00a953ea98b871b763e697ffcd3cc9b1ede9747374414c4c49');
            const _output = JSON.stringify(_objects,null,2) + "\n" + JSON.stringify(_utxos,null,2);
            setVar(_output);
        } catch (error) {
            console.error('Error getting wallet info:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <h1>Connect Wallet</h1>
            <CardanoWallet />
            {connected && (
                <>
                    <h1>Get Wallet Asset</h1>
                    {assets ? (
                        <pre>
                            <code className="language-js">
                                {JSON.stringify(assets,null,2)}
                            </code>
                        </pre>
                    ):(
                        <>
                            <button
                                type="button"
                                onClick={() => getAssets()}
                                disabled={loading}
                                style={{
                                    margin: "8px",
                                    backgroundColor: loading ? "orange" : "gray",
                                }}
                            >
                                Get Wallet Assets
                            </button>
                        </>
                    )}
                </>
            )}
            <>
                <h1>Get Wallet Objects</h1>
                {utxos ? (
                    <pre>
                        <code className="language-js">
                            {utxos}
                        </code>
                    </pre>
                ):(
                    <>
                        <button
                            disabled={loading || !providers}
                            style={{
                                margin: "8px",
                                backgroundColor: loading ? "orange" : "gray",
                            }}
                            onClick={handleGetWalletFunction}
                        >
                            Get Wallet Objects
                        </button>
                    </>
                )}
            </>
        </div>
    );
};

export default Home;