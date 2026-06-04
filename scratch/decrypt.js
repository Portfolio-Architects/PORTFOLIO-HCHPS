const fs = require('fs');
const { webcrypto } = require('crypto');

const file = fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8');
const data = JSON.parse(file);

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function decrypt(encryptedBase64) {
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

  const payloadBuffer = Buffer.from(encryptedBase64, 'base64');
  const iv = payloadBuffer.subarray(0, 12);
  const ciphertext = payloadBuffer.subarray(12);
  
  const decryptedBuffer = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedBuffer));
}

decrypt(data[0]._enc).then(decrypted => {
  console.log('=== OVERRIDES WITH customParent ===');
  let noneCount = 0;
  for (const [key, value] of Object.entries(decrypted.overrides || {})) {
    if (value.customParent === 'NONE') {
      noneCount++;
      console.log(`Node ID: ${key}, Label: ${value.customLabel || ''}, customParent: NONE`, value);
    }
  }
  console.log(`Total overrides with customParent === 'NONE': ${noneCount}`);
  
  console.log('=== DELETED EDGES ===');
  console.log(decrypted.deletedEdges);

  console.log('=== DATA COUNTS ===');
  console.log('customNodes count:', decrypted.customNodes ? decrypted.customNodes.length : 0);
  console.log('customEdges count:', decrypted.customEdges ? decrypted.customEdges.length : 0);
}).catch(err => {
  console.error('Decryption failed:', err);
});
