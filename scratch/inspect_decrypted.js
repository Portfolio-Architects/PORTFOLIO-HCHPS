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
    console.error('Decryption failed for row:', err);
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

  const rawText = fs.readFileSync('data/BUDGET_CATEGORIES.json', 'utf8');
  const rows = JSON.parse(rawText);
  console.log(`Loaded ${rows.length} rows from data/BUDGET_CATEGORIES.json`);

  const decryptedRows = [];
  for (const row of rows) {
    if (row._enc) {
      const dec = await decrypt(row._enc, masterKey);
      if (dec) {
        decryptedRows.push({ id: row.id, ...dec });
      } else {
        decryptedRows.push(row);
      }
    } else {
      decryptedRows.push(row);
    }
  }

  fs.writeFileSync('scratch/categories_decrypted_local.json', JSON.stringify(decryptedRows, null, 2), 'utf8');
  console.log(`Saved decrypted categories to scratch/categories_decrypted_local.json`);

  // Print items that have non-empty virtualAdjustment or note contains Split Formula
  for (const cat of decryptedRows) {
    let hasAdjustment = false;
    if (cat.subItems) {
      cat.subItems.forEach(si => {
        if (si.virtualAdjustment || si.note) {
          hasAdjustment = true;
        }
        if (si.calculations) {
          si.calculations.forEach(c => {
            if (c.virtualAdjustment || c.note) {
              hasAdjustment = true;
            }
          });
        }
      });
    }
    if (hasAdjustment) {
      console.log(`Category: ${cat.name}`);
      cat.subItems.forEach(si => {
        if (si.virtualAdjustment || si.note) {
          console.log(`  SubItem [${si.name}]: val=${si.virtualAdjustment}, note=${si.note}`);
        }
        if (si.calculations) {
          si.calculations.forEach(c => {
            if (c.virtualAdjustment || c.note) {
              console.log(`    Calc [${c.name || c.calculation}]: val=${c.virtualAdjustment}, note=${c.note}`);
            }
          });
        }
      });
    }
  }
}

main().catch(console.error);
