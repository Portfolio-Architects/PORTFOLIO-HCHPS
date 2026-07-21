import { OntologyLayout } from '@/lib/engine/OntologyLayout';
import { OrbitalNode, OntologyEdge } from '@/lib/ontology.types';

describe('3D Mindmap Optimization and Verification Tests', () => {
  beforeAll(() => {
    // Mock performance if not defined in jsdom
    if (typeof (global as any).performance === 'undefined') {
      (global as any).performance = {
        now: () => Date.now(),
      };
    }
  });

  describe('Spatial Grid Key Collisions', () => {
    it('should not have key collisions in key scheme B (r << 16 | c & 0xFFFF)', () => {
      const keys = new Set<number>();
      let collisions = 0;
      const minCell = -200;
      const maxCell = 200; // sufficiently large for realistic coordinates (-24,000px to 24,000px)

      for (let r = minCell; r <= maxCell; r++) {
        for (let c = minCell; c <= maxCell; c++) {
          const key = (r << 16) | (c & 0xFFFF);
          if (keys.has(key)) {
            collisions++;
          }
          keys.add(key);
        }
      }

      expect(collisions).toBe(0);
    });

    it('should not have key collisions in key scheme A ((r + 32768) << 16 | c + 32768)', () => {
      const keys = new Set<number>();
      let collisions = 0;
      const minCell = -200;
      const maxCell = 200;

      for (let r = minCell; r <= maxCell; r++) {
        for (let c = minCell; c <= maxCell; c++) {
          const key = ((r + 32768) << 16) | (c + 32768);
          if (keys.has(key)) {
            collisions++;
          }
          keys.add(key);
        }
      }

      expect(collisions).toBe(0);
    });
  });

  describe('Array Pooling (cellArrayPool)', () => {
    it('should correctly reuse allocated arrays without growing on successive frames', () => {
      const gridCellSize = 120;
      const spatialGrid = new Map<number, Array<{x1: number, y1: number, x2: number, y2: number}>>();
      const cellArrayPool: Array<Array<{x1: number, y1: number, x2: number, y2: number}>> = [];
      let cellArrayPoolUsed = 0;

      function addBoxToGrid(box: {x1: number, y1: number, x2: number, y2: number}) {
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
                arr.length = 0;
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

      // Generate 500 boxes
      const boxes = [];
      for (let i = 0; i < 500; i++) {
        const x = (Math.sin(i) * 2000) + 2000;
        const y = (Math.cos(i) * 2000) + 2000;
        boxes.push({
          x1: x - 30,
          y1: y - 10,
          x2: x + 30,
          y2: y + 10,
        });
      }

      // First run: populate grid
      boxes.forEach(addBoxToGrid);
      const poolSizeAfterFirstRun = cellArrayPool.length;
      expect(poolSizeAfterFirstRun).toBeGreaterThan(0);

      // Reset for next frame
      spatialGrid.clear();
      cellArrayPoolUsed = 0;

      // Second run: reuse grid
      boxes.forEach(addBoxToGrid);
      const poolSizeAfterSecondRun = cellArrayPool.length;

      expect(poolSizeAfterSecondRun).toBe(poolSizeAfterFirstRun);
    });
  });

  describe('Layout Collision (computePositions)', () => {
    it('should correctly assign coordinates and group nodes under load without errors', () => {
      const nodes: OrbitalNode[] = [];
      const nodeMap = new Map<string, OrbitalNode>();
      const edges: OntologyEdge[] = [];

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

      // Add category and task nodes
      for (let i = 0; i < 5; i++) {
        const cat1Id = `cat1-${i}`;
        const catNode: OrbitalNode = {
          id: cat1Id,
          label: `Category ${i}`,
          parentId: root.id,
          renderX: 0,
          renderY: 0,
          nodeRadius: 12,
          group: 'SYSTEM_RISK',
          baseValue: 80,
          orbitIndex: 1,
          orbitAngle: 0,
          orbitSpeed: 0,
          renderZ: 0,
          connectionToCenter: 0
        };
        nodes.push(catNode);
        nodeMap.set(cat1Id, catNode);
        edges.push({ source: root.id, target: cat1Id, type: 'CAUSAL_DRIVE', weight: 1 });

        for (let j = 0; j < 10; j++) {
          const taskId = `task-${i}-${j}`;
          const taskNode: OrbitalNode = {
            id: taskId,
            label: `Task ${i}-${j}`,
            parentId: cat1Id,
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
          nodes.push(taskNode);
          nodeMap.set(taskId, taskNode);
          edges.push({ source: cat1Id, target: taskId, type: 'DEPENDENCY', weight: 1 });
        }
      }

      // Execute computePositions
      expect(() => {
        OntologyLayout.computePositions(
          nodes,
          nodeMap,
          edges,
          1920,
          1080,
          0,
          0,
          1.0,
          new Set(),
          new Set([0, 1, 2, 3]),
          true, // isInteractive
          true, // recomputeWorldPositions
          false, // isOrbiting
          false // isDragging
        );
      }).not.toThrow();

      // Check coordinates assigned
      nodes.forEach(node => {
        if (!node.layoutHidden) {
          expect(node.renderX).not.toBeUndefined();
          expect(node.renderY).not.toBeUndefined();
          expect(isNaN(node.renderX)).toBe(false);
          expect(isNaN(node.renderY)).toBe(false);
        }
      });
    });
  });
});
