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

  if (!currentMap) {
    console.error("Could not parse current map!");
    return;
  }

  const currentNodes = currentMap.customNodes || [];
  const currentEdges = currentMap.customEdges || [];
  const gitNodes = gitMap ? (gitMap.customNodes || []) : [];
  const gitEdges = gitMap ? (gitMap.customEdges || []) : [];

  console.log(`Current: ${currentNodes.length} nodes, ${currentEdges.length} edges`);
  console.log(`Git HEAD: ${gitNodes.length} nodes, ${gitEdges.length} edges`);

  // Nodes added
  const addedNodes = currentNodes.filter(cn => !gitNodes.some(gn => gn.id === cn.id));
  console.log(`\n=== Added Nodes (${addedNodes.length}) ===`);
  addedNodes.forEach(n => console.log(`- [${n.label}] (id: ${n.id}, parentId: ${n.parentId})`));

  // Edges added
  const addedEdges = currentEdges.filter(ce => !gitEdges.some(ge => ge.source === ce.source && ge.target === ce.target));
  console.log(`\n=== Added Edges (${addedEdges.length}) ===`);
  addedEdges.forEach(e => {
    const srcNode = currentNodes.find(n => n.id === e.source);
    const tgtNode = currentNodes.find(n => n.id === e.target);
    const srcLabel = srcNode ? srcNode.label : e.source;
    const tgtLabel = tgtNode ? tgtNode.label : e.target;
    console.log(`- [${srcLabel}] -> [${tgtLabel}] (type: ${e.type})`);
  });

  // Nodes deleted
  const deletedNodes = gitNodes.filter(gn => !currentNodes.some(cn => cn.id === gn.id));
  console.log(`\n=== Deleted Nodes (${deletedNodes.length}) ===`);
  deletedNodes.forEach(n => console.log(`- [${n.label}] (id: ${n.id})`));

  // Edges deleted
  const deletedEdges = gitEdges.filter(ge => !currentEdges.some(ce => ce.source === ge.source && ce.target === ge.target));
  console.log(`\n=== Deleted Edges (${deletedEdges.length}) ===`);
  deletedEdges.forEach(e => {
    const srcNode = gitNodes.find(n => n.id === e.source);
    const tgtNode = gitNodes.find(n => n.id === e.target);
    const srcLabel = srcNode ? srcNode.label : e.source;
    const tgtLabel = tgtNode ? tgtNode.label : e.target;
    console.log(`- [${srcLabel}] -> [${tgtLabel}] (type: ${e.type})`);
  });
}

main().catch(console.error);
