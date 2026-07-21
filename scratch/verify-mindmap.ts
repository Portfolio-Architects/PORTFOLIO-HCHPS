import { OntologyLayout } from '../src/lib/engine/OntologyLayout';
import { OntologyRenderer } from '../src/lib/engine/OntologyRenderer';
import { OrbitalNode, OntologyEdge } from '../src/lib/ontology.types';

// Mock browser dependencies or globals if needed
(global as any).performance = {
  now: () => Date.now()
};

console.log("Starting Mindmap Verification...");

// ==========================================
// 1. Spatial Grid Key Collision & Overlap Test
// ==========================================
function testSpatialGridKeys() {
  console.log("\n--- Testing Spatial Grid Keys ---");
  
  // Test Key Scheme B (actually used inside renderNodes): (r << 16) | (c & 0xFFFF)
  // Let's check collisions for r, c in range [-2000, 2000] (covers -240,000px to 240,000px)
  const keys = new Set<number>();
  let collisions = 0;
  const minCell = -2000;
  const maxCell = 2000;
  
  for (let r = minCell; r <= maxCell; r++) {
    for (let c = minCell; c <= maxCell; c++) {
      const key = (r << 16) | (c & 0xFFFF);
      if (keys.has(key)) {
        collisions++;
      }
      keys.add(key);
    }
  }
  
  console.log(`Key Scheme B (r << 16 | c & 0xFFFF): Checked ${(maxCell - minCell + 1) ** 2} combinations.`);
  console.log(`Collisions found: ${collisions}`);
  
  // Test Key Scheme A (unused class-level methods): ((r + 32768) << 16) | (c + 32768)
  const keysA = new Set<number>();
  let collisionsA = 0;
  for (let r = minCell; r <= maxCell; r++) {
    for (let c = minCell; c <= maxCell; c++) {
      const key = ((r + 32768) << 16) | (c + 32768);
      if (keysA.has(key)) {
        collisionsA++;
      }
      keysA.add(key);
    }
  }
  console.log(`Key Scheme A ((r + 32768) << 16 | c + 32768): Checked ${(maxCell - minCell + 1) ** 2} combinations.`);
  console.log(`Collisions found: ${collisionsA}`);

  if (collisions === 0 && collisionsA === 0) {
    console.log("Result: Both key generation schemes are collision-free in the [-2000, 2000] cell range!");
  } else {
    console.error("Result: FAILED - Key collision detected!");
    process.exit(1);
  }
}

// ==========================================
// 2. Array Pooling (cellArrayPool) Test
// ==========================================
function testArrayPooling() {
  console.log("\n--- Testing Array Pooling under load ---");
  
  // Reset/Clear pool first
  OntologyRenderer.clearTextBoxPool();
  
  const initialPoolSize = (OntologyRenderer as any).cellArrayPool?.length || 0;
  console.log(`Initial pool size: ${initialPoolSize}`);
  
  // Simulate adding 5000 boxes into a grid Cell Size of 120
  const gridCellSize = 120;
  
  // Let's capture the local helper functions defined in OntologyRenderer.ts for testing
  const spatialGrid = new Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>();
  const cellArrayPool: Array<Array<{x1: number, y1: number, x2: number, y2: number}>> = [];
  let cellArrayPoolUsed = 0;
  
  function localAddBoxToGrid(box: {x1: number, y1: number, x2: number, y2: number}) {
    const colStart = Math.floor(box.x1 / gridCellSize);
    const colEnd = Math.floor(box.x2 / gridCellSize);
    const rowStart = Math.floor(box.y1 / gridCellSize);
    const rowEnd = Math.floor(box.y2 / gridCellSize);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const key = (r << 16) | (c & 0xFFFF);
        let arr = spatialGrid.get(key);
        if (!arr) {
          if (cellArrayPoolUsed < cellArrayPool.length) {
            arr = cellArrayPool[cellArrayPoolUsed++];
            arr.length = 0; // Reset length
          } else {
            arr = [];
            cellArrayPool.push(arr);
            cellArrayPoolUsed++;
          }
          spatialGrid.set(key, arr);
        }
        arr.push(box);
      }
    }
  }

  // Insert 5000 boxes spaced out or clustered
  const boxes: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  for (let i = 0; i < 5000; i++) {
    // Generate boxes in a 10000x10000 space
    const x = (Math.sin(i) * 5000) + 5000;
    const y = (Math.cos(i) * 5000) + 5000;
    const box = {
      x1: x - 30,
      y1: y - 10,
      x2: x + 30,
      y2: y + 10
    };
    boxes.push(box);
    localAddBoxToGrid(box);
  }

  const poolSizeAfterInsert = cellArrayPool.length;
  const poolUsedAfterInsert = cellArrayPoolUsed;
  console.log(`Pool size after 5000 insertions: ${poolSizeAfterInsert}`);
  console.log(`Pool used after 5000 insertions: ${poolUsedAfterInsert}`);

  // Verify that all retrieved arrays are non-null and empty when first retrieved
  // Reset used index and clear grid to simulate next frame
  spatialGrid.clear();
  cellArrayPoolUsed = 0;
  
  // Re-insert same boxes to check if it reuses the arrays without creating new ones
  for (let i = 0; i < 5000; i++) {
    localAddBoxToGrid(boxes[i]);
  }

  const poolSizeAfterReuse = cellArrayPool.length;
  console.log(`Pool size after reuse (frame 2): ${poolSizeAfterReuse}`);
  
  if (poolSizeAfterReuse !== poolSizeAfterInsert) {
    console.error("Result: FAILED - Array pool size grew on reuse!");
    process.exit(1);
  } else {
    console.log("Result: PASS - Array pooling correctly reused allocated arrays without allocations!");
  }
}

// ==========================================
// 3. Layout Collision Loop (computePositions) Test
// ==========================================
function testLayoutCollision() {
  console.log("\n--- Testing Layout Collision Loop under load ---");

  // Create a mock dataset of 200 nodes
  const nodes: OrbitalNode[] = [];
  const nodeMap = new Map<string, OrbitalNode>();
  const edges: OntologyEdge[] = [];

  // Central Root Node
  const root: OrbitalNode = {
    id: 'root-HCHPS',
    label: 'Root Node',
    centralityScore: 9999999,
    fixedX: 0,
    fixedY: 0,
    worldX: 0,
    worldY: 0,
    renderX: 0,
    renderY: 0,
    customOrbitIndex: 0,
    nodeRadius: 24,
    group: 'CORE_PROJECT',
    baseValue: 100,
    orbitIndex: 0,
    orbitAngle: 0,
    orbitSpeed: 0,
    renderZ: 0,
    connectionToCenter: 0
  };
  nodes.push(root);
  nodeMap.set(root.id, root);

  // Add 10 Category 1 nodes
  for (let i = 0; i < 10; i++) {
    const cat1Id = `cat1-${i}`;
    const node: OrbitalNode = {
      id: cat1Id,
      label: `Category 1 Node ${i}`,
      parentId: root.id,
      renderX: 0,
      renderY: 0,
      nodeRadius: 12,
      group: i % 2 === 0 ? 'SYSTEM_RISK' : 'OTHER',
      baseValue: 70,
      orbitIndex: 1,
      orbitAngle: 0,
      orbitSpeed: 0,
      renderZ: 0,
      connectionToCenter: 0
    };
    nodes.push(node);
    nodeMap.set(cat1Id, node);
    edges.push({ source: root.id, target: cat1Id, type: 'CAUSAL_DRIVE', weight: 1 });
  }

  // Add 190 Child nodes (total 201 nodes)
  for (let i = 0; i < 190; i++) {
    const parentIdx = i % 10;
    const parentId = `cat1-${parentIdx}`;
    const nodeId = `node-${i}`;
    const node: OrbitalNode = {
      id: nodeId,
      label: `Execution Task Node ${i}`,
      parentId: parentId,
      renderX: 0,
      renderY: 0,
      nodeRadius: 10,
      group: 'DATA_PIPELINE',
      baseValue: 50,
      orbitIndex: 2,
      orbitAngle: 0,
      orbitSpeed: 0,
      renderZ: 0,
      connectionToCenter: 0
    };
    nodes.push(node);
    nodeMap.set(nodeId, node);
    edges.push({ source: parentId, target: nodeId, type: 'DEPENDENCY', weight: 1 });
  }

  // Run computePositions under load (multiple iterations)
  const startTime = Date.now();
  
  for (let step = 0; step < 10; step++) {
    OntologyLayout.computePositions(
      nodes,
      nodeMap,
      edges,
      1920, // canvasW
      1080, // canvasH
      0,    // cameraOffsetX
      0,    // cameraOffsetY
      1.0,  // zoom
      new Set(), // collapsedNodeIds
      new Set([0, 1, 2, 3]), // activeLayers
      true, // isInteractive
      true, // recomputeWorldPositions
      false, // isOrbiting
      false  // isDragging
    );
  }

  const duration = Date.now() - startTime;
  console.log(`Successfully completed 10 steps of computePositions on 201 nodes in ${duration}ms`);

  // Verify that all visible nodes are assigned coordinate values
  let unassignedCount = 0;
  for (const node of nodes) {
    if (!node.layoutHidden) {
      if (node.renderX === undefined || isNaN(node.renderX) || node.renderY === undefined || isNaN(node.renderY)) {
        unassignedCount++;
        console.error(`Node ${node.id} has invalid coordinates: (${node.renderX}, ${node.renderY})`);
      }
    }
  }

  console.log(`Unassigned nodes count: ${unassignedCount}`);

  if (unassignedCount > 0) {
    console.error("Result: FAILED - Some visible nodes had invalid coordinates!");
    process.exit(1);
  } else {
    console.log("Result: PASS - All visible nodes correctly calculated and assigned coordinates!");
  }
}

// Run tests
testSpatialGridKeys();
testArrayPooling();
testLayoutCollision();

console.log("\nAll checks completed successfully!");
