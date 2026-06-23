const fs = require('fs');
const { execSync } = require('child_process');
const { webcrypto } = require('crypto');

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function decrypt(encryptedBase64, masterKey) {
  if (!encryptedBase64) return null;
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

async function getMasterKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function getDecryptedMap(content, masterKey) {
  const rawMap = JSON.parse(content);
  const singleton = rawMap.find(item => item.id === 'singleton');
  if (!singleton) return null;
  if (!singleton._enc) return singleton;
  return await decrypt(singleton._enc, masterKey);
}

async function main() {
  const masterKey = await getMasterKey();

  // Load current map
  const currentContent = fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8');
  const currentMap = await getDecryptedMap(currentContent, masterKey);

  // Load git HEAD map
  let gitMap = null;
  try {
    const gitContent = execSync('git show HEAD:data/MAP_CUSTOMIZATION.json', { encoding: 'utf8' });
    gitMap = await getDecryptedMap(gitContent, masterKey);
  } catch (err) {
    console.warn("Could not load map from git HEAD:", err.message);
  }

  const currentNodes = currentMap.customNodes || [];
  const currentEdges = currentMap.customEdges || [];
  const gitNodes = gitMap ? (gitMap.customNodes || []) : [];
  const gitEdges = gitMap ? (gitMap.customEdges || []) : [];

  const currentNode = currentNodes.find(n => n.id === 'contract_request');
  const gitNode = gitNodes.find(n => n.id === 'contract_request');

  console.log("=== Node 'contract_request' existence ===");
  console.log("Current:", currentNode ? "YES" : "NO");
  console.log("Git HEAD:", gitNode ? "YES" : "NO");

  if (currentNode) {
    const currentConn = currentEdges.filter(e => e.source === 'contract_request' || e.target === 'contract_request');
    console.log(`\n=== Current Connections (${currentConn.length}) ===`);
    currentConn.forEach(e => {
      const src = currentNodes.find(n => n.id === e.source)?.label || e.source;
      const tgt = currentNodes.find(n => n.id === e.target)?.label || e.target;
      console.log(`- ${src} -> ${tgt} (type: ${e.type}, weight: ${e.weight})`);
    });
  }

  if (gitNode) {
    const gitConn = gitEdges.filter(e => e.source === 'contract_request' || e.target === 'contract_request');
    console.log(`\n=== Git HEAD Connections (${gitConn.length}) ===`);
    gitConn.forEach(e => {
      const src = gitNodes.find(n => n.id === e.source)?.label || e.source;
      const tgt = gitNodes.find(n => n.id === e.target)?.label || e.target;
      console.log(`- ${src} -> ${tgt} (type: ${e.type}, weight: ${e.weight})`);
    });
  }
}

main().catch(console.error);
