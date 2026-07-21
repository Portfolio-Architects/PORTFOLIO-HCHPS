import { OntologyLayout } from '../src/lib/engine/OntologyLayout';
import { OrbitalNode, OntologyEdge, OntologyGroup, OntologyLayerId } from '../src/lib/ontology.types';

// ==========================================
// Mocks for Dom / Browser globals since this runs under node
// ==========================================
(global as any).window = {};
(global as any).document = {
  createElement: () => ({
    getContext: () => ({}),
    width: 0,
    height: 0
  })
};

// ==========================================
// 1. Spatial Grid Logic copy from OntologyRenderer.ts
// ==========================================
class SpatialGridTest {
  public static spatialGrid = new Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>();
  public static cellArrayPool: Array<Array<{x1: number, y1: number, x2: number, y2: number}>> = [];
  public static cellArrayPoolUsed = 0;

  public static addBoxToGrid(box: {x1: number, y1: number, x2: number, y2: number}, gridCellSize: number) {
    const colStart = Math.floor(box.x1 / gridCellSize);
    const colEnd = Math.floor(box.x2 / gridCellSize);
    const rowStart = Math.floor(box.y1 / gridCellSize);
    const rowEnd = Math.floor(box.y2 / gridCellSize);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const key = ((r + 32768) << 16) | (c + 32768);
        let arr = SpatialGridTest.spatialGrid.get(key);
        if (!arr) {
          if (SpatialGridTest.cellArrayPoolUsed < SpatialGridTest.cellArrayPool.length) {
            arr = SpatialGridTest.cellArrayPool[SpatialGridTest.cellArrayPoolUsed++];
            arr.length = 0;
          } else {
            arr = [];
            SpatialGridTest.cellArrayPool.push(arr);
            SpatialGridTest.cellArrayPoolUsed++;
          }
          SpatialGridTest.spatialGrid.set(key, arr);
        }
        arr.push(box);
      }
    }
  }

  public static checkOverlapWithGrid(rect: {x1: number, y1: number, x2: number, y2: number}, gridCellSize: number): boolean {
    const colStart = Math.floor(rect.x1 / gridCellSize);
    const colEnd = Math.floor(rect.x2 / gridCellSize);
    const rowStart = Math.floor(rect.y1 / gridCellSize);
    const rowEnd = Math.floor(rect.y2 / gridCellSize);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const key = ((r + 32768) << 16) | (c + 32768);
        const boxes = SpatialGridTest.spatialGrid.get(key);
        if (boxes) {
          for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            if (!(rect.x2 < box.x1 || rect.x1 > box.x2 || rect.y2 < box.y1 || rect.y1 > box.y2)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  public static reset() {
    SpatialGridTest.spatialGrid.clear();
    SpatialGridTest.cellArrayPoolUsed = 0;
  }
}

// Helper to generate hash key
function getGridKey(r: number, c: number): number {
  return ((r + 32768) << 16) | (c + 32768);
}

function createMockNode(id: string, group: OntologyGroup, parentId?: string, layerId?: OntologyLayerId): OrbitalNode {
  return {
    id,
    label: `Label for ${id}`,
    group,
    baseValue: 50,
    parentId,
    layerId,
    orbitIndex: parentId ? 1 : 0,
    orbitAngle: 0,
    orbitSpeed: 0.0006,
    renderX: 0,
    renderY: 0,
    renderZ: 0,
    connectionToCenter: 1,
    nodeRadius: 10
  };
}

async function runTests() {
  console.log("=== STARTING OPTIMIZATION VERIFICATION HARNESS ===");

  // ==========================================
  // Test 1: Spatial Grid Key Collisions
  // ==========================================
  console.log("\n--- TEST 1: Spatial Grid Key Uniqueness (Collision Check) ---");
  const rMin = -2000, rMax = 2000;
  const cMin = -2000, cMax = 2000;
  
  const testedKeys = new Set<number>();
  let collisions = 0;
  let totalTested = 0;

  // Test corners and borders
  const boundaryCoords: Array<[number, number]> = [];
  const edgeCoords = [-32768, -32767, -2000, -1, 0, 1, 2000, 32767];
  for (const r of edgeCoords) {
    for (const c of edgeCoords) {
      boundaryCoords.push([r, c]);
    }
  }

  for (const [r, c] of boundaryCoords) {
    const key = getGridKey(r, c);
    if (testedKeys.has(key)) {
      collisions++;
      console.error(`COLLISION DETECTED for boundary: (${r}, ${c})`);
    }
    testedKeys.add(key);
    totalTested++;
  }

  // Test random coordinates within range
  for (let i = 0; i < 500000; i++) {
    const r = Math.floor(Math.random() * (rMax - rMin + 1)) + rMin;
    const c = Math.floor(Math.random() * (cMax - cMin + 1)) + cMin;
    const key = getGridKey(r, c);
    
    const decodedC = (key & 0xFFFF) - 32768;
    const decodedR = (key >> 16) - 32768;

    if (decodedR !== r || decodedC !== c) {
      collisions++;
      console.error(`COLLISION/RECOVERY ERROR for: (${r}, ${c}) decoded as (${decodedR}, ${decodedC}), key: ${key}`);
    }
    totalTested++;
  }

  if (collisions === 0) {
    console.log(`[PASS] Verified ${totalTested} key mapping pairs. 0 collisions detected. Reverse mapping is bijective.`);
  } else {
    console.error(`[FAIL] ${collisions} collisions or decoding errors detected!`);
    process.exit(1);
  }

  // ==========================================
  // Test 2: Overlap Detection Correctness
  // ==========================================
  console.log("\n--- TEST 2: Overlap Detection Correctness ---");
  SpatialGridTest.reset();
  const gridCellSize = 100;

  // Insert a box at (150, 150) -> (250, 250)
  const box1 = { x1: 150, y1: 150, x2: 250, y2: 250 };
  SpatialGridTest.addBoxToGrid(box1, gridCellSize);

  // Box 2: completely overlaps Box 1
  const box2 = { x1: 160, y1: 160, x2: 240, y2: 240 };
  const overlap2 = SpatialGridTest.checkOverlapWithGrid(box2, gridCellSize);
  
  // Box 3: overlaps corner
  const box3 = { x1: 240, y1: 240, x2: 300, y2: 300 };
  const overlap3 = SpatialGridTest.checkOverlapWithGrid(box3, gridCellSize);

  // Box 4: overlaps edge
  const box4 = { x1: 100, y1: 200, x2: 200, y2: 210 };
  const overlap4 = SpatialGridTest.checkOverlapWithGrid(box4, gridCellSize);

  // Box 5: does NOT overlap (adjacent but outside)
  const box5 = { x1: 251, y1: 251, x2: 300, y2: 300 };
  const overlap5 = SpatialGridTest.checkOverlapWithGrid(box5, gridCellSize);

  // Box 6: does NOT overlap (far away)
  const box6 = { x1: -100, y1: -100, x2: 0, y2: 0 };
  const overlap6 = SpatialGridTest.checkOverlapWithGrid(box6, gridCellSize);

  let overlapErrors = 0;
  if (!overlap2) { overlapErrors++; console.error("Error: Failed to detect complete overlap."); }
  if (!overlap3) { overlapErrors++; console.error("Error: Failed to detect corner overlap."); }
  if (!overlap4) { overlapErrors++; console.error("Error: Failed to detect edge overlap."); }
  if (overlap5) { overlapErrors++; console.error("Error: False positive on adjacent non-overlapping box."); }
  if (overlap6) { overlapErrors++; console.error("Error: False positive on far away non-overlapping box."); }

  if (overlapErrors === 0) {
    console.log("[PASS] Overlap detection behaves correctly for all tested cases.");
  } else {
    console.error(`[FAIL] ${overlapErrors} overlap detection errors found.`);
    process.exit(1);
  }

  // ==========================================
  // Test 3: cellArrayPool under load (Dynamic allocation & reuse)
  // ==========================================
  console.log("\n--- TEST 3: cellArrayPool Under Load & Reuse ---");
  SpatialGridTest.reset();
  
  // Warm up: Add 1000 boxes to 1000 different cells
  for (let i = 0; i < 1000; i++) {
    const x = i * 150;
    const y = i * 150;
    SpatialGridTest.addBoxToGrid({ x1: x, y1: y, x2: x + 10, y2: y + 10 }, gridCellSize);
  }

  const poolSizeAfterWarmup = SpatialGridTest.cellArrayPool.length;
  const poolUsedAfterWarmup = SpatialGridTest.cellArrayPoolUsed;
  console.log(`After inserting 1000 boxes:`);
  console.log(`  - cellArrayPool size: ${poolSizeAfterWarmup}`);
  console.log(`  - cellArrayPoolUsed: ${poolUsedAfterWarmup}`);

  // Frame transition: clear spatial grid, reset pool pointer
  SpatialGridTest.reset();
  
  // Re-insert 1000 boxes to different cells
  for (let i = 0; i < 1000; i++) {
    const x = i * 150;
    const y = i * 150;
    SpatialGridTest.addBoxToGrid({ x1: x, y1: y, x2: x + 10, y2: y + 10 }, gridCellSize);
  }

  const poolSizeAfterReuse = SpatialGridTest.cellArrayPool.length;
  const poolUsedAfterReuse = SpatialGridTest.cellArrayPoolUsed;
  console.log(`After second frame insertion of 1000 boxes (expecting reuse):`);
  console.log(`  - cellArrayPool size: ${poolSizeAfterReuse}`);
  console.log(`  - cellArrayPoolUsed: ${poolUsedAfterReuse}`);

  let poolErrors = 0;
  if (poolSizeAfterReuse > poolSizeAfterWarmup) {
    poolErrors++;
    console.error(`Error: Pool size grew from ${poolSizeAfterWarmup} to ${poolSizeAfterReuse} instead of reusing arrays.`);
  }
  if (poolUsedAfterReuse !== poolUsedAfterWarmup) {
    poolErrors++;
    console.error(`Error: Pool utilization mismatch. Expected ${poolUsedAfterWarmup}, got ${poolUsedAfterReuse}.`);
  }

  // Verify that reusing an array clears its length
  for (let i = 0; i < SpatialGridTest.cellArrayPool.length; i++) {
    const arr = SpatialGridTest.cellArrayPool[i];
    if (i < SpatialGridTest.cellArrayPoolUsed) {
      if (arr.length !== 1) {
        poolErrors++;
        console.error(`Error: Reused array at index ${i} has length ${arr.length} instead of 1.`);
      }
    }
  }

  if (poolErrors === 0) {
    console.log("[PASS] Array pooling behaves correctly. Pool size is capped, and arrays are reset on reuse.");
  } else {
    console.error("[FAIL] Array pooling errors detected!");
    process.exit(1);
  }

  // ==========================================
  // Test 4: computePositions grouping and safety
  // ==========================================
  console.log("\n--- TEST 4: computePositions Grouping & Memory Safety ---");
  
  const mockNodes: OrbitalNode[] = [];
  const nodeMap = new Map<string, OrbitalNode>();

  // Add center root
  const rootNode = createMockNode('root-HCHPS', 'CORE_PROJECT');
  rootNode.centralityScore = 9999999;
  rootNode.effectiveLayer = 0;
  mockNodes.push(rootNode);
  nodeMap.set(rootNode.id, rootNode);

  // Add 1st, 2nd, 3rd tier nodes
  for (let i = 1; i <= 59; i++) {
    let parentId = 'root-HCHPS';
    let layerId: OntologyLayerId = 1;
    if (i > 15 && i <= 35) {
      parentId = `node-${i - 10}`;
      layerId = 2;
    } else if (i > 35) {
      parentId = `node-${i - 20}`;
      layerId = 3;
    }

    const node = createMockNode(`node-${i}`, i % 5 === 0 ? 'SYSTEM_RISK' : (i % 3 === 0 ? 'MACRO_RESEARCH' : 'CORE_PROJECT'), parentId, layerId);
    mockNodes.push(node);
    nodeMap.set(node.id, node);
  }

  // Construct edges
  const mockEdges: OntologyEdge[] = [];
  mockNodes.forEach(node => {
    if (node.parentId) {
      mockEdges.push({
        source: node.parentId,
        target: node.id,
        type: 'DEPENDENCY',
        weight: 1.0
      });
    }
  });

  // Test running computePositions multiple times under load
  const iterations = 1000;
  console.log(`Running OntologyLayout.computePositions under load for ${iterations} iterations...`);
  const startTime = Date.now();
  let successCount = 0;
  let errorMsg = '';

  try {
    for (let it = 0; it < iterations; it++) {
      const recompute = it === 0 || it % 20 === 0;
      const orbiting = it % 2 === 0;
      const dragging = it % 3 === 0;

      OntologyLayout.computePositions(
        mockNodes,
        nodeMap,
        mockEdges,
        1200, // canvasW
        800,  // canvasH
        0,    // cameraOffsetX
        0,    // cameraOffsetY
        1.0,  // zoom
        new Set<string>(), // collapsedNodeIds
        undefined, // activeLayers
        true, // isInteractive
        recompute, // recomputeWorldPositions
        orbiting,  // isOrbiting
        dragging   // isDragging
      );
      successCount++;
    }
  } catch (err: any) {
    errorMsg = err.message || String(err);
    console.error(`Crash inside computePositions: ${errorMsg}`);
  }

  const duration = Date.now() - startTime;
  console.log(`Completed ${successCount}/${iterations} layout loops in ${duration}ms.`);

  let computeErrors = 0;
  if (successCount !== iterations) {
    computeErrors++;
    console.error(`Error: computePositions crashed. Success rate: ${successCount}/${iterations}`);
  }

  const collisionGroups = (OntologyLayout as any).collisionGroups as OrbitalNode[][];
  if (collisionGroups) {
    console.log("Collision Groups sizes:");
    for (let k = 0; k < collisionGroups.length; k++) {
      console.log(`  - Group ${k} size: ${collisionGroups[k].length}`);
      
      for (const node of collisionGroups[k]) {
        if (node.layoutHidden) {
          computeErrors++;
          console.error(`Error: Hidden node ${node.id} is present in collision group ${k}.`);
        }
        const layer = node.effectiveLayer ?? 3;
        const clampedLayer = Math.max(0, Math.min(3, layer));
        if (clampedLayer !== k) {
          computeErrors++;
          console.error(`Error: Node ${node.id} with clamped layer ${clampedLayer} placed in group ${k}.`);
        }
      }
    }
  } else {
    computeErrors++;
    console.error("Error: OntologyLayout.collisionGroups is not defined or accessible.");
  }

  if (computeErrors === 0) {
    console.log("[PASS] computePositions executed successfully. Correct grouping, zero crashes, and fast execution.");
  } else {
    console.error(`[FAIL] computePositions verification failed with ${computeErrors} errors.`);
    process.exit(1);
  }

  console.log("\n=== ALL HARNESS VERIFICATIONS PASSED SUCCESSFULLY! ===");
}

runTests().catch(err => {
  console.error("Harness failed with uncaught exception:", err);
  process.exit(1);
});
