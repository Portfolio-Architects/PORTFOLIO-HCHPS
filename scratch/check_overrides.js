const fs = require('fs');
const { webcrypto } = require('crypto');

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function decrypt(encryptedBase64, masterKey) {
  try {
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
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}

async function main() {
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

  const rawMap = JSON.parse(fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8'));
  const singleton = rawMap.find(item => item.id === 'singleton');
  if (!singleton || !singleton._enc) {
    console.error("No encrypted singleton found!");
    return;
  }

  const payload = await decrypt(singleton._enc, masterKey);
  if (!payload) {
    console.error("Decryption failed!");
    return;
  }

  console.log("=== Overrides Keys and detail for customOrbitIndex ===");
  const overrides = payload.overrides || {};
  let count = 0;
  for (const [nodeId, override] of Object.entries(overrides)) {
    if (override && override.customOrbitIndex !== undefined) {
      console.log(`- Node ID: ${nodeId}, customOrbitIndex: ${override.customOrbitIndex}`);
      if (override.customOrbitIndex === 0) {
        console.log(`  >>> WARNING: Node ${nodeId} has customOrbitIndex: 0 (override: ${JSON.stringify(override)})`);
      }
      count++;
    }
  }
  console.log(`Total overrides with customOrbitIndex: ${count}`);

  console.log("\n=== Checking specific node 'contract_request' ===");
  if (overrides['contract_request']) {
    console.log(JSON.stringify(overrides['contract_request'], null, 2));
  } else {
    console.log("No override for 'contract_request'");
  }
}

main().catch(console.error);
