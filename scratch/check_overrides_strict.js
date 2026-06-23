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

  console.log("=== Checking customNodes for '계약 의뢰' ===");
  const customNodes = payload.customNodes || [];
  customNodes.forEach(cn => {
    if (cn.label && cn.label.includes("계약 의뢰")) {
      console.log("Found customNode:", JSON.stringify(cn, null, 2));
      const override = payload.overrides[cn.id];
      console.log("Its override:", JSON.stringify(override, null, 2));
    }
    if (cn.customOrbitIndex === 0 || cn.orbitIndex === 0) {
      console.log(`WARNING: customNode ${cn.id} (${cn.label}) has customOrbitIndex/orbitIndex === 0 in node object!`);
    }
  });

  console.log("=== Checking all overrides for customOrbitIndex === 0 (Strict) ===");
  const overrides = payload.overrides || {};
  for (const [id, ov] of Object.entries(overrides)) {
    if (ov && (ov.customOrbitIndex === 0 || ov.customOrbitIndex === '0')) {
      console.log(`WARNING: Override for ${id} has customOrbitIndex: ${ov.customOrbitIndex}`);
      // Find what node this is
      const cn = customNodes.find(n => n.id === id);
      if (cn) {
        console.log(`  This node is a customNode: ${cn.label}`);
      } else {
        console.log(`  This node is a system node ID (could be 'root-HCHPS' or something else)`);
      }
    }
  }
}

main().catch(console.error);
