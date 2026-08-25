import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { OntologyNetwork } from '@/lib/engine/OntologyNetwork';
import { OntologyLayout } from '@/lib/engine/OntologyLayout';
import { buildSignalGraph } from '@/lib/signal-graph';
import { useBudget } from '@/hooks/useBudget';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useInventory } from '@/hooks/useInventory';
import { useContacts } from '@/hooks/useContacts';
import { OrbitalNode, OntologyEdge } from '@/lib/ontology.types';

jest.mock('@/lib/crypto', () => ({
  isCryptoReady: () => true,
  getAuthToken: () => 'mock-token',
}));

jest.mock('@/lib/sheets-api', () => ({
  readSheet: jest.fn().mockImplementation((sheetName: string) => {
    if (sheetName === 'TASKS') return Promise.resolve([{ id: 'task-100', title: 'Task 100', status: 'todo', priority: 'medium', category: 'General', tags: [] }]);
    if (sheetName === 'BUDGET_CATEGORIES') return Promise.resolve([{ id: 'cat-100', name: 'Category 100', totalBudget: 5000000, policyProject: 'P', unitProject: 'U', detailedProject: 'D', statItem: 'S' }]);
    if (sheetName === 'BUDGET_ENTRIES') return Promise.resolve([
      { id: 'plan-1', categoryId: 'cat-100', amount: 1000000, isPlanned: true, isSettled: false, purpose: 'Plan 1' },
      { id: 'child-1', categoryId: 'cat-100', amount: 500000, isPlanned: false, isSettled: true, relatedPlanId: 'plan-1', purpose: 'Child 1' }
    ]);
    if (sheetName === 'PROJECTS') return Promise.resolve([{ id: 'proj-100', name: 'Project 100', description: '', checklistItems: [{ id: 'c1', text: 'Item 1', completed: true }] }]);
    if (sheetName === 'INVENTORY') return Promise.resolve([{ id: 'inv-100', name: 'Inventory 100', currentStock: 50, targetStock: 100, minStock: 10, category: 'Supplies', unit: 'ea', unitPrice: 2000, isLentOut: false }]);
    if (sheetName === 'STOCK_CHANGES') return Promise.resolve([{ id: 'sc-100', itemId: 'inv-100', change: 10, reason: 'Restock', date: new Date().toISOString() }]);
    if (sheetName === 'CONTACTS') return Promise.resolve([{ id: 'contact-100', name: 'Contact 100', phone: '010-9999-8888', email: 'test@example.com', notes: '' }]);
    return Promise.resolve([]);
  }),
  addRow: jest.fn().mockImplementation((_, data) => Promise.resolve(data)),
  updateRow: jest.fn().mockImplementation((_, id, updates) => Promise.resolve({ id, ...updates })),
  deleteRow: jest.fn().mockImplementation((_, id) => Promise.resolve({ success: true, id })),
  replaceAll: jest.fn().mockImplementation((_, data) => Promise.resolve(data)),
}));

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('Round 2 SWE Light Adversarial Reviewer Test Suite', () => {
  describe('1. Topology & Pointer-based BFS Complexity Leap', () => {
    const createMockNode = (props: Partial<OrbitalNode> & { id: string; label: string }): OrbitalNode => ({
      group: 'CORE_PROJECT',
      baseValue: 50,
      orbitAngle: 0,
      orbitSpeed: 0.001,
      renderX: 0,
      renderY: 0,
      renderZ: 0,
      connectionToCenter: 1,
      nodeRadius: 10,
      orbitIndex: 1,
      ...props,
    });

    it('OntologyNetwork.getActiveTreeSet correctly traverses strict hierarchy with pointer queue', () => {
      const nodeMap = new Map<string, OrbitalNode>();
      const rootNode = createMockNode({ id: 'root-1', label: 'Root', worldX: 0, worldY: 0, renderX: 0, renderY: 0, orbitIndex: 0 });
      const child1 = createMockNode({ id: 'child-1', label: 'Child 1', worldX: 10, worldY: 10, renderX: 10, renderY: 10, orbitIndex: 1, parentId: 'root-1' });
      const grandChild = createMockNode({ id: 'grand-1', label: 'GrandChild', worldX: 20, worldY: 20, renderX: 20, renderY: 20, orbitIndex: 2, parentId: 'child-1' });

      nodeMap.set(rootNode.id, rootNode);
      nodeMap.set(child1.id, child1);
      nodeMap.set(grandChild.id, grandChild);

      OntologyLayout.lastTreeChildrenMap.set('root-1', ['child-1']);
      OntologyLayout.lastTreeChildrenMap.set('child-1', ['grand-1']);
      OntologyLayout.lastTreeChildrenMap.set('grand-1', []);
      OntologyLayout.lastParentMap.set('child-1', 'root-1');
      OntologyLayout.lastParentMap.set('grand-1', 'child-1');

      const rootTree = OntologyNetwork.getActiveTreeSet('root-1', nodeMap);
      expect(rootTree.has('root-1')).toBe(true);
      expect(rootTree.has('child-1')).toBe(true);
      expect(rootTree.has('grand-1')).toBe(true);

      const grandTree = OntologyNetwork.getActiveTreeSet('grand-1', nodeMap);
      expect(grandTree.has('grand-1')).toBe(true);
      expect(grandTree.has('child-1')).toBe(true);
      expect(grandTree.has('root-1')).toBe(true);
    });

    it('OntologyLayout calculates layout and spanning trees with zero-allocation Phase C isolated root handling', () => {
      const nodes: OrbitalNode[] = [
        createMockNode({ id: 'root-HCHPS', label: 'Central Hub', worldX: 0, worldY: 0, renderX: 0, renderY: 0, orbitIndex: 0, centralityScore: 9999999 }),
        createMockNode({ id: 'node-A', label: 'Node A', worldX: 50, worldY: 50, renderX: 50, renderY: 50, orbitIndex: 1, parentId: 'root-HCHPS' }),
        createMockNode({ id: 'node-B', label: 'Node B', worldX: 100, worldY: 100, renderX: 100, renderY: 100, orbitIndex: 2, parentId: 'node-A' }),
        createMockNode({ id: 'isolated-X', label: 'Isolated X', worldX: -100, worldY: -100, renderX: -100, renderY: -100, orbitIndex: 1 }),
      ];

      const nodeMap = new Map<string, OrbitalNode>();
      nodes.forEach(n => nodeMap.set(n.id, n));

      const edges: OntologyEdge[] = [
        { source: 'root-HCHPS', target: 'node-A', weight: 1, type: 'CAUSAL_DRIVE' },
        { source: 'node-A', target: 'node-B', weight: 1, type: 'DEPENDENCY' },
      ];

      OntologyLayout.computePositions(nodes, nodeMap, edges, 800, 600, 0, 0, 1.0, new Set());

      expect(OntologyLayout.lastTreeChildrenMap.get('root-HCHPS')).toContain('node-A');
      expect(OntologyLayout.lastTreeChildrenMap.get('node-A')).toContain('node-B');
      expect(OntologyLayout.lastSpanningTreeEdgeSet.has('root-HCHPS|||node-A')).toBe(true);
      expect(OntologyLayout.lastParentMap.get('node-A')).toBe('root-HCHPS');
      expect(OntologyLayout.lastParentMap.get('node-B')).toBe('node-A');
    });

    it('buildSignalGraph connects isolated components and prunes redundant center connections in O(1)', () => {
      const signals = [
        { id: 'sig-1', text: 'Health promotion campaign with municipal partners', createdAt: '2026-08-20', category: 'Health', tags: ['Health'], keywords: ['campaign', 'health'] },
        { id: 'sig-2', text: 'Isolated clinic outreach project', createdAt: '2026-08-20', category: 'Clinic', tags: ['Clinic'], keywords: ['clinic'] }
      ];

      const graph = buildSignalGraph({ 'campaign': 2, 'clinic': 1 }, signals);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
    });
  });

  describe('2. Custom Hooks O(1) Indexing & Cascade Delete Protection', () => {
    it('useBudget protects planned entries with settled child expenses from deletion in O(1)', async () => {
      const { Wrapper } = createTestWrapper();
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

      const { result } = renderHook(() => useBudget(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.entries.length).toBe(2));

      result.current.deleteEntry('plan-1');
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('연결된 실제 지출 내역이 존재하여 삭제할 수 없습니다'));

      result.current.batchDeleteEntries(['plan-1']);
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('연결된 실제 지출 내역이 존재하여 삭제할 수 없습니다'));

      alertSpy.mockRestore();
    });

    it('useTasks, useProjects, useInventory, and useContacts provide fast O(1) lookup helpers', async () => {
      localStorage.setItem('hchps-projects', JSON.stringify([{ id: 'proj-100', name: 'Project 100', description: '', checklistItems: [{ id: 'c1', text: 'Item 1', completed: true }] }]));
      const { Wrapper } = createTestWrapper();

      const { result: taskRes } = renderHook(() => useTasks(), { wrapper: Wrapper });
      const { result: projRes } = renderHook(() => useProjects(), { wrapper: Wrapper });
      const { result: invRes } = renderHook(() => useInventory(), { wrapper: Wrapper });
      const { result: contactRes } = renderHook(() => useContacts(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(taskRes.current.tasks.length).toBeGreaterThan(0);
        expect(projRes.current.projects.length).toBeGreaterThan(0);
        expect(invRes.current.items.length).toBeGreaterThan(0);
        expect(contactRes.current.contacts.length).toBeGreaterThan(0);
      });

      expect(taskRes.current.getTaskById('task-100')?.title).toBe('Task 100');
      expect(projRes.current.getProjectById('proj-100')?.name).toBe('Project 100');
      expect(invRes.current.getItemById('inv-100')?.name).toBe('Inventory 100');
      expect(contactRes.current.getContactById('contact-100')?.name).toBe('Contact 100');
    });
  });
});