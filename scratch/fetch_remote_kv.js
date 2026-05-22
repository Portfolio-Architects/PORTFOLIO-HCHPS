const crypto = require('crypto').webcrypto;

const pin = '0509';
const encoder = new TextEncoder();

async function getAuthToken() {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const tokenBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode('HCHPS-AUTH-SALT'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(tokenBits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const SHEETS = [
  'TASKS', 'MEETINGS', 'PROJECTS',
  'BUDGET_CATEGORIES', 'BUDGET_ENTRIES',
  'INVENTORY', 'STOCK_CHANGES',
  'SIGNAL_LOG', 'KNOWLEDGE',
  'MAP_CUSTOMIZATION', 'BOSS_SCHEDULE'
];

async function testFetch() {
  try {
    const token = await getAuthToken();
    console.log('Token derived:', token);
    
    // First, test invalid token to verify security
    const testBadRes = await fetch('https://portfolio-hchps.pages.dev/api/data?sheet=TASKS', {
      headers: { 'Authorization': 'Bearer BADTOKEN' }
    });
    console.log('Bad Token response status:', testBadRes.status);
    
    for (const sheet of SHEETS) {
      const url = `https://portfolio-hchps.pages.dev/api/data?sheet=${sheet}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        console.log(`Sheet [${sheet}]: success=${json.success}, rows count=${json.data ? json.data.length : 'N/A'}`);
        if (sheet === 'BUDGET_ENTRIES') {
          console.log(JSON.stringify(json.data, null, 2));
        } else if (json.data && json.data.length > 0) {
          console.log(`  Sample row:`, JSON.stringify(json.data[0]).slice(0, 200));
        }
      } else {
        console.log(`Sheet [${sheet}]: Failed status ${res.status}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testFetch();
