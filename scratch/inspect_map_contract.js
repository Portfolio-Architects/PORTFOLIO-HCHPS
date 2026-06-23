const fs = require('fs');
const { webcrypto } = require('crypto');

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function decrypt(encryptedBase64, masterKey) {
  if (encryptedBase64.startsWith('[') || encryptedBase64.startsWith('{') || encryptedBase64.startsWith('"')) {
    try {
      return JSON.parse(encryptedBase64);
    } catch {
      // fallback
    }
  }

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
  if (!singleton) {
    console.error("No singleton found!");
    return;
  }

  let payload;
  if (!singleton._enc) {
    payload = singleton;
  } else {
    payload = await decrypt(singleton._enc, masterKey);
  }

  if (!payload) {
    console.error("Decryption failed!");
    return;
  }

  const nodes = payload.customNodes || [];
  const edges = payload.customEdges || [];

  // Find node by label "계약 의뢰" or similar
  const targetNode = nodes.find(n => n.label && n.label.includes("계약 의뢰"));
  if (targetNode) {
    console.log("=== Target Node Details ===");
    console.log(JSON.stringify(targetNode, null, 2));

    // Find connected edges
    console.log("\n=== Connected Edges ===");
    const connectedEdges = edges.filter(e => e.source === targetNode.id || e.target === targetNode.id);
    connectedEdges.forEach(e => {
      const srcNode = nodes.find(n => n.id === e.source);
      const tgtNode = nodes.find(n => n.id === e.target);
      const srcLabel = srcNode ? srcNode.label : e.source;
      const tgtLabel = tgtNode ? tgtNode.label : e.target;
      console.log(`- Edge: [${srcLabel}] -> [${tgtLabel}] (type: ${e.type})`);
    });
  } else {
    console.log("Node '계약 의뢰' not found. Available nodes:");
    nodes.slice(0, 50).forEach(n => console.log(`- ${n.label} (id: ${n.id})`));
  }
}

main().catch(console.error);
