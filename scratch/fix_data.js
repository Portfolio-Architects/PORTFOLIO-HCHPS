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

  console.log('Original root-HCHPS overrides:', decrypted.overrides['root-HCHPS']);

  // Modify root-HCHPS: delete hidden and customParent
  if (decrypted.overrides && decrypted.overrides['root-HCHPS']) {
    delete decrypted.overrides['root-HCHPS'].hidden;
    delete decrypted.overrides['root-HCHPS'].customParent;
    console.log('Modified root-HCHPS overrides:', decrypted.overrides['root-HCHPS']);
  } else {
    console.log('No root-HCHPS overrides found!');
  }

  // Encrypt back
  const plaintext = encoder.encode(JSON.stringify(decrypted));
  const newIv = webcrypto.getRandomValues(new Uint8Array(12));
  
  const newCiphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv: newIv },
    masterKey,
    plaintext
  );
  
  const payload = new Uint8Array(newIv.length + newCiphertext.byteLength);
  payload.set(newIv, 0);
  payload.set(new Uint8Array(newCiphertext), newIv.length);
  
  const newBase64 = Buffer.from(payload.buffer).toString('base64');

  // Put it back
  data[0]._enc = newBase64;

  fs.writeFileSync('data/MAP_CUSTOMIZATION.json', JSON.stringify(data, null, 2), 'utf8');
  console.log('Successfully updated data/MAP_CUSTOMIZATION.json');
}

run().catch(console.error);
