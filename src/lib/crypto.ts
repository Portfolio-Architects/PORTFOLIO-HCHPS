let masterKey: CryptoKey | null = null;
let sessionAuthToken: string | null = null;

const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

export const initCryptoContext = async (pin: string) => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  masterKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // extractable = false prevents JS from reading raw key bits
    ['encrypt', 'decrypt']
  );
  
  // Create an auth token for API headers (different from encryption key)
  const tokenBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode('HCHPS-AUTH-SALT'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  sessionAuthToken = Array.from(new Uint8Array(tokenBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Set to local storage explicitly to cross-share token to WebSockets if needed, but not the key itself
  // However, sharing token in memory only is safer.
  if (typeof window !== 'undefined') {
    (window as any).__HCHPS_AUTH_TOKEN = sessionAuthToken;
    window.dispatchEvent(new Event('crypto-ready'));
  }
};

export const isCryptoReady = () => masterKey !== null;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const encryptPayload = async (data: unknown): Promise<string> => {
  if (!masterKey) throw new Error('CryptoContext not initialized. Application is locked.');
  
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    plaintext
  );
  
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  
  return arrayBufferToBase64(payload.buffer);
};

export const decryptPayload = async <T = unknown>(encryptedBase64: string): Promise<T> => {
  if (!masterKey) throw new Error('CryptoContext not initialized. Application is locked.');
  
  // If data is obviously plaintext JSON array/object, fallback (Migration path allowing old data to be read)
  if (encryptedBase64.startsWith('[') || encryptedBase64.startsWith('{') || encryptedBase64.startsWith('"')) {
    try {
      return JSON.parse(encryptedBase64) as T;
    } catch {
      // ignore JSON parse error, move forward to decrypt
    }
  }
  
  try {
    const payloadBuffer = base64ToArrayBuffer(encryptedBase64);
    const payload = new Uint8Array(payloadBuffer);
    
    // Validate we have at least 12 bytes IV
    if (payload.length < 12) throw new Error('Invalid encrypted payload');

    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    if (encryptedBase64 === '') return [] as unknown as T;
    throw err;
  }
};

export const getAuthToken = () => {
    if (!sessionAuthToken) throw new Error("Auth token is not available.");
    return sessionAuthToken;
};

export const clearCryptoContext = () => {
  masterKey = null;
  sessionAuthToken = null;
  if (typeof window !== 'undefined') {
    delete (window as any).__HCHPS_AUTH_TOKEN;
  }
};
