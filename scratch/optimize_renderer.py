import os

filepath = r"d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\src\lib\engine\OntologyRenderer.ts"
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# 5. Optimize node label rendering font setting and width cache based on actual code
target_node_font = """      const labelText = node.label || '';
      
      // 측정 캐시 최적화
      const weightStyle = (isActive || isTreeActive) ? '600' : '500';
      const cacheKey = weightStyle;
      if (!node._cachedTextWidth) node._cachedTextWidth = {};
      if (!node._cachedTextWidth[cacheKey]) {
          ctx.font = `${weightStyle} 12px 'Pretendard', sans-serif`;
          node._cachedTextWidth[cacheKey] = ctx.measureText(labelText).width;
      }
      const textWidth = node._cachedTextWidth[cacheKey] * localZoom;

      // NotebookLM 스타일: 콤팩트한 노드 사이즈
      const fontSize = 12 * localZoom;
      ctx.font = `${weightStyle} ${fontSize}px 'Pretendard', sans-serif`;"""

replacement_node_font = """      const labelText = node.label || '';
      
      // 측정 캐시 최적화
      const weightStyle = (isActive || isTreeActive) ? '600' : '500';
      const cacheKey = weightStyle;
      if (!node._cachedTextWidth) node._cachedTextWidth = {};
      if (!node._cachedTextWidth[cacheKey]) {
          this.setFont(ctx, `${weightStyle} 12px 'Pretendard', sans-serif`);
          node._cachedTextWidth[cacheKey] = ctx.measureText(labelText).width;
      }
      const textWidth = node._cachedTextWidth[cacheKey] * localZoom;

      // NotebookLM 스타일: 콤팩트한 노드 사이즈
      const fontSize = Math.round(12 * localZoom);
      this.setFont(ctx, `${weightStyle} ${fontSize}px 'Pretendard', sans-serif`);"""

if target_node_font in code:
    code = code.replace(target_node_font, replacement_node_font, 1)
    print("Optimized node label font rendering successfully.")
else:
    print("Node label font not found!")

# 7. Optimize drawNodeTextInside based on actual code
target_draw_text_inside = """  private static drawNodeTextInside(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    radius: number,
    localZoom: number,
    isActive: boolean,
    isInteractive?: boolean
  ): void {
    if (isInteractive) {
      // 상호작용(줌, 패닝, 드래그) 중일 때는 measureText를 절대 부르지 않는 최속(Fast-path) 렌더링
      const fontSize = Math.max(7.5 * localZoom, 10 * localZoom * (isActive ? 1.12 : 1.0));
      ctx.font = `bold ${fontSize}px 'Pretendard', sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 글자 크기가 원 반지름에 맞지 않아 삐져나가는 것을 방지하기 위해, 상호작용 중에는 첫 단어만 노출하거나 적당히 잘라 1줄로 단순 렌더링
      const words = text.split(/\s+/);
      const displayStr = words[0] || '';
      const finalStr = displayStr.length > 5 ? displayStr.slice(0, 4) + '..' : displayStr;
      ctx.fillText(finalStr, cx, cy);
      return;
    }

    // 1. Text wrapping: split by space or custom delimiters
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (currentLine.length + word.length > 7) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // 2. Determine base font size based on radius
    let fontSize = Math.max(8.0 * localZoom, 11 * localZoom * (isActive ? 1.12 : 1.0));
    
    // Fit text inside circle
    ctx.font = `600 ${fontSize}px 'Pretendard', sans-serif`;
    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }
    
    const maxAllowedWidth = radius * 1.55; // 1.62 -> 1.55로 안전 마진 확보
    const totalHeight = lines.length * fontSize * 1.22;
    const maxAllowedHeight = radius * 1.55; // 1.62 -> 1.55

    if (maxLineWidth > maxAllowedWidth || totalHeight > maxAllowedHeight) {
      const scaleW = maxAllowedWidth / maxLineWidth;
      const scaleH = maxAllowedHeight / totalHeight;
      // 0.93 버퍼 비율을 적용하여 경계면에서의 폰트 크기 진동(Flickering) 현상 원천 차단
      const scaleFactor = Math.min(scaleW, scaleH) * 0.93;
      fontSize = Math.max(7.2 * localZoom, fontSize * scaleFactor);
    }

    // 소수점 1자리 수준으로 폰트 크기 수치를 클램핑하여 렌더 프레임 간 격차 해소
    fontSize = Math.round(fontSize * 10) / 10;
    ctx.font = `bold ${fontSize}px 'Pretendard', sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startY = cy - ((lines.length - 1) * fontSize * 1.2) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * fontSize * 1.2);
    }
  }"""

replacement_draw_text_inside = """  private static drawNodeTextInside(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    radius: number,
    localZoom: number,
    isActive: boolean,
    isInteractive?: boolean
  ): void {
    if (isInteractive) {
      // 상호작용(줌, 패닝, 드래그) 중일 때는 measureText를 절대 부르지 않는 최속(Fast-path) 렌더링
      const fontSize = Math.round(Math.max(7.5 * localZoom, 10 * localZoom * (isActive ? 1.12 : 1.0)));
      this.setFont(ctx, `bold ${fontSize}px 'Pretendard', sans-serif`);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 글자 크기가 원 반지름에 맞지 않아 삐져나가는 것을 방지하기 위해, 상호작용 중에는 첫 단어만 노출하거나 적당히 잘라 1줄로 단순 렌더링
      const words = text.split(/\s+/);
      const displayStr = words[0] || '';
      const finalStr = displayStr.length > 5 ? displayStr.slice(0, 4) + '..' : displayStr;
      ctx.fillText(finalStr, cx, cy);
      return;
    }

    // 1. Text wrapping: split by space or custom delimiters
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (currentLine.length + word.length > 7) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // 2. Determine base font size based on radius
    let fontSize = Math.max(8.0 * localZoom, 11 * localZoom * (isActive ? 1.12 : 1.0));
    
    // Fit text inside circle
    const initialFontSize = Math.round(fontSize);
    this.setFont(ctx, `600 ${initialFontSize}px 'Pretendard', sans-serif`);
    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }
    
    const maxAllowedWidth = radius * 1.55; // 1.62 -> 1.55로 안전 마진 확보
    const totalHeight = lines.length * fontSize * 1.22;
    const maxAllowedHeight = radius * 1.55; // 1.62 -> 1.55

    if (maxLineWidth > maxAllowedWidth || totalHeight > maxAllowedHeight) {
      const scaleW = maxAllowedWidth / maxLineWidth;
      const scaleH = maxAllowedHeight / totalHeight;
      const scaleFactor = Math.min(scaleW, scaleH) * 0.93;
      fontSize = Math.max(7.2 * localZoom, fontSize * scaleFactor);
    }

    const finalFontSize = Math.round(fontSize);
    this.setFont(ctx, `bold ${finalFontSize}px 'Pretendard', sans-serif`);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startY = cy - ((lines.length - 1) * finalFontSize * 1.2) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * finalFontSize * 1.2);
    }
  }"""

if target_draw_text_inside in code:
    code = code.replace(target_draw_text_inside, replacement_draw_text_inside, 1)
    print("Optimized drawNodeTextInside successfully.")
else:
    print("drawNodeTextInside block not found!")

# Save back
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
print("File saved successfully.")
