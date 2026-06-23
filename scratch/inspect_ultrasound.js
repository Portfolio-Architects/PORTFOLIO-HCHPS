const fs = require('fs');
const { webcrypto } = require('crypto');

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function decrypt(encryptedBase64, masterKey) {
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
    console.log("No encrypted payload found");
    return;
  }

  const payload = await decrypt(singleton._enc, masterKey);
  
  console.log("=== Matching Nodes ===");
  const nodes = payload.customNodes || [];
  nodes.forEach(node => {
    if (node.label && node.label.includes("초음파")) {
      console.log(`- Node: id=${node.id}, label="${node.label}", parentId=${node.parentId}, group=${node.group}`);
    }
  });

  console.log("\n=== Matching Overrides ===");
  const overrides = payload.overrides || {};
  for (const [id, ov] of Object.entries(overrides)) {
    const customLabel = ov.customLabel || '';
    if (id.includes("초음파") || customLabel.includes("초음파") || (ov.customParent && ov.customParent.includes("초음파"))) {
      console.log(`- Override Key: ${id}`);
      console.log(JSON.stringify(ov, null, 2));
    }
  }

  console.log("\n=== Matching Edges ===");
  const edges = payload.customEdges || [];
  edges.forEach(edge => {
    if (edge.source.includes("초음파") || edge.target.includes("초음파")) {
      console.log(`- Edge: source=${edge.source}, target=${edge.target}, type=${edge.type}`);
    }
  });
}

main().catch(console.error);
