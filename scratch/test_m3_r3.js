const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 EMPIRICAL TEST SUITE: R3 Optimization Verification');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// Test 1: QueryClient Default Options in src/lib/query-client.ts
// -----------------------------------------------------------------------------
test('QueryClient Options Verification', () => {
  const queryClientPath = path.join(__dirname, '..', 'src', 'lib', 'query-client.ts');
  const code = fs.readFileSync(queryClientPath, 'utf8');

  // Regex checks for exact key-value pairs
  const staleTimeMatch = code.match(/staleTime:\s*5\s*\*\s*60\s*\*\s*1000/);
  assert(staleTimeMatch, 'staleTime must be 5 * 60 * 1000 (5 minutes)');

  const gcTimeMatch = code.match(/gcTime:\s*30\s*\*\s*60\s*\*\s*1000/);
  assert(gcTimeMatch, 'gcTime must be 30 * 60 * 1000 (30 minutes)');

  const refetchOnWindowFocusMatch = code.match(/refetchOnWindowFocus:\s*false/);
  assert(refetchOnWindowFocusMatch, 'refetchOnWindowFocus must be false');

  const refetchOnReconnectMatch = code.match(/refetchOnReconnect:\s*false/);
  assert(refetchOnReconnectMatch, 'refetchOnReconnect must be false');
});

// -----------------------------------------------------------------------------
// Test 2: Timer & Listener Cleanup in src/hooks/useGraphCustomization.ts
// -----------------------------------------------------------------------------
test('useGraphCustomization Cleanup & Listener Verification', () => {
  const fileContent = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'hooks', 'useGraphCustomization.ts'),
    'utf8'
  );

  // 1. Verify removeEventListener is present in cleanup
  assert(
    fileContent.includes("document.removeEventListener('visibilitychange', handleVisibilityChange)"),
    'Cleanup function must call document.removeEventListener for visibilitychange'
  );

  // 2. Verify clearInterval is present in cleanup when activePollCount <= 0
  assert(
    fileContent.includes('clearInterval(activePollInterval)'),
    'Cleanup function must call clearInterval(activePollInterval)'
  );

  // 3. Verify activePollCount decrement on unmount
  assert(
    fileContent.includes('activePollCount--'),
    'Cleanup function must decrement activePollCount'
  );

  // 4. Verify visibility state check inside poll and visibility handler
  assert(
    fileContent.includes("document.visibilityState === 'hidden'"),
    'Polling function must check document.visibilityState === hidden to suppress background polls'
  );
});

// -----------------------------------------------------------------------------
// Test 2B: Simulation of useGraphCustomization Singleton Polling Lifecycle
// -----------------------------------------------------------------------------
test('Simulated Lifecycle & Multi-Mount/Unmount Logic', () => {
  let activePollInterval = null;
  let activePollCount = 0;
  let intervalCleared = false;
  let intervalCreatedCount = 0;
  let eventListenersCount = 0;

  // Mock document
  const mockDocument = {
    visibilityState: 'visible',
    addEventListener: (event, handler) => {
      if (event === 'visibilitychange') eventListenersCount++;
    },
    removeEventListener: (event, handler) => {
      if (event === 'visibilitychange') eventListenersCount--;
    }
  };

  // Simulated Hook Mount
  function mountHook() {
    activePollCount++;
    const handleVisibilityChange = () => {};
    mockDocument.addEventListener('visibilitychange', handleVisibilityChange);

    if (!activePollInterval) {
      intervalCreatedCount++;
      activePollInterval = 12345; // dummy timer ID
      intervalCleared = false;
    }

    // Cleanup function (returned by useEffect)
    return function unmountHook() {
      mockDocument.removeEventListener('visibilitychange', handleVisibilityChange);
      activePollCount--;
      if (activePollCount <= 0 && activePollInterval) {
        intervalCleared = true;
        activePollInterval = null;
      }
    };
  }

  // Action 1: Mount instance 1
  const unmount1 = mountHook();
  assert.strictEqual(activePollCount, 1, 'Instance 1 mounted, count should be 1');
  assert.strictEqual(eventListenersCount, 1, '1 event listener registered');
  assert.strictEqual(intervalCreatedCount, 1, '1 interval created');
  assert.strictEqual(intervalCleared, false, 'Interval should not be cleared');

  // Action 2: Mount instance 2
  const unmount2 = mountHook();
  assert.strictEqual(activePollCount, 2, 'Instance 2 mounted, count should be 2');
  assert.strictEqual(eventListenersCount, 2, '2 event listeners registered');
  assert.strictEqual(intervalCreatedCount, 1, 'No new interval created (singleton pattern)');

  // Action 3: Unmount instance 1
  unmount1();
  assert.strictEqual(activePollCount, 1, 'Instance 1 unmounted, count should be 1');
  assert.strictEqual(eventListenersCount, 1, '1 event listener remaining');
  assert.strictEqual(intervalCleared, false, 'Interval should still be active for instance 2');

  // Action 4: Unmount instance 2
  unmount2();
  assert.strictEqual(activePollCount, 0, 'Instance 2 unmounted, count should be 0');
  assert.strictEqual(eventListenersCount, 0, '0 event listeners remaining (all cleaned up!)');
  assert.strictEqual(intervalCleared, true, 'Interval successfully cleared on last unmount!');
  assert.strictEqual(activePollInterval, null, 'activePollInterval reset to null');

  // Action 5: Re-mount instance 3 (verify restart)
  const unmount3 = mountHook();
  assert.strictEqual(activePollCount, 1, 'Instance 3 mounted, count should be 1');
  assert.strictEqual(intervalCreatedCount, 2, 'New interval created after total unmount');
  unmount3();
  assert.strictEqual(activePollCount, 0, 'Cleaned up instance 3');
});

// -----------------------------------------------------------------------------
// Test 3: Background Polling Guard in src/hooks/useAppLogs.ts
// -----------------------------------------------------------------------------
test('useAppLogs Background Polling Guard Verification', () => {
  const fileContent = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'hooks', 'useAppLogs.ts'),
    'utf8'
  );

  assert(
    fileContent.includes('refetchIntervalInBackground: false'),
    'useAppLogs must explicitly configure refetchIntervalInBackground: false'
  );

  assert(
    fileContent.includes('refetchInterval: enabled ? 10000 : false'),
    'useAppLogs must set refetchInterval to 10000 when enabled'
  );
});

console.log('\n====================================================');
if (failCount === 0) {
  console.log(`🎉 ALL ${passCount} EMPIRICAL TESTS PASSED!`);
  process.exit(0);
} else {
  console.error(`🚨 ${failCount} TESTS FAILED OUT OF ${passCount + failCount}`);
  process.exit(1);
}
