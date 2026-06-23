const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const subtle = webcrypto.subtle;

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function getMasterKey() {
    const encoder = new TextEncoder();
    const keyMaterial = await subtle.importKey(
        'raw',
        encoder.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    return await subtle.deriveKey(
        { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
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
    const payloadBuffer = base64ToArrayBuffer(encryptedBase64);
    const payload = new Uint8Array(payloadBuffer);
    
    if (payload.length < 12) throw new Error('Invalid encrypted payload');

    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    
    const decryptedBuffer = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        masterKey,
        ciphertext
    );
    
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonStr);
}

// Helper to extract text from a block structure (BlockNote format)
function extractTextFromBlocks(data) {
    let texts = [];
    if (!data) return "";
    
    // Check if the data itself is an array of blocks or an object with blocks
    const blocks = Array.isArray(data) ? data : (data.blocks || []);
    
    for (const block of blocks) {
        if (block.content) {
            if (Array.isArray(block.content)) {
                for (const item of block.content) {
                    if (item.text) texts.push(item.text);
                }
            } else if (typeof block.content === 'string') {
                texts.push(block.content);
            } else if (block.content.rows) {
                // Table content
                for (const row of block.content.rows) {
                    for (const cell of (row.cells || [])) {
                        for (const cellItem of (cell.content || [])) {
                            if (cellItem.text) texts.push(cellItem.text);
                        }
                    }
                }
            }
        }
        if (block.children && block.children.length > 0) {
            texts.push(extractTextFromBlocks(block.children));
        }
    }
    return texts.join(" ");
}

async function run() {
    try {
        const masterKey = await getMasterKey();
        const dataDir = path.join(__dirname, '..', 'data');
        const files = fs.readdirSync(dataDir).filter(f => f.startsWith('WIKI_DOC_') && f.endsWith('.json'));
        
        console.log(`Found ${files.length} wiki files.`);
        
        let output = [];
        
        for (const file of files) {
            const filepath = path.join(dataDir, file);
            const content = fs.readFileSync(filepath, 'utf8');
            const json = JSON.parse(content);
            
            let docData = null;
            let source = "";
            
            if (Array.isArray(json) && json.length > 0 && json[0]._enc) {
                try {
                    docData = await decryptPayload(json[0]._enc, masterKey);
                    source = "Decrypted E2EE";
                } catch (e) {
                    output.push(`File: ${file} - Failed to decrypt: ${e.message}`);
                    output.push("=".repeat(80));
                    continue;
                }
            } else {
                // Already plaintext json
                docData = json;
                source = "Plaintext JSON";
            }
            
            // Extract title and text
            // In WIKI_DOCs, the file name might map to the title or the metadata might be inside.
            // Let's see if we can find title.
            // For custom files, let's see if they have titles. The map customization metadata maps document ID to details.
            const extractedText = extractTextFromBlocks(docData);
            
            output.push(`File: ${file} [Source: ${source}]`);
            output.push(`Text: ${extractedText}`);
            output.push("-".repeat(40));
        }
        
        fs.writeFileSync(path.join(__dirname, 'decrypted_wiki_texts.txt'), output.join('\n'), 'utf8');
        console.log("Extracted wiki texts saved to scratch/decrypted_wiki_texts.txt");
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
