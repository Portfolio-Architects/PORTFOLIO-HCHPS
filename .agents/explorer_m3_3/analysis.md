# Analysis: Manual Node/Edge CRUD UI with Yjs Sync Strategy

This report details the read-only investigation and design strategy to implement a manual CRUD UI for nodes and edges inside `MindMapInspector.tsx` with Yjs real-time synchronization via `useGraphCustomization.ts`.

---

## 1. Yjs Hook Update (`useGraphCustomization.ts`)

### Current State
`addCustomNode` currently has the following signature and implementation:
```typescript
  const addCustomNode = useCallback((label: string, x: number, y: number, color?: string) => {
    const newNode: OntologyNode = {
      id: `custom-${Date.now()}`,
      label,
      group: 'OTHER',
      baseValue: 80,
      fixedX: x,
      fixedY: y,
      customColor: color,
      centralityScore: 100,
    };
    (ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>).set(newNode.id, newNode);
    return newNode;
  }, [ydoc]);
```

### Proposed Update
To allow storing `group`, `baseValue`, and `layerId` directly in the custom node payload on creation, we modify the hook's imports and the `addCustomNode` callback as follows:

**Imports modification:**
```typescript
import { OntologyNode, OntologyEdge, EdgeType, OntologyGroup, OntologyLayerId } from '@/lib/ontology.types';
```

**Callback modification:**
```typescript
  const addCustomNode = useCallback((
    label: string, 
    x: number, 
    y: number, 
    color?: string,
    group?: OntologyGroup,
    baseValue?: number,
    layerId?: OntologyLayerId
  ) => {
    const newNode: OntologyNode = {
      id: `custom-${Date.now()}`,
      label,
      group: group || 'OTHER',
      baseValue: typeof baseValue === 'number' ? baseValue : 80,
      fixedX: x,
      fixedY: y,
      customColor: color,
      layerId: layerId !== undefined ? layerId : undefined,
      centralityScore: 100,
    };
    (ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>).set(newNode.id, newNode);
    return newNode;
  }, [ydoc]);
```

### Yjs Data Compatibility
- **CRDT Map Behavior**: Yjs maps serialize arbitrary JSON-compatible javascript objects. The new keys (`group`, `baseValue`, `layerId`) will be seamlessly stored in the shared `customNodesMap` map.
- **RAG/Zod Schemas**: Since `getDomainSchema('MAP_CUSTOMIZATION')` returns `z.any()` (fallback in `src/lib/schemas.ts`), adding these fields will not trigger Zod schemas validation errors, while complying fully with the runtime `OntologyNode` interface.

---

## 2. Node Creation Form UI (`MindMapInspector.tsx`)

When no active node is selected (`activeNode === null`), the inspector sidebar should display a form card for creating new nodes.

### Component State (Local Hooks)
We introduce standard React state hooks in `MindMapInspector`:
```typescript
  const [newNodeLabel, setNewNodeLabel] = React.useState('');
  const [newNodeGroup, setNewNodeGroup] = React.useState<OntologyGroup>('OTHER');
  const [newNodeBaseValue, setNewNodeBaseValue] = React.useState(80);
  const [newNodeLayerId, setNewNodeLayerId] = React.useState<OntologyLayerId>(2);
```

### Form Layout & UI Elements
The form will be styled with Tailwind CSS to match the existing glassmorphism panels:
- **Label**: TextInput with placeholder.
- **Group selection**: Dropdown selector using the keys/values of `GROUP_LABELS` (imported from `@/lib/ontology.types`).
- **Importance (baseValue)**: Range slider mapping values 0–100, displaying the current value.
- **Layer selection**: Dropdown selector mapping numbers 0–3 to values from `LAYER_LABELS` (e.g. 0: Agent, 1: Resource, 2: Execution, 3: Knowledge).
- **Submit Button**: Active only when `trimmedLabel` is not empty. When clicked, it calls the `handleCreateCustomNode` action.

### Proposed Code Block (inside `renderNodeDetails` when `activeNode` is null)
```tsx
{/* 🆕 새 노드 수동 추가 폼 */}
<div className="mb-4 p-4 bg-slate-500/5 border border-slate-200/40 rounded-2xl shadow-2xs flex flex-col gap-3">
  <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
    <PlusCircle size={12} className="text-indigo-500" />
    새 노드 수동 추가
  </div>
  <div className="flex flex-col gap-2.5 text-xs">
    {/* 1. Label */}
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold text-slate-400">노드 이름 (Label)</label>
      <input
        type="text"
        placeholder="노드 라벨 입력..."
        value={newNodeLabel}
        onChange={(e) => setNewNodeLabel(e.target.value)}
        className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:text-slate-200 font-medium"
      />
    </div>

    {/* 2. Group */}
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold text-slate-400">그룹 (Group)</label>
      <select
        value={newNodeGroup}
        onChange={(e) => setNewNodeGroup(e.target.value as OntologyGroup)}
        className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:text-slate-200 font-medium cursor-pointer"
      >
        {Object.entries(GROUP_LABELS).map(([key, value]) => (
          <option key={key} value={key}>{value} ({key})</option>
        ))}
      </select>
    </div>

    {/* 3. Importance / baseValue */}
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <label className="text-[9px] font-bold text-slate-400">중요도 (Importance)</label>
        <span className="text-[10px] font-bold text-indigo-600">{newNodeBaseValue}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={newNodeBaseValue}
        onChange={(e) => setNewNodeBaseValue(Number(e.target.value))}
        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
    </div>

    {/* 4. Layer */}
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold text-slate-400">계층 (Layer)</label>
      <select
        value={newNodeLayerId}
        onChange={(e) => setNewNodeLayerId(Number(e.target.value) as OntologyLayerId)}
        className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:text-slate-200 font-medium cursor-pointer"
      >
        {Object.entries(LAYER_LABELS).map(([key, value]) => (
          <option key={key} value={key}>{value} (Layer {key})</option>
        ))}
      </select>
    </div>

    {/* Submit */}
    <button
      onClick={handleCreateCustomNode}
      disabled={!newNodeLabel.trim()}
      className="mt-1 w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-[11px] cursor-pointer transition-all shadow-3xs flex items-center justify-center gap-1"
    >
      <Plus size={13} />
      노드 생성
    </button>
  </div>
</div>
```

---

## 3. Edge CRUD Form & Connection List UI (`MindMapInspector.tsx`)

When an active node is selected (`activeNode !== null`), the inspector panel should allow manual edge creation and review/deletion of all connected incoming/outgoing links.

### Component State (Local Hooks)
We introduce standard React state hooks to handle the edge creation fields:
```typescript
  const [newEdgeTargetId, setNewEdgeTargetId] = React.useState('');
  const [newEdgeType, setNewEdgeType] = React.useState<EdgeType>('DEPENDENCY');
  const [newEdgeWeight, setNewEdgeWeight] = React.useState(1.0);
```

### Form Elements:
- **Target Node Dropdown**: Selects from `engineNodes` list, excluding the current `activeNode` and `'root-HCHPS'`. Sorts options alphabetically by label.
- **Relationship Type**: Dropdown list of keys/values in `EDGE_TYPE_LABELS`.
- **Weight**: Slider for values -1.0 to 1.0 (step 0.1), showcasing negative/positive bounds.
- **Action Button**: Calls `handleCreateCustomEdge` on click.

### Connection List with Incoming/Outgoing Classification:
We map directly over the `connectedEdges` list retrieved from `engineRef.current.getConnectedEdges(activeNode.id)`. By comparing `edge.source === activeNode.id`, we classify direction:
- **Outgoing (→)**: Direct dependencies / paths starting from the active node.
- **Incoming (←)**: Dependency paths coming from other nodes to the active node.
Each element is listed with the target node's label, type (via `EDGE_TYPE_LABELS`), weight, and a trash bin delete button to clear it.

### Proposed Code Block (inside `renderNodeDetails` when `activeNode` is selected, in place of the old section)
```tsx
{/* 🔗 수동 관계 연결 (Edge Creation) */}
<div className="flex flex-col gap-1.5 bg-gradient-to-br from-slate-500/5 to-indigo-500/5 border border-indigo-500/10 p-3.5 rounded-2xl shadow-2xs">
  <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
    <Link2 size={13} className="text-indigo-500" /> 수동 관계 연결 (Edge CRUD)
  </label>
  <p className="text-[9px] text-slate-500 font-bold leading-tight mb-1.5">
    선택한 타겟 노드와의 연결(간선)을 수동으로 생성하고 가중치를 지정합니다.
  </p>
  <div className="flex flex-col gap-2 w-full text-xs">
    {/* Target Node Dropdown */}
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold text-slate-400">대상 노드 선택</label>
      <select
        value={newEdgeTargetId}
        onChange={(e) => setNewEdgeTargetId(e.target.value)}
        className="w-full min-w-0 text-[10.5px] px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:text-slate-200 font-medium cursor-pointer"
      >
        <option value="">-- 대상 노드 선택 --</option>
        {engineNodes
          .filter(n => n.id !== activeNode.id && n.id !== 'root-HCHPS' && !n.layoutHidden)
          .sort((a, b) => a.label.localeCompare(b.label))
          .map(n => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))
        }
      </select>
    </div>

    {/* Relationship Type Dropdown */}
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold text-slate-400">관계 유형</label>
      <select
        value={newEdgeType}
        onChange={(e) => setNewEdgeType(e.target.value as EdgeType)}
        className="w-full min-w-0 text-[10.5px] px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:text-slate-200 font-medium cursor-pointer"
      >
        {Object.entries(EDGE_TYPE_LABELS).map(([key, value]) => (
          <option key={key} value={key}>{value} ({key})</option>
        ))}
      </select>
    </div>

    {/* Weight Slider */}
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <label className="text-[9px] font-bold text-slate-400">가중치 (Weight)</label>
        <span className="text-[10px] font-bold text-indigo-600">{newEdgeWeight.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min="-1.0"
        max="1.0"
        step="0.1"
        value={newEdgeWeight}
        onChange={(e) => setNewEdgeWeight(Number(e.target.value))}
        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
    </div>

    {/* Add Button */}
    <button
      disabled={!newEdgeTargetId}
      onClick={handleCreateCustomEdge}
      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-[10.5px] cursor-pointer transition-all shadow-3xs flex items-center justify-center gap-1"
    >
      <Plus size={13} />
      관계 추가
    </button>
  </div>
</div>

{/* 🛠️ 연결 목록 및 삭제 */}
<div className="flex flex-col gap-1.5 bg-slate-500/5 border border-slate-200/40 rounded-2xl p-3 shadow-2xs">
  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">연결 목록 (Incoming / Outgoing)</label>
  {connectedEdges.length === 0 ? (
    <div className="text-[10.5px] font-semibold text-slate-400 text-center py-2">
      연결된 노드가 없습니다.
    </div>
  ) : (
    <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
      {connectedEdges.map(({ edge, otherNode }) => {
        const isOutgoing = edge.source === activeNode.id;
        const directionSymbol = isOutgoing ? '→' : '←';
        const typeLabel = EDGE_TYPE_LABELS[edge.type] || edge.type;
        
        return (
          <div key={`${edge.source}|||${edge.target}|||${edge.type}`} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-850">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold truncate text-slate-700 dark:text-slate-350">
                {directionSymbol} {otherNode.label}
              </span>
              <span className="text-[9px] font-semibold text-slate-400">
                {typeLabel} (가중치: {edge.weight.toFixed(1)})
              </span>
            </div>
            <button
              onClick={() => {
                if (confirm(`'${activeNode.label}'와(과) '${otherNode.label}'의 연결을 해제하시겠습니까?`)) {
                  deleteCustomEdge(edge.source, edge.target);
                  setTimeout(() => {
                    initEngine();
                    if (engineRef.current) {
                      const updatedActive = engineRef.current.getNodeById ? engineRef.current.getNodeById(activeNode.id) : null;
                      if (updatedActive) {
                        setActiveNode(updatedActive);
                      }
                    }
                  }, 50);
                }
              }}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer shrink-0"
              title="연결 해제"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
    </div>
  )}
</div>
```

---

## 4. Props Wiring & Integration Flow

### Props Changes in `MindMapInspector.tsx`
We append `addCustomNode` and update `addCustomEdge` in the props definition:
```typescript
interface MindMapInspectorProps {
  // ... existing props
  addCustomNode: (
    label: string, 
    x: number, 
    y: number, 
    color?: string,
    group?: OntologyGroup,
    baseValue?: number,
    layerId?: OntologyLayerId
  ) => OrbitalNode;
  addCustomEdge: (src: string, tgt: string, type: EdgeType, weight: number) => void;
  // ... remaining props
}
```

### Instantiation in `MindMap3D.tsx`
We pass `addCustomNode` and ensure `addCustomEdge` is passed to the inspector component:
```tsx
            <MindMapInspector
              // ... existing props
              addCustomNode={addCustomNode}
              addCustomEdge={addCustomEdge}
              // ... remaining props
            />
```

---

## 5. Yjs Sync and Layout Dirty Flag Lifecycle

Real-time canvas updates follow a unidirectional reactive cycle:
1. **User Mutates State**: The user completes a Node/Edge creation form, calling `addCustomNode` or `addCustomEdge`.
2. **Yjs CRDT Update**: The hook makes changes within a Yjs transaction:
   `ydoc.transact(() => { (ydoc.getMap('customNodesMap')).set(id, node); })`
3. **Reactive Store Propagation**: The Yjs update triggers `store.subscribe` listeners.
4. **React Component Re-render**: `useSyncExternalStore` schedules a render of the parent `MindMap3D.tsx` component with new length values for `customNodes` and `customEdges`.
5. **Re-Layout Trigger**: A `useEffect` in `MindMap3D.tsx` detects changes in list sizes or topological configurations compared to `prevDataLengths.current`:
   `customNodes.length !== prevDataLengths.current.nodes`
   It updates the lengths cache and triggers `initEngine()`.
6. **Canvas Engine Initialization**: `initEngine` creates a new `OntologyCanvasEngine`, backing up camera offsets and collapsed state, and executes `engine.init(graph, ...)`.
7. **Flagging Layout Dirty**: Inside the engine's `init()` method, the layout dirty flags are set:
   ```typescript
   this.layoutWorldGeometryDirty = true;
   this.topologyDirty = true;
   this.isTopologyDirty = true;
   ```
8. **Physics Solver Sweep**: On subsequent canvas frames, the 2D physics solver and radial orbit calculations re-run, seamlessly positioning new nodes/edges relative to their parent groups and layer boundaries.
