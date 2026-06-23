const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

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
    return null;
  }
}

async function main() {
  const masterKey = await getMasterKey();
  const dataDir = 'data';
  const outputDir = path.join('scratch', 'decrypted_db');
  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    let json;
    try {
      json = JSON.parse(content);
    } catch (e) {
      console.log(`Failed to parse ${file} as JSON`);
      continue;
    }

    if (!Array.isArray(json)) {
      console.log(`File ${file} is not an array, skipping`);
      continue;
    }

    const decryptedRows = [];
    let encryptedCount = 0;

    for (const row of json) {
      if (row._enc) {
        encryptedCount++;
        const dec = await decrypt(row._enc, masterKey);
        if (dec) {
          decryptedRows.push({ id: row.id, ...dec });
        } else {
          decryptedRows.push({ id: row.id, _error: 'Decryption failed', _enc: row._enc });
        }
      } else {
        decryptedRows.push(row);
      }
    }

    if (encryptedCount > 0) {
      console.log(`Decrypted ${encryptedCount} rows in ${file}`);
    }
    fs.writeFileSync(path.join(outputDir, file), JSON.stringify(decryptedRows, null, 2), 'utf8');
  }
}

main();
