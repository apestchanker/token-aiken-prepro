// convertToCBOR.mjs
import Cardano from '@emurgo/cardano-serialization-lib-nodejs';
import fs from 'fs';

// Path to your compiled Plutus script (plutus.json)
const plutusJsonPath = '../public/plutus.json';

// Read and parse the plutus.json file
const plutusJson = JSON.parse(fs.readFileSync(plutusJsonPath, 'utf8'));

// Extract the compiled code (adjust the path based on your plutus.json structure)
const doubleEncodedHex = plutusJson.validators[0].compiledCode; // Example path

if (!doubleEncodedHex) {
  console.error('Error: compiledCode not found in plutus.json');
  process.exit(1);
}

// Convert hex string to bytes
const scriptBytes = Buffer.from(doubleEncodedHex, 'hex');

// Create a PlutusScript object
const plutusScript = Cardano.PlutusScript.from_bytes(scriptBytes);

// Re-encode to single-layer CBOR bytes
const singleLayerBytes = plutusScript.to_bytes();

// Convert bytes to hex string
const singleLayerHex = Buffer.from(singleLayerBytes).toString('hex');

// Output the single-layer CBOR hex
console.log('Single-layer Script CBOR Hex:', singleLayerHex);
