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

async function getDecryptedRows(filePath, masterKey) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = JSON.parse(content);
  const decRows = [];
  for (const r of rows) {
    if (r._enc) {
      const dec = await decrypt(r._enc, masterKey);
      if (dec) decRows.push({ id: r.id, ...dec });
      else decRows.push(r);
    } else {
      decRows.push(r);
    }
  }
  return decRows;
}

async function main() {
  const masterKey = await getMasterKey();

  const signalEntries = await getDecryptedRows('data/SIGNAL_LOG.json', masterKey);
  const tasks = await getDecryptedRows('data/TASKS.json', masterKey);
  const projects = await getDecryptedRows('data/PROJECTS.json', masterKey);
  const meetings = await getDecryptedRows('data/MEETINGS.json', masterKey);
  const budgetEntries = await getDecryptedRows('data/BUDGET_ENTRIES.json', masterKey);
  const inventoryItems = await getDecryptedRows('data/INVENTORY.json', masterKey);

  console.log("=== SIGNAL_LOG count:", signalEntries.length);
  if (signalEntries.length > 0) {
    console.log("Latest signal:", signalEntries[signalEntries.length - 1]);
  }
  console.log("=== TASKS count:", tasks.length);
  if (tasks.length > 0) {
    console.log("Latest task:", tasks[tasks.length - 1]);
  }
  console.log("=== PROJECTS count:", projects.length);
  if (projects.length > 0) {
    console.log("Latest project:", projects[projects.length - 1]);
  }
  console.log("=== MEETINGS count:", meetings.length);
  if (meetings.length > 0) {
    console.log("Latest meeting:", meetings[meetings.length - 1]);
  }
  console.log("=== BUDGET_ENTRIES count:", budgetEntries.length);
  if (budgetEntries.length > 0) {
    console.log("Latest budget entry:", budgetEntries[budgetEntries.length - 1]);
  }
}

main().catch(console.error);
