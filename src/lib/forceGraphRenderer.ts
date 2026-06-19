import { OntologyNode, OntologyEdge } from '@/lib/ontology.types';

export type ForceGraphNode = OntologyNode & {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  orbitIndex?: number;
  calculatedColors?: string[];
};

export type ForceGraphLink = Omit<OntologyEdge, 'source' | 'target'> & {
  source: ForceGraphNode;
  target: ForceGraphNode;
};

export const GROUP_COLORS: Record<string, string> = {
  STRATEGIC_PLANNING: '#3B82F6',   // Blue-500
  PUBLIC_HEALTH: '#10B981',        // Emerald-500
  CITIZEN_HEALTH: '#F59E0B',       // Amber-500
  HEALTH_PROMOTION: '#EC4899',     // Pink-500
  SMART_HEALTH: '#8B5CF6',         // Violet-500
  MACRO_RESEARCH: '#64748B',       // Slate-500
  SYSTEM_RISK: '#EF4444',          // Red-500
  OTHER: '#9CA3AF',                // Gray-400
};

export const GROUP_LABELS: Record<string, string> = {
  STRATEGIC_PLANNING: '전략기획',
  PUBLIC_HEALTH: '공공의료',
  CITIZEN_HEALTH: '시민건강',
  HEALTH_PROMOTION: '건강증진',
  SMART_HEALTH: '스마트건강',
  MACRO_RESEARCH: '거시/기반',
  SYSTEM_RISK: '위험요소',
};

function colorWithAlpha(hex: string, alpha: number): string {
    if (!hex) return 'rgba(0,0,0,1)';
    if (hex.startsWith('rgba')) return hex;
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const h = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})` : 'rgba(0,0,0,1)';
}

function lightenColor(hex: string, percent: number): string {
    if (!hex || hex.startsWith('rgba')) return hex;
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    const max = (val: number) => Math.min(255, Math.max(0, val));
    return `#${(0x1000000 + max(R) * 0x10000 + max(G) * 0x100 + max(B)).toString(16).slice(1)}`;
}

export function drawNode(node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number, activeTreeSet: Set<string>, activeNodeId: string | null, hoveredNodeId: string | null) {
  const r = 16;
  const isCenter = node.orbitIndex === 0;
  const isActive = node.id === activeNodeId;
  const isHovered = node.id === hoveredNodeId;
  const isConnectedToActive = activeTreeSet.has(node.id);
  const hasActiveSelection = !!activeNodeId && activeNodeId !== 'root-HCHPS';

  const nodeColors = node.calculatedColors || [node.customColor || GROUP_COLORS[node.group] || GROUP_COLORS.OTHER];
  const baseColor = nodeColors[0];
  const sliceAngle = (2 * Math.PI) / nodeColors.length;

  let opacity = hasActiveSelection ? (isActive || isConnectedToActive ? 1 : 0.28) : 1.0;
  if (isHovered && !isActive) opacity = Math.max(opacity, 0.9);

  ctx.save();
  ctx.globalAlpha = opacity;

  // ── Center Sun ──
  if (isCenter) {
    const glow = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 6);
    glow.addColorStop(0, colorWithAlpha(baseColor, 0.05));
    glow.addColorStop(0.5, colorWithAlpha(baseColor, 0.01));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(node.x, node.y, r * 6, 0, 2 * Math.PI); ctx.fill();

    const sizeOverride = isActive ? r * 1.5 : (isHovered ? r * 1.2 : r);

    for (let i = 0; i < nodeColors.length; i++) {
        const gradient = ctx.createRadialGradient(
            node.x - sizeOverride * 0.3, node.y - sizeOverride * 0.3, 0,
            node.x, node.y, sizeOverride
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, lightenColor(nodeColors[i], 0.4));
        gradient.addColorStop(1, lightenColor(nodeColors[i], 0.1));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.arc(node.x, node.y, sizeOverride, -Math.PI/2 + i * sliceAngle, -Math.PI/2 + (i + 1) * sliceAngle);
        ctx.fill();
    }
  } else if (isActive) {
      // Active Node
      const glow = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * 1.5);
      glow.addColorStop(0, colorWithAlpha(baseColor, 0.12));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(node.x, node.y, r * 1.5, 0, 2 * Math.PI); ctx.fill();

      for (let i = 0; i < nodeColors.length; i++) {
        ctx.fillStyle = nodeColors[i];
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.arc(node.x, node.y, r, -Math.PI/2 + i * sliceAngle, -Math.PI/2 + (i + 1) * sliceAngle);
        ctx.fill();
      }

      for (let i = 0; i < nodeColors.length; i++) {
        ctx.strokeStyle = nodeColors[i];
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y); 
        ctx.arc(node.x, node.y, r + 4, -Math.PI/2 + i * sliceAngle, -Math.PI/2 + (i + 1) * sliceAngle);
        ctx.stroke();
      }
  } else {
      // Normal
      for (let i = 0; i < nodeColors.length; i++) {
        ctx.fillStyle = nodeColors[i];
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.arc(node.x, node.y, r, -Math.PI/2 + i * sliceAngle, -Math.PI/2 + (i + 1) * sliceAngle);
        ctx.fill();
      }

      if (isConnectedToActive) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 2 * Math.PI); ctx.stroke();
      }
  }

  // Draw Labels
  const labelText = node.label || '';
  const fontSize = 14 / globalScale;
  ctx.font = `${(isCenter || isActive) ? 'bold' : 'normal'} ${fontSize}px 'Pretendard', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const labelY = node.y + r + 4;
  const paddingX = 4;
  const paddingY = 2;
  const textWidth = ctx.measureText(labelText).width;
  const bgWidth = textWidth + paddingX * 2;
  const bgHeight = fontSize + paddingY * 2;

  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.85, opacity * 1.5)})`;
  ctx.beginPath(); ctx.roundRect(node.x - bgWidth/2, labelY - paddingY, bgWidth, bgHeight, 4); ctx.fill();

  ctx.fillStyle = isCenter || isActive || isHovered ? '#1e293b' : `rgba(30,41,59,${Math.max(0.7, opacity)})`;
  ctx.fillText(labelText, node.x, labelY);

  ctx.restore();
}

export function drawEdge(edge: ForceGraphLink, ctx: CanvasRenderingContext2D, globalScale: number, activeTreeSet: Set<string>, activeNodeId: string | null) {
  const src = edge.source;
  const tgt = edge.target;
  const isConnected = activeNodeId && activeTreeSet.has(src.id) && activeTreeSet.has(tgt.id);
  
  if (activeNodeId && !isConnected) return; // Hide non-connected edges strongly

  const isNegative = edge.weight < 0;
  const absWeight = Math.abs(edge.weight || 0.5);

  let lineWidth = (0.5 + absWeight * 1.5) / globalScale;
  if (isNegative) lineWidth *= 1.1;
  if (isConnected) lineWidth *= 1.05; // 빔 모양으로 확장되는 현상을 방지하기 위해 1.05배로 은은하게 제한

  ctx.strokeStyle = isNegative ? 'rgba(229,56,59,0.25)' : (isConnected ? 'rgba(59,130,246,0.35)' : 'rgba(204,204,210,0.18)');
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(isNegative ? [4/globalScale, 3/globalScale] : []);
  
  ctx.beginPath();
  ctx.moveTo(src.x, src.y);
  ctx.lineTo(tgt.x, tgt.y);
  ctx.stroke();
  ctx.setLineDash([]);
}
