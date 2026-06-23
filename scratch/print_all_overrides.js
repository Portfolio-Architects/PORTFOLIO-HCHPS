const fs = require('fs');
const { webcrypto } = require('crypto');

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function decrypt(encryptedBase64, masterKey) {
  if (!encryptedBase64) return null;
  try {
    const payloadBuffer = Buffer.from(encryptedBase64, 'base64');
    const iv = payloadBuffer.subarray(0, 12);
    const ciphertext = payloadBuffer.subarray(12);
    const decryptedBuffer = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, ciphertext);
    return JSON.parse(new TextDecoder().decode(decryptedBuffer));
  } catch (err) {
    return null;
  }
}

async function getMasterKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey('raw', encoder.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']);
  return await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function main() {
  const masterKey = await getMasterKey();
  const rawMap = JSON.parse(fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8'));
  const singleton = rawMap.find(item => item.id === 'singleton');
  if (!singleton) return;
  const payload = singleton._enc ? await decrypt(singleton._enc, masterKey) : singleton;
  if (!payload) return;
  console.log("=== All Overrides keys and values ===");
  console.log(JSON.stringify(payload.overrides || {}, null, 2));
}

main().catch(console.error);
