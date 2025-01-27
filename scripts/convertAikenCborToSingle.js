// decode_aiken.js
const { PlutusScript } = require('@emurgo/cardano-serialization-lib-nodejs');
const fs = require('fs');

// 1. Read your Aiken compiled script from a file (e.g. plutus.json)
const json = JSON.parse(fs.readFileSync('../public/plutus.json', 'utf8'));
const doubleEncodedHex = json.validators[0].compiledCode; // e.g. "590d23..."

if (!doubleEncodedHex) {
  throw new Error('No compiledCode found in plutus.json');
}

// 2. Decode once
const scriptBytes = Buffer.from(doubleEncodedHex, 'hex');
const script = PlutusScript.from_bytes(scriptBytes);

// 3. Re-encode to get single-layer CBOR
const singleLayerBytes = script.to_bytes();
const singleLayerHex = Buffer.from(singleLayerBytes).toString('hex');

// 4. Print or write to a file/env
console.log('Single-layer script CBOR hex:', singleLayerHex);
