import { KeywordResult, CoOccurrence } from './keyword-extractor';

export interface GraphNode {
  id: string;
  name: string;
  val: number;  // size
  color: string;
  count: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const CLUSTER_COLORS = [
  '#4A6CF7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6',
];

export function buildGraphData(keywords: KeywordResult[], coOccurrences: CoOccurrence[]): GraphData {
  if (keywords.length === 0) return { nodes: [], links: [] };

  const maxCount = Math.max(...keywords.map(k => k.count));
  const minSize = 3;
  const maxSize = 20;

  // Assign colors based on simple clustering via co-occurrence
  const colorMap: Record<string, string> = {};
  let colorIdx = 0;
  const visited = new Set<string>();

  // Simple greedy clustering
  keywords.forEach(kw => {
    if (visited.has(kw.word)) return;
    const color = CLUSTER_COLORS[colorIdx % CLUSTER_COLORS.length];
    colorMap[kw.word] = color;
    visited.add(kw.word);

    // Find co-occurring words and assign same color  
    coOccurrences
      .filter(co => co.source === kw.word || co.target === kw.word)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .forEach(co => {
        const neighbor = co.source === kw.word ? co.target : co.source;
        if (!visited.has(neighbor)) {
          colorMap[neighbor] = color;
          visited.add(neighbor);
        }
      });

    colorIdx++;
  });

  const nodes: GraphNode[] = keywords.map(kw => ({
    id: kw.word,
    name: kw.word,
    val: minSize + ((kw.count / maxCount) * (maxSize - minSize)),
    color: colorMap[kw.word] || CLUSTER_COLORS[0],
    count: kw.count,
  }));

  const keywordSet = new Set(keywords.map(k => k.word));
  const links: GraphLink[] = coOccurrences
    .filter(co => keywordSet.has(co.source) && keywordSet.has(co.target))
    .map(co => ({
      source: co.source,
      target: co.target,
      value: co.weight,
    }));

  return { nodes, links };
}
