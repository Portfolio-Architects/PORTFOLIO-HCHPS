const fs = require('fs');
const { webcrypto } = require('crypto');

const file = fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8');
const data = JSON.parse(file);

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function run() {
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const masterKey = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Decrypt
  const encryptedBase64 = data[0]._enc;
  const payloadBuffer = Buffer.from(encryptedBase64, 'base64');
  const iv = payloadBuffer.subarray(0, 12);
  const ciphertext = payloadBuffer.subarray(12);
  
  const decryptedBuffer = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  const decrypted = JSON.parse(decoder.decode(decryptedBuffer));

  console.log('root-HCHPS overrides:', JSON.stringify(decrypted.overrides['root-HCHPS'], null, 2));
}

run().catch(console.error);
