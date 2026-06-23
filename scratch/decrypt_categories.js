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
  const { execSync } = require('child_process');
  
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

  console.log("Fetching sheet:BUDGET_CATEGORIES from Cloudflare KV using wrangler...");
  let rawText = '';
  try {
    const stdoutBuf = execSync('npx wrangler kv key get --binding=HCHPS_DATA "sheet:BUDGET_CATEGORIES"', {
      maxBuffer: 10 * 1024 * 1024
    });
    rawText = stdoutBuf.toString('utf8');
  } catch (err) {
    console.error("Wrangler execution failed:", err.message);
    return;
  }


  const rows = JSON.parse(rawText);
  console.log(`Loaded ${rows.length} rows from raw KV file.`);

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

  fs.writeFileSync('scratch/kv_categories_decrypted.json', JSON.stringify(decryptedRows, null, 2), 'utf8');
  console.log(`Saved decrypted categories to scratch/kv_categories_decrypted.json`);

  // Check if subItems or calculations exist
  let subItemsCount = 0;
  for (const cat of decryptedRows) {
    if (cat.subItems && cat.subItems.length > 0) {
      subItemsCount++;
      console.log(`Category [${cat.name}] has ${cat.subItems.length} subItems:`);
      cat.subItems.forEach(si => {
        console.log(`  - SubItem: ${si.name}, Amount: ${si.amount}, Calc: ${si.calculation || 'N/A'}`);
      });
    }
  }
  console.log(`Total categories with subItems: ${subItemsCount}`);
}

main().catch(console.error);
