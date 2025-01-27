// computeHash.js

const fs = require('fs');
const plutusJsonPath = '../public/plutus.json';

// computeHash.js
const blake = require('blakejs');


// Read the CBOR hex string
const scriptCborHex = fs.readFileSync(plutusJsonPath, 'utf8').trim();

// Convert hex string to byte array
const scriptBytes = Buffer.from(scriptCborHex, 'hex');

// Compute BLAKE2b-256 hash
const hash = blake.blake2b(scriptBytes, null, 32); // 32 bytes = 256 bits

// Convert hash to hex string
const hashHex = Buffer.from(hash).toString('hex');

console.log('Computed Script BLAKE2b-256 Hash:', hashHex);
