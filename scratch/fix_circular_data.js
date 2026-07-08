const fs = require('fs');
const path = require('path');

const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function main() {
  const pin = '0509';
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const masterKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  function base64ToArrayBuffer(base64) {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function decryptPayload(encryptedBase64) {
    if (encryptedBase64.startsWith('[') || encryptedBase64.startsWith('{') || encryptedBase64.startsWith('"')) {
      return JSON.parse(encryptedBase64);
    }
    const payloadBuffer = base64ToArrayBuffer(encryptedBase64);
    const payload = new Uint8Array(payloadBuffer);
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  }

  const dataDir = path.join(process.cwd(), 'data');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf8').trim();
    if (!fileContent) continue;

    let rows;
    try {
      rows = JSON.parse(fileContent);
    } catch {
      continue;
    }

    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      if (row._enc) {
        try {
          const dec = await decryptPayload(row._enc);
          const decStr = JSON.stringify(dec);
          if (decStr.includes('heart_ultrasound') || decStr.includes('jaemugwa') || decStr.includes('gamsa_damdang_gwan')) {
            console.log(`[FOUND MATCH] File: ${file}, ID: ${row.id}`);
            
            // 매칭된 노드가 customNodes나 overrides, 혹은 customEdges에 있는지 확인
            if (dec.customNodes) {
              const matchedNodes = dec.customNodes.filter(cn => cn.id.includes('heart') || cn.id.includes('jaemu') || cn.id.includes('gamsa') || cn.parentId?.includes('heart') || cn.parentId?.includes('jaemu') || cn.parentId?.includes('gamsa'));
              if (matchedNodes.length > 0) {
                console.log('CustomNodes Matches:', JSON.stringify(matchedNodes, null, 2));
              }
            }
            if (dec.overrides) {
              const matchedOverrides = {};
              Object.keys(dec.overrides).forEach(k => {
                if (k.includes('heart') || k.includes('jaemu') || k.includes('gamsa') || dec.overrides[k].customParent?.includes('heart') || dec.overrides[k].customParent?.includes('jaemu') || dec.overrides[k].customParent?.includes('gamsa')) {
                  matchedOverrides[k] = dec.overrides[k];
                }
              });
              if (Object.keys(matchedOverrides).length > 0) {
                console.log('Overrides Matches:', JSON.stringify(matchedOverrides, null, 2));
              }
            }
            if (dec.customEdges) {
              const matchedEdges = dec.customEdges.filter(e => e.source.includes('heart') || e.target.includes('heart') || e.source.includes('jaemu') || e.target.includes('jaemu') || e.source.includes('gamsa') || e.target.includes('gamsa'));
              if (matchedEdges.length > 0) {
                console.log('CustomEdges Matches:', JSON.stringify(matchedEdges, null, 2));
              }
            }
            console.log(`===================================`);
          }
        } catch {}
      }
    }
  }
}
main().catch(console.error);
