const fs = require('fs');
const path = require('path');

function getCanonicalWikiId(nodeId) {
  if (nodeId.startsWith('leaf-')) {
    if (nodeId.startsWith('leaf-tag-')) {
      const parts = nodeId.split('-');
      if (parts.length >= 4) {
        return `leaf-kw-${parts.slice(3).join('-')}`;
      }
    }
    const parts = nodeId.split('-');
    if (parts[1] === 'kw') {
      return nodeId;
    }
    return `leaf-kw-${parts.slice(1).join('-')}`;
  }
  return nodeId;
}

const backupPath = 'hchps-backup.json';
if (!fs.existsSync(backupPath)) {
  console.error('Backup file not found!');
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const wikiKeys = Object.keys(backup).filter(k => k.startsWith('HCHPS-Wiki-'));

console.log(`Found ${wikiKeys.length} wiki keys in hchps-backup.json`);

let missingCount = 0;
let emptyCount = 0;

for (const key of wikiKeys) {
  const originalNodeId = key.replace('HCHPS-Wiki-', '');
  const canonicalNodeId = getCanonicalWikiId(originalNodeId);
  
  const originalSheet = `WIKI_DOC_${originalNodeId}`;
  const canonicalSheet = `WIKI_DOC_${canonicalNodeId}`;
  
  const originalFile = path.join('data', `${originalSheet}.json`);
  const canonicalFile = path.join('data', `${canonicalSheet}.json`);
  
  const hasOriginal = fs.existsSync(originalFile);
  const hasCanonical = fs.existsSync(canonicalFile);
  
  if (!hasOriginal && !hasCanonical) {
    console.log(`[MISSING] Both original (${originalFile}) and canonical (${canonicalFile}) are missing for key: ${key}`);
    missingCount++;
  } else {
    // Check if empty
    const fileToRead = hasCanonical ? canonicalFile : originalFile;
    const stat = fs.statSync(fileToRead);
    if (stat.size < 50) {
      console.log(`[EMPTY] File ${fileToRead} is empty/very small (${stat.size} bytes)`);
      emptyCount++;
    }
  }
}

console.log(`Summary: Missing: ${missingCount}, Empty: ${emptyCount}`);
