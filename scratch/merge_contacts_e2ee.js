const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

const DB_FILE = path.join(__dirname, '..', 'data', 'CONTACTS.json');
const EXTRACTED_FILE = path.join(__dirname, 'extracted_contacts.json');
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

async function encrypt(data, masterKey) {
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
  
  return Buffer.from(payload.buffer).toString('base64');
}

// 전화번호 정규화 (숫자만 남김)
function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[^0-9]/g, "");
}

// 이름 정규화 (공백 제거)
function normalizeName(name) {
  if (!name) return "";
  return name.replace(/\s+/g, "");
}

async function main() {
  try {
    const masterKey = await getMasterKey();
    
    // 1. 기존 연락처 로드 및 복호화
    let existingContacts = [];
    if (fs.existsSync(DB_FILE)) {
      const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
      const rawList = JSON.parse(fileContent);
      for (const item of rawList) {
        if (item._enc) {
          const dec = await decrypt(item._enc, masterKey);
          if (dec) {
            existingContacts.push({ id: item.id, ...dec });
          } else {
            existingContacts.push(item);
          }
        } else {
          existingContacts.push(item);
        }
      }
    }
    console.log(`[E2EE] Loaded ${existingContacts.length} existing contacts.`);
    
    // 2. 추출된 신규 연락처 로드
    if (!fs.existsSync(EXTRACTED_FILE)) {
      console.error(`Extracted contacts file not found: ${EXTRACTED_FILE}`);
      return;
    }
    const newContacts = JSON.parse(fs.readFileSync(EXTRACTED_FILE, 'utf-8'));
    console.log(`Loaded ${newContacts.length} new contacts from Excel.`);
    
    // 3. 병합 처리 (중복 제거 & 융합)
    const mergedList = [...existingContacts];
    let addedCount = 0;
    let mergedCount = 0;
    
    for (const newC of newContacts) {
      const normNewPhone = normalizePhone(newC.phone);
      const normNewName = normalizeName(newC.name);
      
      // 중복 대조: 전화번호가 같거나 이름이 유사한 항목 찾기
      let matchIdx = -1;
      for (let i = 0; i < mergedList.length; i++) {
        const existC = mergedList[i];
        const normExistPhone = normalizePhone(existC.phone);
        const normExistName = normalizeName(existC.name);
        
        // 둘 중 하나라도 정보가 있고 매칭되는 경우
        const phoneMatch = normNewPhone && normExistPhone && (normNewPhone === normExistPhone);
        const nameMatch = normNewName && normExistName && (
          normNewName === normExistName || 
          normNewName.includes(normExistName) || 
          normExistName.includes(normNewName)
        );
        
        if (phoneMatch || (nameMatch && (phoneMatch || !normNewPhone || !normExistPhone))) {
          matchIdx = i;
          break;
        }
      }
      
      if (matchIdx !== -1) {
        // 기존 항목과 병합/융합
        const target = mergedList[matchIdx];
        console.log(`[Merge] Merging duplicate: "${target.name}" and "${newC.name}"`);
        
        // 더 상세한 이름 선택
        if (newC.name.length > target.name.length) {
          target.name = newC.name;
        }
        // 이메일 채우기
        if (!target.email && newC.email) {
          target.email = newC.email;
        }
        // 전화번호 채우기
        if (!target.phone && newC.phone) {
          target.phone = newC.phone;
        }
        
        // 메모(notes) 결합
        if (newC.notes) {
          const notesSet = new Set(target.notes ? target.notes.split(' / ') : []);
          notesSet.add(newC.notes);
          target.notes = Array.from(notesSet).join(' / ');
        }
        
        target.updatedAt = new Date().toISOString();
        mergedCount++;
      } else {
        // 신규 항목 추가
        const randomId = Math.random().toString(36).substring(2, 9);
        const newId = `contact-seed-${mergedList.length}-${randomId}`;
        const timestamp = new Date().toISOString();
        
        mergedList.push({
          id: newId,
          name: newC.name,
          phone: newC.phone,
          email: newC.email,
          notes: newC.notes,
          createdAt: timestamp,
          updatedAt: timestamp
        });
        addedCount++;
      }
    }
    
    console.log(`[Merge Results] Added: ${addedCount}, Merged: ${mergedCount}, Total: ${mergedList.length}`);
    
    // 4. E2EE 암호화 후 디스크 저장
    const encryptedList = [];
    for (const item of mergedList) {
      const { id, ...rest } = item;
      // rest 객체에 에러 필드가 섞여있으면 제외
      delete rest._error;
      const encPayload = await encrypt(rest, masterKey);
      encryptedList.push({
        id,
        _enc: encPayload
      });
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify(encryptedList, null, 2), 'utf-8');
    console.log(`[Success] Written database with E2EE. Saved to ${DB_FILE}`);
    
    // 5. 백업 생성
    const backupDir = path.join(__dirname, '..', 'data', 'backups', 'CONTACTS');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(backupDir, `${timestamp}_CONTACTS.json`), JSON.stringify(encryptedList, null, 2), 'utf-8');
    console.log(`[Success] E2EE Backup saved: ${timestamp}_CONTACTS.json`);
    
  } catch (err) {
    console.error('[Error in main]', err);
  }
}

main();
