const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const cryptoSubtle = webcrypto.subtle;
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

function base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function decryptPayload(encryptedBase64, pin) {
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoSubtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const masterKey = await cryptoSubtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const payloadBuffer = base64ToArrayBuffer(encryptedBase64);
  const payload = new Uint8Array(payloadBuffer);
  
  if (payload.length < 12) throw new Error('Invalid encrypted payload');

  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  
  const decryptedBuffer = await cryptoSubtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonStr);
}

async function main() {
  const mapPath = path.join(__dirname, '../data/MAP_CUSTOMIZATION.json');
  const content = fs.readFileSync(mapPath, 'utf-8');
  const data = JSON.parse(content);
  
  const singleton = data.find(item => item.id === 'singleton');
  if (!singleton || !singleton._enc) {
    console.log('No encrypted content found or not formatted as singleton');
    return;
  }
  
  try {
    const decrypted = await decryptPayload(singleton._enc, '0509');
    console.log('Decryption Success!');
    
    const kioskNodes = [];
    
    if (decrypted.customNodes) {
      decrypted.customNodes.forEach(node => {
        if (node.label && (node.label.includes('KIOSK형 컨트롤러') || node.label.includes('키오스크형 컨트롤러') || node.id.includes('kiosk_controller') || node.id.includes('kiosk-controller'))) {
          kioskNodes.push({ type: 'customNodes', node });
        }
      });
    }
    
    if (decrypted.overrides) {
      Object.entries(decrypted.overrides).forEach(([id, override]) => {
        if (id.includes('kiosk_controller') || id.includes('kiosk-controller') || id.includes('KIOSK') || id.includes('키오스크') || (override.customLabel && (override.customLabel.includes('KIOSK형 컨트롤러') || override.customLabel.includes('키오스크형 컨트롤러')))) {
          kioskNodes.push({ type: 'overrides', id, override });
        }
      });
    }
    
    console.log('Target KIOSK Nodes found:', JSON.stringify(kioskNodes, null, 2));
    
    const zeroOrbitNodes = [];
    if (decrypted.overrides) {
      Object.entries(decrypted.overrides).forEach(([id, override]) => {
        if (override.customOrbitIndex === 0 || override.customOrbitIndex === '0') {
          zeroOrbitNodes.push({ id, override });
        }
      });
    }
    console.log('Zero Orbit Nodes (customOrbitIndex === 0):', JSON.stringify(zeroOrbitNodes, null, 2));

  } catch (err) {
    console.error('Decryption failed:', err);
  }
}

main();
