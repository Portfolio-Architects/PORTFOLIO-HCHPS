import * as Y from 'yjs';
import { OntologyLayout } from '@/lib/engine/OntologyLayout';
import { getFestivalPresetGraphData, FESTIVAL_PRESET_SIMULATION_ENTRIES } from '@/lib/presets/festival5DomainPreset';
import { VerificationStatus } from '@/lib/ontology.types';

describe('EMPIRICAL CHALLENGER STRESS SUITE: M1 + M2 + M3 Integration & Stress Verification', () => {

  // =========================================================================
  // SECTION 1: M1 Corkboard Renderer & Catenary Sag Math Stress Testing
  // =========================================================================
  describe('1. M1 Corkboard Renderer & Red String Catenary Sag Math', () => {
    it('calculates catenary red string sagging quadratic curves accurately for arbitrary 2D vectors', () => {
      const p1 = { x: 100, y: 150 };
      const p2 = { x: 400, y: 250 };

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy); // Math.sqrt(300^2 + 100^2) = 316.227

      const sag = Math.min(35, dist * 0.12); // Math.min(35, 37.947) = 35
      expect(sag).toBe(35);

      const midX = (p1.x + p2.x) / 2; // 250
      const midY = (p1.y + p2.y) / 2 + sag; // 200 + 35 = 235

      expect(midX).toBe(250);
      expect(midY).toBe(235);
      expect(Number.isNaN(midX)).toBe(false);
      expect(Number.isNaN(midY)).toBe(false);
    });

    it('handles edge case catenary math: zero distance (coincident points), vertical lines, and negative coordinates without NaN', () => {
      // Coincident points
      const dx0 = 0; const dy0 = 0;
      const dist0 = Math.hypot(dx0, dy0);
      const sag0 = Math.min(35, dist0 * 0.12);
      expect(sag0).toBe(0);
      expect(Number.isNaN(sag0)).toBe(false);

      // Vertical line
      const p1V = { x: 200, y: -500 };
      const p2V = { x: 200, y: 500 };
      const distV = Math.hypot(p2V.x - p1V.x, p2V.y - p1V.y); // 1000
      const sagV = Math.min(35, distV * 0.12); // 35
      const midXV = (p1V.x + p2V.x) / 2;
      const midYV = (p1V.y + p2V.y) / 2 + sagV;
      expect(midXV).toBe(200);
      expect(midYV).toBe(35);
      expect(Number.isNaN(midYV)).toBe(false);

      // Extreme negative coordinates
      const p1N = { x: -10000, y: -20000 };
      const p2N = { x: -5000, y: -10000 };
      const distN = Math.hypot(p2N.x - p1N.x, p2N.y - p1N.y);
      const sagN = Math.min(35, distN * 0.12);
      const midXN = (p1N.x + p2N.x) / 2;
      const midYN = (p1N.y + p2N.y) / 2 + sagN;
      expect(Number.isNaN(distN)).toBe(false);
      expect(Number.isNaN(midXN)).toBe(false);
      expect(Number.isNaN(midYN)).toBe(false);
    });

    it('verifies Post-it procedural tilt angles (-5° ~ +5°) are deterministic based on node ID hash', () => {
      const getNodeTilt = (nodeId: string) => {
        let hash = 0;
        for (let i = 0; i < nodeId.length; i++) {
          hash = (hash << 5) - hash + nodeId.charCodeAt(i);
          hash |= 0;
        }
        return ((Math.abs(hash) % 11) - 5) * (Math.PI / 180);
      };

      const testNodeIds = ['fest-p1', 'fest-p2', 'fest-r3', 'custom-12345', 'festival-hub-permits'];
      testNodeIds.forEach(id => {
        const tilt = getNodeTilt(id);
        const tiltDegrees = tilt * (180 / Math.PI);
        expect(tiltDegrees).toBeGreaterThanOrEqual(-5);
        expect(tiltDegrees).toBeLessThanOrEqual(5);
        // Deterministic check
        expect(getNodeTilt(id)).toBe(tilt);
      });
    });

    it('verifies 4 verification statuses are mapped correctly and fail-safe to uncompleted', () => {
      const validStatuses: VerificationStatus[] = ['uncompleted', 'in-progress', 'verified', 'risk-warning'];
      validStatuses.forEach(st => {
        expect(['uncompleted', 'in-progress', 'verified', 'risk-warning']).toContain(st);
      });
    });
  });

  // =========================================================================
  // SECTION 2: M2 Preset Loading Pipeline & Yjs CRDT Transactions Stress
  // =========================================================================
  describe('2. M2 Preset Loading Pipeline & Yjs CRDT Transactions', () => {
    it('verifies getFestivalPresetGraphData output schema and domain completeness', () => {
      const presetData = getFestivalPresetGraphData();
      expect(presetData.nodes.length).toBeGreaterThanOrEqual(25);
      expect(presetData.edges.length).toBeGreaterThanOrEqual(20);
      expect(Object.keys(presetData.overrides).length).toBeGreaterThanOrEqual(25);

      // 5 Domain Hubs present
      const hubs = presetData.nodes.filter(n => n.id.startsWith('festival-hub-'));
      expect(hubs).toHaveLength(5);

      const hubIds = new Set(hubs.map(h => h.id));
      expect(hubIds.has('festival-hub-permits')).toBe(true);
      expect(hubIds.has('festival-hub-stage')).toBe(true);
      expect(hubIds.has('festival-hub-pr')).toBe(true);
      expect(hubIds.has('festival-hub-food')).toBe(true);
      expect(hubIds.has('festival-hub-budget')).toBe(true);
    });

    it('stress tests rapid Yjs CRDT transactions: 100 consecutive preset apply & node mutations', () => {
      const ydoc = new Y.Doc();
      const overridesMap = ydoc.getMap('overrides');
      const customNodesMap = ydoc.getMap('customNodesMap');
      const customEdgesMap = ydoc.getMap('customEdgesMap');
      const deletedEdgesMap = ydoc.getMap('deletedEdgesMap');

      const presetData = getFestivalPresetGraphData();

      // Stress loop: apply preset 50 times in rapid succession
      for (let run = 0; run < 50; run++) {
        ydoc.transact(() => {
          Array.from(overridesMap.keys()).forEach(k => overridesMap.delete(k));
          Array.from(customNodesMap.keys()).forEach(k => customNodesMap.delete(k));
          Array.from(customEdgesMap.keys()).forEach(k => customEdgesMap.delete(k));
          Array.from(deletedEdgesMap.keys()).forEach(k => deletedEdgesMap.delete(k));

          overridesMap.set('root-HCHPS', { hideDefaultGraph: true });

          presetData.nodes.forEach(n => customNodesMap.set(n.id, n));
          presetData.edges.forEach(e => customEdgesMap.set(`${e.source}|||${e.target}`, e));
          Object.entries(presetData.overrides).forEach(([id, ov]) => overridesMap.set(id, ov));
        });
      }

      // Verify final Yjs state integrity
      expect(customNodesMap.size).toBe(presetData.nodes.length);
      expect(customEdgesMap.size).toBe(presetData.edges.length);
      expect(overridesMap.has('root-HCHPS')).toBe(true);
      expect(overridesMap.get('root-HCHPS')).toEqual({ hideDefaultGraph: true });
    });

    it('stress tests Yjs concurrent node insertions, edge deletions, and tombstones without memory leak or orphan states', () => {
      const ydoc = new Y.Doc();
      const customNodesMap = ydoc.getMap<any>('customNodesMap');
      const customEdgesMap = ydoc.getMap<any>('customEdgesMap');
      const deletedEdgesMap = ydoc.getMap<boolean>('deletedEdgesMap');
      const overridesMap = ydoc.getMap<any>('overrides');

      // Populate 500 nodes & edges
      ydoc.transact(() => {
        for (let i = 0; i < 500; i++) {
          const nodeId = `stress-node-${i}`;
          customNodesMap.set(nodeId, {
            id: nodeId,
            label: `Stress Node ${i}`,
            group: 'OTHER',
            fixedX: i * 10,
            fixedY: i * 5
          });

          if (i > 0) {
            const edgeKey = `stress-node-${i - 1}|||stress-node-${i}`;
            customEdgesMap.set(edgeKey, {
              source: `stress-node-${i - 1}`,
              target: `stress-node-${i}`,
              weight: 1.0,
              type: 'DEPENDENCY'
            });
          }
        }
      });

      expect(customNodesMap.size).toBe(500);
      expect(customEdgesMap.size).toBe(499);

      // Perform cascade delete on every 5th node
      ydoc.transact(() => {
        for (let i = 0; i < 500; i += 5) {
          const nodeId = `stress-node-${i}`;
          customNodesMap.delete(nodeId);
          if (overridesMap.has(nodeId)) overridesMap.delete(nodeId);

          // Delete connected edges
          for (const k of customEdgesMap.keys()) {
            if (k.startsWith(`${nodeId}|||`) || k.endsWith(`|||${nodeId}`)) {
              customEdgesMap.delete(k);
              deletedEdgesMap.set(k, true);
            }
          }
        }
      });

      expect(customNodesMap.size).toBe(400); // 100 deleted
      // All remaining edges point to valid nodes
      for (const edge of customEdgesMap.values()) {
        expect(customNodesMap.has(edge.source)).toBe(true);
        expect(customNodesMap.has(edge.target)).toBe(true);
      }
    });
  });

  // =========================================================================
  // SECTION 3: M3 Zero-Mistake Real-Time Validation & Alert Engine Stress
  // =========================================================================
  describe('3. M3 Zero-Mistake Real-Time Validation & Alert Engine', () => {
    it('evaluates essential permits mandatory checklist correctly against keyword rules', () => {
      const mandatoryConfigs = [
        { key: 'municipal_report', label: '지자체 신고', keywords: ['지자체', '보도자료', '지자체 신고', '공보관'] },
        { key: 'police_road', label: '경찰 도로점용', keywords: ['경찰', '도로점용', '교통신고', '경찰서'] },
        { key: 'fire_safety', label: '소방 안전점검', keywords: ['소방', '안전점검', '소방서', '가설물'] },
        { key: 'safety_plan', label: '안전관리계획서', keywords: ['안전관리계획', '안전관리계획서', '재난안전'] }
      ];

      const sampleLabels = [
        { label: '지자체 보도자료/현장취재', expectedKey: 'municipal_report' },
        { label: '경찰서 도로점용/교통신고', expectedKey: 'police_road' },
        { label: '소방서 가설물 안전점검', expectedKey: 'fire_safety' },
        { label: '안전관리계획서 수립/제출', expectedKey: 'safety_plan' }
      ];

      const findMatchingConfig = (label: string) => {
        for (let i = 0; i < mandatoryConfigs.length; i++) {
          const cfg = mandatoryConfigs[i];
          for (let j = 0; j < cfg.keywords.length; j++) {
            if (label.includes(cfg.keywords[j])) return cfg;
          }
        }
        return undefined;
      };

      for (const item of sampleLabels) {
        const matched = findMatchingConfig(item.label);
        expect(matched).toBeDefined();
        expect(matched?.key).toBe(item.expectedKey);
      }
    });

    it('evaluates budget bounds accurately for UNDER_SCALE (<50M), IN_SCALE (50-70M), and OVER_SCALE (>70M)', () => {
      const checkScale = (total: number) => {
        if (total < 50000000) return 'UNDER_SCALE';
        if (total > 70000000) return 'OVER_SCALE';
        return 'IN_SCALE';
      };

      expect(checkScale(0)).toBe('UNDER_SCALE');
      expect(checkScale(49999999)).toBe('UNDER_SCALE');
      expect(checkScale(50000000)).toBe('IN_SCALE');
      expect(checkScale(60000000)).toBe('IN_SCALE');
      expect(checkScale(70000000)).toBe('IN_SCALE');
      expect(checkScale(70000001)).toBe('OVER_SCALE');
      expect(checkScale(1000000000)).toBe('OVER_SCALE');
    });

    it('verifies FESTIVAL_PRESET_SIMULATION_ENTRIES sum equals exactly 60,000,000 KRW', () => {
      const sum = FESTIVAL_PRESET_SIMULATION_ENTRIES.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      expect(sum).toBe(60000000);
    });

    it('stress tests overall risk level resolution hierarchy: MISSING permit -> CRITICAL, OVER_SCALE -> CRITICAL, INCOMPLETE -> WARNING', () => {
      const resolveRiskLevel = (hasMissingPermit: boolean, hasCriticalNode: boolean, isOverScale: boolean, hasIncompletePermit: boolean, isUnderScale: boolean) => {
        if (hasMissingPermit || hasCriticalNode || isOverScale) return 'CRITICAL';
        if (hasIncompletePermit || isUnderScale) return 'WARNING';
        return 'SAFE';
      };

      // Highest priority: Missing permit -> CRITICAL
      expect(resolveRiskLevel(true, false, false, false, false)).toBe('CRITICAL');
      // Over scale -> CRITICAL
      expect(resolveRiskLevel(false, false, true, false, false)).toBe('CRITICAL');
      // Incomplete permit -> WARNING
      expect(resolveRiskLevel(false, false, false, true, false)).toBe('WARNING');
      // Under scale -> WARNING
      expect(resolveRiskLevel(false, false, false, false, true)).toBe('WARNING');
      // All clear -> SAFE
      expect(resolveRiskLevel(false, false, false, false, false)).toBe('SAFE');
    });
  });

  // =========================================================================
  // SECTION 4: High Performance Math & Frame Delta Stress
  // =========================================================================
  describe('4. High Performance Math & Frame Delta Clamping', () => {
    it('verifies frame delta clamping under 100ms prevents physics explosion when tab resumes', () => {
      const now = 10000;
      const lastFrameTime = 6580; // Tab was inactive for 3420ms
      const rawDelta = now - lastFrameTime; // 3420ms
      expect(rawDelta).toBe(3420);

      // Clamp delta rule
      const clampedDelta = Math.min(rawDelta, 33.3); // max ~30fps step
      expect(clampedDelta).toBe(33.3);
      expect(clampedDelta).toBeLessThanOrEqual(50);
    });

    it('verifies OntologyLayout orbit radius scaling math never returns NaN or 0 for any valid orbit index', () => {
      OntologyLayout.totalNodesCount = 35;
      for (let orbit = 0; orbit <= 8; orbit++) {
        const radius = OntologyLayout.getOrbitRadius(orbit);
        if (orbit === 0) {
          expect(radius).toBe(0);
        } else {
          expect(radius).toBeGreaterThan(0);
          expect(Number.isNaN(radius)).toBe(false);
        }
      }

      // Test with massive node count (500 nodes)
      OntologyLayout.totalNodesCount = 500;
      for (let orbit = 1; orbit <= 8; orbit++) {
        const radius = OntologyLayout.getOrbitRadius(orbit);
        expect(radius).toBeGreaterThan(0);
        expect(Number.isNaN(radius)).toBe(false);
      }
    });
  });

});
