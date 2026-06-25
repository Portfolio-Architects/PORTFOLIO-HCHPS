const fs = require('fs').promises;
const path = require('path');
const { webcrypto } = require('crypto');

const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');
const PIN = '0509';

async function getMasterKey(pin) {
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey('raw', encoder.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']);
  return await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const bytes = new Uint8Array(binary_string.length);
  for (let i = 0; i < binary_string.length; i++) bytes[i] = binary_string.charCodeAt(i);
  return bytes.buffer;
}

async function decryptPayload(encryptedBase64, masterKey) {
  const payload = new Uint8Array(base64ToArrayBuffer(encryptedBase64));
  const decryptedBuffer = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.slice(0, 12) }, masterKey, payload.slice(12));
  return JSON.parse(new TextDecoder().decode(decryptedBuffer));
}

async function main() {
  const dbPath = path.join(__dirname, '..', 'data', 'BUDGET_CATEGORIES.json');
  const categories = JSON.parse(await fs.readFile(dbPath, 'utf-8'));
  const masterKey = await getMasterKey(PIN);

  for (const row of categories) {
    if (row.name.includes('건강증진지원실 운영 - 사무관리비')) {
      console.log('=== 평문 데이터 ===');
      console.log(JSON.stringify(row.subItems, null, 2));
      
      console.log('=== 복호화 데이터 ===');
      const dec = await decryptPayload(row._enc, masterKey);
      console.log(JSON.stringify(dec.subItems, null, 2));
    }
  }
}

main().catch(console.error);
