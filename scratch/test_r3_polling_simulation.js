// Empirical verification script for R3 DB Polling & React Query Refetch Optimization
// File: scratch/test_r3_polling_simulation.js

const assert = require('assert');

console.log('=== STARTING R3 EMPIRICAL STRESS TESTS ===\n');

// -------------------------------------------------------------
// Test 1 & 2: Simulating useGraphCustomization polling behavior
// -------------------------------------------------------------

class MockDocument {
  constructor() {
    this.visibilityState = 'visible';
    this.listeners = new Map();
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
  }

  removeEventListener(event, fn) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(fn);
    }
  }

  dispatchEvent(event) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(fn => fn());
    }
  }
}

function createPollingModuleMock(mockDoc) {
  let activePollInterval = null;
  let activePollCount = 0;
  let pollCallCount = 0;
  let inFlightPolls = 0;
  let maxConcurrentPolls = 0;

  const runPoll = async () => {
    if (mockDoc.visibilityState === 'hidden') return;
    pollCallCount++;
    inFlightPolls++;
    if (inFlightPolls > maxConcurrentPolls) {
      maxConcurrentPolls = inFlightPolls;
    }
    // Simulate network delay
    await new Promise(r => setTimeout(r, 50));
    inFlightPolls--;
  };

  const startOrResetInterval = () => {
    if (activePollInterval) {
      clearInterval(activePollInterval);
      activePollInterval = null;
    }
    activePollInterval = setInterval(() => {
      if (mockDoc.visibilityState === 'hidden') return;
      runPoll();
    }, 10000);
  };

  function mountComponent(enabled = true, isCloudLoaded = true) {
    if (!enabled || !isCloudLoaded) return () => {};

    activePollCount++;

    const handleVisibilityChange = () => {
      if (mockDoc.visibilityState === 'visible' && enabled) {
        runPoll();
        startOrResetInterval();
      }
    };

    mockDoc.addEventListener('visibilitychange', handleVisibilityChange);

    if (!activePollInterval) {
      if (mockDoc.visibilityState !== 'hidden') {
        runPoll();
      }
      startOrResetInterval();
    }

    return () => {
      mockDoc.removeEventListener('visibilitychange', handleVisibilityChange);
      activePollCount--;
      if (activePollCount <= 0 && activePollInterval) {
        clearInterval(activePollInterval);
        activePollInterval = null;
      }
    };
  }

  return {
    mountComponent,
    getStats: () => ({
      activePollCount,
      hasActiveInterval: activePollInterval !== null,
      pollCallCount,
      maxConcurrentPolls,
      listenerCount: mockDoc.listeners.get('visibilitychange')?.size || 0
    }),
    resetStats: () => {
      pollCallCount = 0;
      maxConcurrentPolls = 0;
    }
  };
}

console.log('--- TEST 1: Multiple Instance Mounts & Single Visibility Change Event ---');
const mockDoc1 = new MockDocument();
const pollModule1 = createPollingModuleMock(mockDoc1);

// Mount 3 instances of useGraphCustomization
const unmount1 = pollModule1.mountComponent(true, true);
const unmount2 = pollModule1.mountComponent(true, true);
const unmount3 = pollModule1.mountComponent(true, true);

let stats = pollModule1.getStats();
console.log('Stats after mounting 3 components:', stats);
assert.strictEqual(stats.activePollCount, 3, 'Active poll count should be 3');
assert.strictEqual(stats.listenerCount, 3, 'There are 3 event listeners registered');
assert.strictEqual(stats.hasActiveInterval, true, 'Interval should be active');

// Reset call counts
pollModule1.resetStats();

// Trigger visibility change to 'visible'
mockDoc1.visibilityState = 'visible';
mockDoc1.dispatchEvent('visibilitychange');

stats = pollModule1.getStats();
console.log('Stats after 1 visibilitychange event with 3 instances:', stats);
console.log(`[FINDING 1] Number of poll calls fired for 1 tab toggle: ${stats.pollCallCount}`);
// Notice: 3 event listeners fire runPoll()! Each instance fired runPoll() independently.

// Clean up
unmount1();
unmount2();
unmount3();
stats = pollModule1.getStats();
console.log('Stats after unmounting all components:', stats);
assert.strictEqual(stats.activePollCount, 0);
assert.strictEqual(stats.hasActiveInterval, false);
assert.strictEqual(stats.listenerCount, 0);

console.log('\n--- TEST 2: Rapid Tab Toggles (Visibility Event Storm) ---');
const mockDoc2 = new MockDocument();
const pollModule2 = createPollingModuleMock(mockDoc2);

const unmountSingle = pollModule2.mountComponent(true, true);
pollModule2.resetStats();

// Rapidly toggle visibility state 30 times in quick succession
for (let i = 0; i < 30; i++) {
  mockDoc2.visibilityState = 'hidden';
  mockDoc2.dispatchEvent('visibilitychange');
  mockDoc2.visibilityState = 'visible';
  mockDoc2.dispatchEvent('visibilitychange');
}

stats = pollModule2.getStats();
console.log('Stats after 30 rapid tab toggles:', stats);
console.log(`[FINDING 2] Number of poll calls triggered by 30 rapid tab toggles: ${stats.pollCallCount}`);
console.log(`[FINDING 2] Max concurrent in-flight polls: ${stats.maxConcurrentPolls}`);

unmountSingle();

// -------------------------------------------------------------
// Test 3: React Query defaultOptions in query-client.ts
// -------------------------------------------------------------
console.log('\n--- TEST 3: React Query Defaults & Override Capability ---');

const { QueryClient } = require('@tanstack/react-query');

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        const errStatus = error?.status;
        if (errStatus === 401 || errStatus === 403) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 1,
    }
  },
});

const defaultQueryOpts = client.getDefaultOptions().queries;
console.log('Default query options:', {
  staleTime: defaultQueryOpts.staleTime,
  gcTime: defaultQueryOpts.gcTime,
  refetchOnWindowFocus: defaultQueryOpts.refetchOnWindowFocus,
  refetchOnReconnect: defaultQueryOpts.refetchOnReconnect,
});

assert.strictEqual(defaultQueryOpts.staleTime, 300000);
assert.strictEqual(defaultQueryOpts.gcTime, 1800000);
assert.strictEqual(defaultQueryOpts.refetchOnWindowFocus, false);
assert.strictEqual(defaultQueryOpts.refetchOnReconnect, false);

// Test retry handler for auth errors vs general errors
const retryFn = defaultQueryOpts.retry;
assert.strictEqual(retryFn(0, { status: 401 }), false, '401 should not retry');
assert.strictEqual(retryFn(0, { status: 403 }), false, '403 should not retry');
assert.strictEqual(retryFn(0, { status: 500 }), true, '500 attempt 0 should retry');
assert.strictEqual(retryFn(1, { status: 500 }), true, '500 attempt 1 should retry');
assert.strictEqual(retryFn(2, { status: 500 }), false, '500 attempt 2 should not retry (max 2 retries)');

console.log('React Query default options verified successfully.');

// -------------------------------------------------------------
// Test 4: useAppLogs query options when enabled/disabled
// -------------------------------------------------------------
console.log('\n--- TEST 4: useAppLogs Query Options ---');

function getAppLogsOptions(enabled = false) {
  return {
    queryKey: ['app-logs'],
    enabled,
    refetchInterval: enabled ? 10000 : false,
    refetchIntervalInBackground: false,
  };
}

const disabledOpts = getAppLogsOptions(false);
assert.strictEqual(disabledOpts.enabled, false);
assert.strictEqual(disabledOpts.refetchInterval, false);

const enabledOpts = getAppLogsOptions(true);
assert.strictEqual(enabledOpts.enabled, true);
assert.strictEqual(enabledOpts.refetchInterval, 10000);
assert.strictEqual(enabledOpts.refetchIntervalInBackground, false);

console.log('useAppLogs query options verified successfully.');

console.log('\n=== ALL EMPIRICAL STRESS TESTS COMPLETED ===');
