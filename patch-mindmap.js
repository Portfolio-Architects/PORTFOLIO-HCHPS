const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'MindMap3D.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports
content = content.replace(
  `import { OntologyCanvasEngine, OrbitalNode } from '../lib/OntologyCanvasEngine';`,
  `import { OrbitalNode } from '../lib/OntologyCanvasEngine';
import DynamicForceGraph from './DynamicForceGraph';
import { drawNode, drawEdge, GROUP_COLORS, GROUP_LABELS } from '../lib/forceGraphRenderer';
import * as d3 from 'd3-force';`
);

// 2. State replacements
const stateBlock = `  const animationRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OntologyCanvasEngine | null>(null);`;
const newStateBlock = `  const fgRef = useRef<any>();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  // Store nodeMap for fast lookups
  const nodeMapRef = useRef(new Map());`;
content = content.replace(stateBlock, newStateBlock);

// 3. activeTreeSet helper
const helperToInsert = `  // ── Helpers ──
  const getConnectedEdges = useCallback((nodeId: string) => {
    return graphData.links.filter((l: any) => 
      (l.source.id === nodeId || l.source === nodeId) || 
      (l.target.id === nodeId || l.target === nodeId)
    ).map((l: any) => {
      const otherNode = (l.source.id || l.source) === nodeId ? l.target : l.source;
      return { edge: l, otherNode: typeof otherNode === 'object' ? otherNode : nodeMapRef.current.get(otherNode) };
    });
  }, [graphData]);

  const getActiveTreeSet = useCallback(() => {
    const set = new Set<string>();
    if (!activeNode) return set;
    set.add(activeNode.id);
    
    // 1-hop BFS
    graphData.links.forEach((l: any) => {
      const sid = l.source.id || l.source;
      const tid = l.target.id || l.target;
      if (sid === activeNode.id) set.add(tid);
      if (tid === activeNode.id) set.add(sid);
    });
    return set;
  }, [activeNode, graphData]);`;
content = content.replace(`// ── Keyboard Shortcuts (Undo/Redo) ──`, helperToInsert + '\n\n  // ── Keyboard Shortcuts (Undo/Redo) ──');


// 4. Clean initEngine loop entirely
const initRegex = /\/\/ ── Init Engine \(stable — deferred callbacks\) ──[\s\S]*?(?=\/\/ ── Animation Loop ──)/;
content = content.replace(initRegex, `// ── Init Engine (D3 Data Builder) ──
  const initEngine = useCallback(() => {
    setLoading(true);
    try {
      const graph = buildSignalGraph(signalKeywordsRef.current, signalEntriesRef.current, {
        overrides: overridesRef.current,
        customNodes: customNodesRef.current,
        customEdges: customEdgesRef.current,
      });
      setUsingSample(Object.keys(signalKeywordsRef.current).length === 0);

      // Pre-calculate colors and pass them
      const nodes = Array.from(graph.nodeMap.values()).map(n => {
        // Find links to calculate bridge colors
        let colors = new Set<string>();
        if (n.orbitIndex === 0) {
           colors.add(n.customColor || GROUP_COLORS[n.group] || GROUP_COLORS.OTHER);
        } else {
           colors.add(n.customColor || GROUP_COLORS[n.group] || GROUP_COLORS.OTHER);
           // Simple cross-link coloring
           graph.edges.forEach(e => {
             const sid = typeof e.source === 'object' ? (e.source as any).id : e.source;
             const tid = typeof e.target === 'object' ? (e.target as any).id : e.target;
             if (sid === n.id || tid === n.id) {
               const neighborId = sid === n.id ? tid : sid;
               const neigh = graph.nodeMap.get(neighborId);
               if (neigh && neigh.orbitIndex > 0 && neigh.orbitIndex <= n.orbitIndex) {
                 colors.add(neigh.customColor || GROUP_COLORS[neigh.group] || GROUP_COLORS.OTHER);
               }
             }
           });
        }
        return {
          ...n,
          calculatedColors: Array.from(colors)
        };
      });

      const links = graph.edges.map(e => ({
        ...e,
        source: typeof e.source === 'object' ? (e.source as any).id : e.source,
        target: typeof e.target === 'object' ? (e.target as any).id : e.target
      }));

      nodeMapRef.current = graph.nodeMap;
      setStats({ nodes: nodes.length, edges: links.length });
      setGraphData({ nodes, links });
      
      // Auto-update connected edges if active
      if (activeNode) {
        // getConnectedEdges relies on latest data, which is delayed by setState.
      } else {
        const center = nodes.find(n => n.orbitIndex === 0);
        if (center) setActiveNode(center as any);
      }
      
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeNode]);\n\n  `);

// 5. Replace animation loop and observers
const animRegex = /\/\/ ── Animation Loop ──[\s\S]*?(?=\/\/ ── Interaction ──)/;
content = content.replace(animRegex, `// ── D3 Force Configuration (Concentric Rings) ──
  useEffect(() => {
    initEngine();
  }, [initEngine]);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      const fg = fgRef.current;
      fg.d3Force('charge', d3.forceManyBody().strength(-300));
      fg.d3Force('collide', d3.forceCollide().radius(35).iterations(2));
      fg.d3Force('link', d3.forceLink().distance(60).strength(0.3));
      
      // Custom Radial Force for Concentric Hierarchy
      fg.d3Force('radial', d3.forceRadial(
        (node: any) => {
          if (node.orbitIndex === 0) return 0;
          if (node.orbitIndex === 1) return 300;
          if (node.orbitIndex === 2) return 550;
          if (node.orbitIndex === 3) return 800;
          return 1000;
        },
        0, // cx
        0  // cy
      ).strength((d: any) => d.orbitIndex === 0 ? 1.0 : 0.8)); // Stronger pull toward orbit
      
      // Re-heat simulation to jump into layout
      fg.d3ReheatSimulation();
    }
  }, [graphData]);\n\n  `);

// 6. Delete old interaction block (handleDrag... hitTest...)
const intRegex = /\/\/ ── Interaction ──[\s\S]*?(?=\/\/ ── Render Helpers ──)/;
content = content.replace(intRegex, `\n\n`);

// 7. Inject graphData side effect for activeNode edges panel
content = content.replace(
  `{/* ── Side Panel (Node Details) ── */}`,
  `{/* ── Side Panel (Node Details) ── */}
  {useEffect(() => {
     if (activeNode) setConnectedEdges(getConnectedEdges(activeNode.id));
   }, [activeNode, graphData])}
        `
);

// 8. Replace DOM Canvas with DynamicForceGraph
const canvasRegex = /<canvas[\s\S]*?onTouchEnd=\{handleTouchEnd\}\s*\/>/;
const newForceGraph = `<DynamicForceGraph
            ref={fgRef}
            graphData={graphData}
            nodeId="id"
            nodeRelSize={16}
            linkColor={() => 'rgba(0,0,0,0)'} // Hidden baseline links
            linkWidth={0}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => 
               drawNode(node, ctx, globalScale, getActiveTreeSet(), activeNode?.id || null, hoveredNode?.id || null)
            }
            linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => 
               drawEdge(link, ctx, globalScale, getActiveTreeSet(), activeNode?.id || null)
            }
            onNodeClick={(node: any) => {
               if (edgeModeSource) {
                 setNodeOverride(node.id, { customParent: edgeModeSource });
                 setEdgeModeSource(null);
                 setTimeout(() => initEngine(), 50);
                 return;
               }
               setActiveNode(node);
               setShow5W1H(true);
               // center camera
               if (fgRef.current) {
                 fgRef.current.centerAt(node.x, node.y, 800);
                 fgRef.current.zoom(1.8, 800);
               }
            }}
            onNodeHover={(node: any) => setHoveredNode(node)}
            cooldownTicks={150} // Let it settle, then freeze to save CPU
            backgroundColor="#f8f9fc"
            enableNodeDrag={true}
            onNodeDragEnd={(node: any) => {
               node.fx = node.x;
               node.fy = node.y;
            }}
          />`;
content = content.replace(canvasRegex, newForceGraph);

fs.writeFileSync(filePath, content, 'utf8');
console.log('MindMap3D.tsx successfully refactored for react-force-graph-2d');
