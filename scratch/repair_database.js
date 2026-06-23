const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const DB_FILE = path.join(__dirname, '..', 'data', 'MAP_CUSTOMIZATION.json');
const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

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

async function decrypt(encryptedBase64, masterKey) {
  if (!encryptedBase64) return { overrides: {}, customNodes: [], customEdges: [], deletedEdges: [] };
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

async function encrypt(data, masterKey) {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    plaintext
  );
  
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  
  return Buffer.from(payload.buffer).toString('base64');
}

async function main() {
  try {
    const masterKey = await getMasterKey();
    
    if (!fs.existsSync(DB_FILE)) {
      console.error("Database file not found!");
      return;
    }
    
    const fileData = fs.readFileSync(DB_FILE, 'utf-8');
    const dbData = JSON.parse(fileData);
    
    let singletonObj = dbData.find(item => item.id === 'singleton');
    if (!singletonObj || !singletonObj._enc) {
      console.error("No E2EE data found in DB!");
      return;
    }
    
    const decrypted = await decrypt(singletonObj._enc, masterKey);
    console.log('[E2EE] Decrypted DB successfully.');
    
    if (!decrypted.overrides) decrypted.overrides = {};
    if (!decrypted.customNodes) decrypted.customNodes = [];
    if (!decrypted.customEdges) decrypted.customEdges = [];
    if (!decrypted.deletedEdges) decrypted.deletedEdges = [];

    console.log(`Before repair: customNodes=${decrypted.customNodes.length}, customEdges=${decrypted.customEdges.length}`);

    // 1. Merge "echocardiography" and "heart_ultrasound"
    // Keep "heart_ultrasound" as the canonical ID for "심장 초음파".
    // Delete "echocardiography" node.
    const initialNodesCount = decrypted.customNodes.length;
    decrypted.customNodes = decrypted.customNodes.filter(node => node.id !== 'echocardiography');
    console.log(`Filtered out duplicate custom node: echocardiography (nodes count: ${initialNodesCount} -> ${decrypted.customNodes.length})`);

    // Ensure "heart_ultrasound" exists and has parentId: 'custom-1775194257380' (헬스체크업)
    let heartNode = decrypted.customNodes.find(n => n.id === 'heart_ultrasound');
    if (!heartNode) {
      heartNode = {
        id: 'heart_ultrasound',
        label: '심장 초음파',
        group: 'MACRO_RESEARCH',
        baseValue: 70,
        layerId: 2,
        centralityScore: 100
      };
      decrypted.customNodes.push(heartNode);
      console.log('Re-added heart_ultrasound node.');
    }
    heartNode.parentId = 'custom-1775194257380';
    console.log('Set heart_ultrasound parentId to custom-1775194257380 (헬스체크업).');

    // Update parent of "echocardiography_cost" (심장 초음파 비용 (30만원)) to "heart_ultrasound"
    const costNode = decrypted.customNodes.find(n => n.id === 'echocardiography_cost');
    if (costNode) {
      costNode.parentId = 'heart_ultrasound';
      console.log('Updated echocardiography_cost parentId to heart_ultrasound.');
    }

    // 2. Fix overrides
    // Move any overrides on "echocardiography" to "heart_ultrasound"
    const echoOverride = decrypted.overrides['echocardiography'];
    if (echoOverride) {
      decrypted.overrides['heart_ultrasound'] = {
        ...(decrypted.overrides['heart_ultrasound'] || {}),
        ...echoOverride
      };
      delete decrypted.overrides['echocardiography'];
      console.log('Merged overrides from echocardiography to heart_ultrasound.');
    }
    
    // Set explicit parents in overrides
    if (decrypted.overrides['heart_ultrasound']) {
      decrypted.overrides['heart_ultrasound'].customParent = 'custom-1775194257380';
    } else {
      decrypted.overrides['heart_ultrasound'] = { customParent: 'custom-1775194257380' };
    }
    
    if (decrypted.overrides['echocardiography_cost']) {
      decrypted.overrides['echocardiography_cost'].customParent = 'heart_ultrasound';
    } else {
      decrypted.overrides['echocardiography_cost'] = { customParent: 'heart_ultrasound' };
    }

    // 3. Fix customEdges
    // Replace "echocardiography" with "heart_ultrasound" in custom edges
    decrypted.customEdges = decrypted.customEdges.map(edge => {
      const newEdge = { ...edge };
      if (newEdge.source === 'echocardiography') newEdge.source = 'heart_ultrasound';
      if (newEdge.target === 'echocardiography') newEdge.target = 'heart_ultrasound';
      return newEdge;
    }).filter(edge => edge.source !== edge.target); // Remove self-loops
    
    // Check if an edge between "custom-1775194257380" and "heart_ultrasound" already exists
    const hasEdgeToCheckup = decrypted.customEdges.some(e => 
      (e.source === 'custom-1775194257380' && e.target === 'heart_ultrasound') ||
      (e.source === 'heart_ultrasound' && e.target === 'custom-1775194257380')
    );
    if (!hasEdgeToCheckup) {
      decrypted.customEdges.push({
        source: 'custom-1775194257380',
        target: 'heart_ultrasound',
        weight: 1.0,
        type: 'COMPONENTS'
      });
      console.log('Added custom edge from 헬스체크업 to heart_ultrasound.');
    }

    // Check if an edge between "heart_ultrasound" and "echocardiography_cost" exists
    const hasEdgeToCost = decrypted.customEdges.some(e =>
      (e.source === 'heart_ultrasound' && e.target === 'echocardiography_cost') ||
      (e.source === 'echocardiography_cost' && e.target === 'heart_ultrasound')
    );
    if (!hasEdgeToCost) {
      decrypted.customEdges.push({
        source: 'heart_ultrasound',
        target: 'echocardiography_cost',
        weight: 1.0,
        type: 'DEPENDENCY'
      });
      console.log('Added custom edge from heart_ultrasound to echocardiography_cost.');
    }

    // 4. Fix deletedEdges
    decrypted.deletedEdges = decrypted.deletedEdges.map(edgeStr => {
      const parts = edgeStr.split('|||');
      if (parts.length === 2) {
        let s = parts[0];
        let t = parts[1];
        if (s === 'echocardiography') s = 'heart_ultrasound';
        if (t === 'echocardiography') t = 'heart_ultrasound';
        return `${s}|||${t}`;
      }
      return edgeStr;
    });

    console.log(`After repair: customNodes=${decrypted.customNodes.length}, customEdges=${decrypted.customEdges.length}`);

    // Re-encrypt and save
    console.log('[E2EE] Encrypting and saving repaired payload...');
    const encryptedBase64 = await encrypt(decrypted, masterKey);
    singletonObj._enc = encryptedBase64;
    
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
    console.log('[Success] Database repair complete!');

    // Backup
    const backupDir = path.join(__dirname, '..', 'data', 'backups', 'MAP_CUSTOMIZATION');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(backupDir, `REPAIRED_${timestamp}_MAP_CUSTOMIZATION.json`), JSON.stringify(dbData, null, 2), 'utf-8');
    console.log(`[Success] E2EE Backup saved: REPAIRED_${timestamp}_MAP_CUSTOMIZATION.json`);

  } catch (err) {
    console.error('Error during repair:', err);
  }
}

main();
