/* eslint-disable */
const GROUP_COLORS = { MACRO_RESEARCH: 'green', DATA_PIPELINE: 'yellow', OTHER: 'grey' };

class Engine {
  constructor() {
    this.nodes = [
      { id: '1', label: '김미경', group: 'MACRO_RESEARCH', orbitIndex: 4, customColor: undefined },
      { id: '2', label: '?�품구매', group: 'DATA_PIPELINE', orbitIndex: 2, customColor: undefined },
      { id: '3', label: '측정?�비', group: 'OTHER', orbitIndex: 3, customColor: undefined }
    ];
    this.edges = [
      { source: '2', target: '3', type: 'DEPENDENCY' },
      { source: '1', target: '3', type: 'DEPENDENCY' }  // 김미경 -> 측정?�비
    ];
  }
  
  getNodeColors(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    const colors = new Set();
    const myBaseColor = node.customColor || GROUP_COLORS[node.group] || GROUP_COLORS.OTHER;
    
    if (node.orbitIndex === 0) return [myBaseColor];
    
    for (const edge of this.edges) {
      if (edge.type !== 'DEPENDENCY' && edge.type !== 'CAUSAL_DRIVE') continue;
      
      const sourceId = edge.source;
      const targetId = edge.target;
      
      if (targetId === node.id) {
        const neighbor = this.nodes.find(n => n.id === sourceId);
        if (neighbor && neighbor.orbitIndex > 0) {
          const c = neighbor.customColor || GROUP_COLORS[neighbor.group] || GROUP_COLORS.OTHER;
          colors.add(c);
        }
      }
    }
    
    if (colors.size === 0) return [myBaseColor];
    colors.add(myBaseColor);
    return Array.from(colors);
  }
}

const e = new Engine();
console.log('측정?�비', e.getNodeColors('3'));
console.log('김미경', e.getNodeColors('1'));
console.log('?�품구매', e.getNodeColors('2'));

