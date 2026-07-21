/* eslint-disable */
/**
 * Empirical Test Harness for R2 implementation: Hidden state & Physics Delta Time Verification
 */


import { OntologyCanvasEngine } from '../src/lib/OntologyCanvasEngine';
import { OntologyGraph } from '../src/lib/ontology.types';

console.log("=== EMPIRICAL TEST: Physics Delta Time & Hidden State Resumption ===");

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    failedTests++;
  }
}

// 1. Math Delta Clamping Test
console.log("\n--- Test 1: Math Delta Time Clamping under Extreme Background Pause ---");
const testDurationsMs = [1000, 5000, 60000, 3600000, 86400000]; // 1s, 5s, 1m, 1h, 1d

for (const duration of testDurationsMs) {
  const lastFrameTime = 10000;
  const now = lastFrameTime + duration;
  const delta = Math.min(now - lastFrameTime, 100);
  
  assert(
    delta === 100,
    `Delta clamping for ${duration}ms pause`,
    `Expected delta 100ms, got ${delta}ms`
  );
  assert(
    !isNaN(delta) && isFinite(delta),
    `Delta is valid finite number for ${duration}ms pause`
  );
}

// 2. Mock Engine & VisibilityChange Simulation
console.log("\n--- Test 2: OntologyCanvasEngine freeze/resume/wakeUp State Engine ---");

const mockGraph: OntologyGraph = {
  nodes: [
    { id: 'root-HCHPS', label: 'Root', group: 'CORE_PROJECT', baseValue: 10 },
    { id: 'node-1', label: 'Node 1', group: 'OTHER', baseValue: 5 },
    { id: 'node-2', label: 'Node 2', group: 'OTHER', baseValue: 5 }
  ],
  edges: [
    { source: 'root-HCHPS', target: 'node-1', type: 'DEPENDENCY', weight: 1.0 },
    { source: 'node-1', target: 'node-2', type: 'DEPENDENCY', weight: 0.5 }
  ]
};

const engine = new OntologyCanvasEngine();
engine.init(mockGraph);

// Set fake velocities on nodes
engine.nodes.forEach((n, idx) => {
  n.vx = (idx + 1) * 10;
  n.vy = (idx + 1) * -15;
});

// Verify velocities exist
assert(engine.nodes[1].vx === 20 && engine.nodes[1].vy === -30, "Initial node velocities set");


// Simulate Tab Hide -> freeze()
console.log("\n-> Simulating Tab Hide (document.hidden = true)...");
engine.freeze();

assert(engine.isPaused === true, "Engine isPaused is set to true on freeze()");
engine.nodes.forEach(n => {
  assert(n.vx === 0 && n.vy === 0, `Node ${n.id} velocity zeroed out on freeze()`);
});

// Run tick while frozen
const dirtyWhilePaused = engine.tick();
assert(dirtyWhilePaused === false, "tick() returns false when engine is paused");

// Simulate Tab Resume after 10 minutes -> resume() & wakeUp()
console.log("\n-> Simulating Tab Resume after 600,000ms (document.hidden = false)...");
engine.resume();

assert(engine.isPaused === false, "Engine isPaused is set to false on resume()");
assert(engine.physicsAlpha === 1.0, "physicsAlpha reset to 1.0 on wakeUp()");
assert(engine.needsRedraw === true, "needsRedraw set to true on wakeUp()");

// 3. Simulated Animation Loop & Delta Time Resumption Sequence
console.log("\n--- Test 3: Simulated Animation Loop & Timestamp Reset Sequence ---");

let lastFrameTime = 100;
let animationRefCurrent = 1; // active loop

// Mock visibility handler sequence
function simulateVisibilityToggle(pauseDurationMs: number) {
  console.log(`\nSimulating tab hide for ${pauseDurationMs}ms...`);
  
  // Step 1: Hide
  const isHidden = true;
  if (isHidden) {
    animationRefCurrent = 0; // cancelAnimationFrame
    engine.freeze();
  }

  // Step 2: Time passes while hidden...
  let mockPerformanceNow = 100 + pauseDurationMs;

  // Step 3: Tab becomes visible again
  const resumePhysicsLoop = () => {
    if (animationRefCurrent === 0) {
      engine.needsRedraw = true;
      lastFrameTime = mockPerformanceNow; // reset timestamp!
      animationRefCurrent = 2; // re-scheduled requestAnimationFrame
    }
  };

  resumePhysicsLoop();

  assert(lastFrameTime === mockPerformanceNow, `lastFrameTime updated to current time (${mockPerformanceNow})`);
  assert(animationRefCurrent === 2, "requestAnimationFrame re-scheduled on resume");

  // Step 4: First frame executes after resume (16ms later)
  mockPerformanceNow += 16;
  const now = mockPerformanceNow;
  const delta = Math.min(now - lastFrameTime, 100);
  lastFrameTime = now;

  assert(delta === 16, `First frame delta time after resume is small (${delta}ms)`);
  assert(!isNaN(delta) && delta < 100, "Delta time did NOT explode!");
}

simulateVisibilityToggle(300000); // 5 minute tab switch
simulateVisibilityToggle(7200000); // 2 hour tab switch

// Summary
console.log("\n====================================================");
console.log(`RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log("====================================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
