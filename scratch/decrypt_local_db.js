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
    console.error('Decryption failed:', err);
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

  // Decrypt BUDGET_CATEGORIES.json
  const rawCats = JSON.parse(fs.readFileSync('data/BUDGET_CATEGORIES.json', 'utf8'));
  const decCats = [];
  for (const row of rawCats) {
    if (row._enc) {
      const dec = await decrypt(row._enc, masterKey);
      if (dec) {
        decCats.push({ id: row.id, ...dec });
      } else {
        decCats.push(row);
      }
    } else {
      decCats.push(row);
    }
  }

  // Decrypt BUDGET_ENTRIES.json
  const rawEntries = JSON.parse(fs.readFileSync('data/BUDGET_ENTRIES.json', 'utf8'));
  const decEntries = [];
  for (const row of rawEntries) {
    if (row._enc) {
      const dec = await decrypt(row._enc, masterKey);
      if (dec) {
        decEntries.push({ id: row.id, ...dec });
      } else {
        decEntries.push(row);
      }
    } else {
      decEntries.push(row);
    }
  }

  // Filter Target Category and Entries
  const targetCatId = 'mnrcir0v5zjn4qxyg'; // 강남체력인증 - 기간제보수
  const cat = decCats.find(c => c.id === targetCatId);
  const catEntries = decEntries.filter(e => e.categoryId === targetCatId);

  console.log("=== Category Info ===");
  console.log("Name:", cat.name);
  console.log("TotalBudget:", cat.totalBudget);
  console.log("SubItems:");
  cat.subItems.forEach((sub, idx) => {
    console.log(`- SubItem [${sub.name}]: amount=${sub.amount}, virtualAdjustment=${sub.virtualAdjustment}`);
  });

  console.log("\n=== Entries Info ===");
  catEntries.forEach(e => {
    console.log(`- Entry: date=${e.date}, amount=${e.amount}, isPlanned=${e.isPlanned}, purpose=${e.purpose}`);
  });
}

main().catch(console.error);
