const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 EMPIRICAL CHALLENGER R1 & R2 VERIFICATION');
console.log('====================================================');

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ↳ ✅ [PASS] ${message}`);
  } else {
    console.error(`  ↳ ❌ [FAIL] ${message}`);
    failures++;
  }
}

const rootDir = path.resolve(__dirname, '..');

// 1. Verify React Query hooks (R1)
console.log('\n🔍 [CHECK 1] Inspecting React Query Hooks (R1)...');

const hooks = [
  { file: 'src/hooks/useTasks.ts', fallbackKey: 'hchps-fallback-TASKS' },
  { file: 'src/hooks/useBudget.ts', fallbackKey: 'hchps-fallback-BUDGET_CATEGORIES' },
  { file: 'src/hooks/useInventory.ts', fallbackKey: 'hchps-fallback-INVENTORY' },
  { file: 'src/hooks/useContacts.ts', fallbackKey: 'hchps-fallback-CONTACTS' }
];

hooks.forEach(h => {
  const filePath = path.join(rootDir, h.file);
  const content = fs.readFileSync(filePath, 'utf8');

  assert(content.includes('initialData:'), `${h.file} includes 'initialData' configuration`);
  assert(content.includes(h.fallbackKey), `${h.file} checks localStorage fallback '${h.fallbackKey}'`);
  assert(content.includes('onMutate:'), `${h.file} implements 'onMutate' optimistic UI update`);
  assert(!content.includes('onSettled:'), `${h.file} has ZERO redundant 'onSettled' invalidateQueries`);
  assert(content.includes('refetchOnWindowFocus: false'), `${h.file} sets 'refetchOnWindowFocus: false'`);
  assert(content.includes('refetchIntervalInBackground: false'), `${h.file} sets 'refetchIntervalInBackground: false'`);
});

// 2. Verify useLocalhostHealth & LocalhostStatusHUD (R2)
console.log('\n🔍 [CHECK 2] Inspecting Localhost Health & HUD (R2)...');

const healthPath = path.join(rootDir, 'src/hooks/useLocalhostHealth.ts');
const healthContent = fs.readFileSync(healthPath, 'utf8');

assert(healthContent.includes('/api/app-logs'), 'useLocalhostHealth fetches /api/app-logs endpoint');
assert(healthContent.includes('port3001'), 'useLocalhostHealth probes Port 3001');
assert(healthContent.includes('heapMemory'), 'useLocalhostHealth monitors Heap Memory (Client + Server)');
assert(healthContent.includes('backups'), 'useLocalhostHealth tracks Auto-Backups (son, father, grandfather, total)');
assert(healthContent.includes('fileWatcher'), 'useLocalhostHealth probes File Watcher active & path');
assert(healthContent.includes('offlineSync'), 'useLocalhostHealth tracks Offline Sync indicator');
assert(healthContent.includes('refetchIntervalInBackground: false'), 'useLocalhostHealth has refetchIntervalInBackground: false (Zero Background Stall)');
assert(healthContent.includes('refetchOnWindowFocus: false'), 'useLocalhostHealth has refetchOnWindowFocus: false (Zero Background Stall)');

const hudPath = path.join(rootDir, 'src/components/layout/LocalhostStatusHUD.tsx');
const hudContent = fs.readFileSync(hudPath, 'utf8');

assert(hudContent.includes('useLocalhostHealth'), 'LocalhostStatusHUD consumes useLocalhostHealth hook');
assert(hudContent.includes('3001'), 'LocalhostStatusHUD displays Port 3001 badge');
assert(hudContent.includes('Heap Memory Monitoring'), 'LocalhostStatusHUD renders Heap Memory gauges');
assert(hudContent.includes('Auto-Backup Tiers'), 'LocalhostStatusHUD renders 4-tier Auto-Backup grid');
assert(hudContent.includes('File Watcher Target'), 'LocalhostStatusHUD displays File Watcher path');

console.log('\n====================================================');
if (failures === 0) {
  console.log('🎉 ALL EMPIRICAL CHECKS PASSED (0 failures)!');
} else {
  console.log(`❌ VERIFICATION FAILED with ${failures} failure(s).`);
}
console.log('====================================================');

process.exit(failures > 0 ? 1 : 0);
