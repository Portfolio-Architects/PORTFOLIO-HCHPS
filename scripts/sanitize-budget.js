const fs = require('fs').promises;
const path = require('path');
const { webcrypto } = require('crypto');

const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');
const PIN = '0509';

// Web Crypto API Helper for Node
async function getMasterKey(pin) {
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

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function decryptPayload(encryptedBase64, masterKey) {
  if (encryptedBase64.startsWith('[') || encryptedBase64.startsWith('{') || encryptedBase64.startsWith('"')) {
    return JSON.parse(encryptedBase64);
  }
  const payloadBuffer = base64ToArrayBuffer(encryptedBase64);
  const payload = new Uint8Array(payloadBuffer);
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  
  const decryptedBuffer = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedBuffer));
}

async function encryptPayload(data, masterKey) {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    plaintext
  );
  
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  
  return arrayBufferToBase64(payload.buffer);
}

async function main() {
  const dbPath = path.join(__dirname, '..', 'data', 'BUDGET_CATEGORIES.json');
  console.log('📖 로딩 시작:', dbPath);
  
  const fileContent = await fs.readFile(dbPath, 'utf-8');
  const categories = JSON.parse(fileContent);
  const masterKey = await getMasterKey(PIN);
  
  let cleanedCount = 0;
  
  const updatedCategories = await Promise.all(categories.map(async (row) => {
    if (!row._enc) return row;
    
    try {
      const dec = await decryptPayload(row._enc, masterKey);
      
      if (row.subItems && Array.isArray(row.subItems) && dec.subItems && Array.isArray(dec.subItems)) {
        let isMutated = false;
        
        const cleanedSubItems = dec.subItems.map((decSub) => {
          const originalSub = row.subItems.find((s) => s.id === decSub.id || s.name === decSub.name);
          if (originalSub) {
            const restoredSub = { ...decSub };
            
            // decSub 수준의 virtualAdjustment 및 note 속성 정화
            if (decSub.virtualAdjustment !== undefined || decSub.note !== undefined) {
              console.log(`⚠️  [세부항목 속성 오염 제거] 과목: ${row.name} | 세부항목: ${decSub.name}`);
              console.log(`  - virtualAdjustment (${decSub.virtualAdjustment}) 및 note (${decSub.note}) 제거`);
              delete restoredSub.virtualAdjustment;
              delete restoredSub.note;
              isMutated = true;
            }
            
            // calculations 정밀화 복원
            if (originalSub.calculations && Array.isArray(originalSub.calculations)) {
              const decCalcs = Array.isArray(decSub.calculations) ? decSub.calculations : [];
              
              // 찌꺼기가 섞여있거나 금액이 다를 수 있으므로 평문 템플릿 기준으로 재조립
              const originalCalculations = originalSub.calculations;
              const restoredCalculations = originalCalculations.map((origCalc) => {
                const decCalc = decCalcs.find((c) => c.id === origCalc.id) || {};
                
                // 불일치 감지 로그 (금액 불일치 및 가상조정액 잔존 감지)
                if (
                  decCalc.amount !== origCalc.amount || 
                  decCalc.name !== origCalc.name || 
                  decCalc.calculation !== origCalc.calculation ||
                  decCalc.virtualAdjustment !== undefined ||
                  decCalc.note !== undefined
                ) {
                  console.log(`⚠️  [불일치 감지 및 복구] 과목: ${row.name} | 세부항목: ${decSub.name} | 계산식: ${origCalc.name}`);
                  console.log(`  - 복호화 오염상태: [${decCalc.name || '없음'}] (${decCalc.calculation || '없음'}) => ${decCalc.amount || 0}원 (virtualAdjustment: ${decCalc.virtualAdjustment})`);
                  console.log(`  - 평문 원안상태: [${origCalc.name}] (${origCalc.calculation}) => ${origCalc.amount}원`);
                  isMutated = true;
                }
                
                return {
                  ...origCalc,
                  isLocked: typeof decCalc.isLocked === 'boolean' ? decCalc.isLocked : (origCalc.isLocked || false)
                };
              });
              
              // 찌꺼기 calculations 항목(TRX 등)이 포함되어 있다면 그것도 불일치로 감지 및 삭제
              if (decCalcs.length !== originalCalculations.length || decCalcs.some(c => !originalCalculations.some(orig => orig.id === c.id))) {
                console.log(`⚠️  [찌꺼기 감지 및 삭제] 과목: ${row.name} | 세부항목: ${decSub.name}`);
                console.log(`  - 복호화 항목 개수: ${decCalcs.length}개 / 평문 원안 개수: ${originalCalculations.length}개`);
                isMutated = true;
              }
              
              restoredSub.calculations = restoredCalculations;
            } else {
              // 오리지널에 calculations가 아예 없는 경우
              if (decSub.calculations && decSub.calculations.length > 0) {
                console.log(`⚠️  [찌꺼기 일괄 삭제] 과목: ${row.name} | 세부항목: ${decSub.name}`);
                console.log(`  - calculations 삭제 처리 (원래 계산식이 없던 항목)`);
                isMutated = true;
              }
              restoredSub.calculations = [];
            }
            return restoredSub;
          }
          return decSub;
        });
        
        if (isMutated) {
          dec.subItems = cleanedSubItems;
          const newEnc = await encryptPayload(dec, masterKey);
          cleanedCount++;
          return {
            ...row,
            _enc: newEnc
          };
        }
      }
      
      return row;
    } catch (e) {
      console.error(`🚨 복호화/처리 실패 (ID: ${row.id}):`, e);
      return row;
    }
  }));
  
  if (cleanedCount > 0) {
    console.log(`💾 정화된 ${cleanedCount}개 카테고리 디스크 저장 중...`);
    await fs.writeFile(dbPath, JSON.stringify(updatedCategories, null, 2), 'utf-8');
    console.log('✅ 전수 조사 및 데이터 정화 완료!');
  } else {
    console.log('✅ 이미 모든 데이터가 평문 원안과 완전히 일치하며 오염이 없습니다.');
  }
}

main().catch(console.error);
