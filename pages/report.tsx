// pages/report.tsx
import React, { useEffect, useState } from 'react';
import { initKoios, getEscrowScriptData } from '../utils/meshUtils';

export default function ReportPage() {
  const [scriptAddress, setScriptAddress] = useState<string>('');
  const [utxos, setUtxos] = useState<any[]>([]);

  const fetchState = async () => {
    try {
      const koios = initKoios();
      const { cbor, hash, address } = await getEscrowScriptData();
      setScriptAddress(address);

      console.log('[ReportPage] Querying Koios for script UTxOs...');
      const data = await koios.fetchAddressUTxOs(address);
      console.log('[ReportPage] Koios UTxOs:', data);
      setUtxos(data);
    } catch (err) {
      console.error('[ReportPage] Error:', err);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  return (
    <div style={{ margin: '20px' }}>
      <h1>Contract State Report</h1>
      <p>Script Address: {scriptAddress}</p>
      <button onClick={fetchState}>Refresh</button>

      <pre>{JSON.stringify(utxos, null, 2)}</pre>
    </div>
  );
}
