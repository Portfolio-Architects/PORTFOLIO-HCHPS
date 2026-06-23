const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const DB_FILE = path.join(__dirname, '..', 'data', 'CONTACTS.json');
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
  if (!encryptedBase64) return null;
  if (encryptedBase64.startsWith('[') || encryptedBase64.startsWith('{') || encryptedBase64.startsWith('"')) {
    return JSON.parse(encryptedBase64);
  }
  
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
  const masterKey = await getMasterKey();
  if (!fs.existsSync(DB_FILE)) {
    console.log("CONTACTS.json does not exist.");
    return;
  }
  const content = fs.readFileSync(DB_FILE, 'utf-8');
  const contacts = JSON.parse(content);
  
  console.log(`Loaded ${contacts.length} items from CONTACTS.json`);
  const decryptedContacts = [];
  for (const item of contacts) {
    if (item._enc) {
      const dec = await decrypt(item._enc, masterKey);
      decryptedContacts.push({ id: item.id, ...dec });
    } else {
      decryptedContacts.push(item);
    }
  }
  
  console.log("=== Decrypted Contacts ===");
  console.log(JSON.stringify(decryptedContacts, null, 2));
}

main();
