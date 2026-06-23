const fs = require('fs');
const { execSync } = require('child_process');
const { webcrypto } = require('crypto');
const { buildOntologyGraph } = require('../src/lib/ontology.service');

const pin = '0509';
const SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

async function decrypt(encryptedBase64, masterKey) {
  if (!encryptedBase64) return null;
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

async function getDecryptedMap(content, masterKey) {
  const rawMap = JSON.parse(content);
  const singleton = rawMap.find(item => item.id === 'singleton');
  if (!singleton) return null;
  if (!singleton._enc) return singleton;
  return await decrypt(singleton._enc, masterKey);
}

// Mimic the backend build of graph
function calculateGraph(mapData) {
  const nodes = mapData.customNodes || [];
  const edges = mapData.customEdges || [];
  
  // Convert nodes & edges to string[][] as buildOntologyGraph expects raw arrays
  // but wait, buildOntologyGraph is in typescript, so let's see how it expects nodes and edges.
  // Oh, buildOntologyGraph is imported from buildOntologyGraph in ontology.service.js which is TS compiled.
  // Let's see: ontology.service.ts has buildOntologyGraph(nodesRaw: string[][], edgesRaw: string[][])
  // Wait, let's just use computeCentrality directly if we can, or just mock it.
  // Wait, computeCentrality is exported! Let's check.
  // Yes: export function computeCentrality(nodes: OntologyNode[], edges: OntologyEdge[])
  const { computeCentrality } = require('../src/lib/ontology.service');
  return computeCentrality(nodes, edges);
}

async function main() {
  const masterKey = await getMasterKey();

  // Load current map
  const currentContent = fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8');
  const currentMap = await getDecryptedMap(currentContent, masterKey);
  const currentScoredNodes = calculateGraph(currentMap);

  // Load git HEAD map
  let gitMap = null;
  try {
    const gitContent = execSync('git show HEAD:data/MAP_CUSTOMIZATION.json', { encoding: 'utf8' });
    gitMap = await getDecryptedMap(gitContent, masterKey);
  } catch (err) {
    console.warn("Could not load map from git HEAD:", err.message);
  }

  const gitScoredNodes = gitMap ? calculateGraph(gitMap) : [];

  console.log("=== Top 15 Nodes by Centrality (Current) ===");
  currentScoredNodes
    .sort((a, b) => (b.centralityScore ?? 0) - (a.centralityScore ?? 0))
    .slice(0, 15)
    .forEach((n, idx) => {
      console.log(`${idx + 1}. [${n.label}] (id: ${n.id}) - centrality: ${n.centralityScore?.toFixed(4)}, renderSize: ${n.renderSize?.toFixed(4)}`);
    });

  if (gitScoredNodes.length > 0) {
    console.log("\n=== Top 15 Nodes by Centrality (Git HEAD) ===");
    gitScoredNodes
      .sort((a, b) => (b.centralityScore ?? 0) - (a.centralityScore ?? 0))
      .slice(0, 15)
      .forEach((n, idx) => {
        console.log(`${idx + 1}. [${n.label}] (id: ${n.id}) - centrality: ${n.centralityScore?.toFixed(4)}, renderSize: ${n.renderSize?.toFixed(4)}`);
      });
  }
}

main().catch(console.error);
