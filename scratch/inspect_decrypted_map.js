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
  console.log(`Loaded ${rawMap.length} items from data/MAP_CUSTOMIZATION.json`);

  const singleton = rawMap.find(item => item.id === 'singleton');
  if (!singleton) {
    console.error("No singleton found!");
    return;
  }

  if (!singleton._enc) {
    console.log("Singleton is not encrypted (plain text mode)");
    console.log("CustomNodes count:", singleton.customNodes ? singleton.customNodes.length : 0);
    console.log("CustomEdges count:", singleton.customEdges ? singleton.customEdges.length : 0);
  } else {
    console.log("Singleton is E2EE encrypted. Decrypting...");
    const payload = await decrypt(singleton._enc, masterKey);
    if (payload) {
      console.log("=== Decrypted MAP_CUSTOMIZATION ===");
      console.log("CustomNodes count:", payload.customNodes ? payload.customNodes.length : 0);
      console.log("CustomEdges count:", payload.customEdges ? payload.customEdges.length : 0);
      
      console.log("\nLast 15 Custom Nodes added:");
      const nodes = payload.customNodes || [];
      nodes.slice(-15).forEach(node => {
        console.log(`- Node: id=${node.id}, label=${node.label}, layerId=${node.layerId}, group=${node.group}`);
      });
      
      console.log("\nLast 15 Custom Edges added:");
      const edges = payload.customEdges || [];
      edges.slice(-15).forEach(edge => {
        console.log(`- Edge: source=${edge.source}, target=${edge.target}, type=${edge.type}`);
      });
    } else {
      console.error("Decryption failed!");
    }
  }
}

main().catch(console.error);
