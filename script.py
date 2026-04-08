import re

with open('src/lib/engine/OntologyLayout.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace variables and depthY tracking
old_logic = '''    // 3. NotebookLM ?ㅽ???洹뱀븬異??덉씠?꾩썐 (Depth-Based Contour Approximation)
    const X_SPACING = 180;
    const Y_SPACING = 8;
    const NODE_HEIGHT = 32;
    
    // 媛??곸뒪(Depth / X異??덈꺼)蹂꾨줈 ?ㅼ쓬???몃뱶媛€ 諛곗튂?섏뼱?????ъ슜 媛€?ν븳 理쒖냼 Y醫뚰몴瑜?異붿쟻
    const depthY: Record<number, number> = {};
    const visibleNodes = new Set<string>();

    // ?쒕툕?몃━瑜??듭㎏濡??꾨옒濡??대룞?쒗궎???⑥닔
    function shiftSubtree(nodeId: string, shift: number) {
        const node = nodeMap.get(nodeId);
        if (node) node.worldY = (node.worldY || 0) + shift;
        
        if (collapsedNodeIds.has(nodeId)) return;
        const children = treeChildrenMap.get(nodeId) || [];
        for (const childId of children) {
            shiftSubtree(childId, shift);
        }
    }

    function layoutNode(nodeId: string, depth: number, depthX: number): number {
      const node = nodeMap.get(nodeId);
      if (!node) return 0;
      
      visibleNodes.add(nodeId);
      node.worldX = depthX;

      const children = treeChildrenMap.get(nodeId) || [];
      const hasVisibleChildren = children.length > 0 && !collapsedNodeIds.has(nodeId);

      let myY = 0;
      if (!hasVisibleChildren) {
         // ?먯떇???녿뒗 ?몃뱶???먯떊???곸뒪?먯꽌 媛€?ν븳 理쒖긽???꾩そ ?몃뱶 諛붾줈 諛???諛붿쭩 遺숈엫
         myY = depthY[depth] || 0;
         node.worldY = myY;
         depthY[depth] = myY + NODE_HEIGHT + Y_SPACING;
         return myY;
      } else {
         // ?먯떇???덈떎硫??먯떇?ㅼ쓣 癒쇱? ?쒖감?곸쑝濡?洹몃━怨?         let sumY = 0;
         for (const childId of children) {
            sumY += layoutNode(childId, depth + 1, depthX + X_SPACING);
         }
         // 遺€紐⑤뒗 ?먯떇?ㅼ쓽 以묒븰 ?꾩튂(avgY)瑜??щ쭩??         const avgY = sumY / children.length;
         
         // ?섏?留??먯떊???곸뒪?먯꽌 ?욎꽌 洹몃젮吏??ㅻⅨ ?몃뱶?€ 寃뱀튂硫????섎?濡??섑븳??requiredY) 寃€??         const requiredY = depthY[depth] || 0;
         myY = Math.max(requiredY, avgY);
         const shift = myY - avgY; // 留뚯빟 ?꾩そ ?몃뱶 ?뚮Ц??媛뺤젣濡?諛묒쑝濡?諛€?ㅻ궗?ㅻ㈃
         
         if (shift > 0) {
            // ?먯떇???꾩껜??諛€?ㅻ궃 留뚰겮 ?묎컳???대젮以?(?좎씠 李뚭렇?ъ?吏€ ?딄쾶)
            shiftSubtree(nodeId, shift);
            // ?먯떇 ?몃━媛€ ?듭㎏濡?shift 留뚰겮 ?대젮媛붿쑝誘€濡? 洹??댄썑??洹몃젮吏??ㅼ쓬 ?뺤젣 ?몃뱶?ㅼ쓽 ?먯떇?ㅼ씠 寃뱀튂吏€ ?딅룄濡??꾩껜 ?곸뒪 ?쒓퀎??媛깆떊
            for (const dStr in depthY) {
                const d = parseInt(dStr);
                if (d > depth) {
                    depthY[d] += shift;
                }
            }
         }
         
         node.worldY = myY;
         depthY[depth] = myY + NODE_HEIGHT + Y_SPACING;
         return myY;
      }
    }

    // ?ㅼ쨷 猷⑦듃 ?몃뱶??諛곗튂 ?쒖옉??    for (const root of roots) {
       layoutNode(root.id, 0, -600);
       // 猷⑦듃媛€ 蹂€寃쎈맆 ?뚮쭏??紐⑤뱺 ?곸뒪???щ갚??異붽??섏뿬 ?낅┰???몃━ 洹몃９?쇰줈 ?뚮뜑留?       for (const dStr in depthY) {
           depthY[dStr] += Y_SPACING * 3;
       }
    }'''

new_logic = '''    // 3. Bidirectional Depth-Based Contour Layout (양방향 마인드맵 전개)
    const X_SPACING = 220; // 가로 간격을 조금 더 넓혀 가독성 향상
    const Y_SPACING = 8;
    const NODE_HEIGHT = 32;
    
    const leftDepthY: Record<number, number> = {};
    const rightDepthY: Record<number, number> = {};
    const visibleNodes = new Set<string>();

    function shiftSubtree(nodeId: string, shift: number) {
        const node = nodeMap.get(nodeId);
        if (node) node.worldY = (node.worldY || 0) + shift;
        
        if (collapsedNodeIds.has(nodeId)) return;
        const children = treeChildrenMap.get(nodeId) || [];
        for (const childId of children) {
            shiftSubtree(childId, shift);
        }
    }

    function layoutNode(nodeId: string, depth: number, depthX: number, direction: number, depthTracker: Record<number, number>): number {
      const node = nodeMap.get(nodeId);
      if (!node) return 0;
      
      visibleNodes.add(nodeId);
      node.worldX = depthX;

      const children = treeChildrenMap.get(nodeId) || [];
      const hasVisibleChildren = children.length > 0 && !collapsedNodeIds.has(nodeId);

      let myY = 0;
      if (!hasVisibleChildren) {
         myY = depthTracker[depth] || 0;
         node.worldY = myY;
         depthTracker[depth] = myY + NODE_HEIGHT + Y_SPACING;
         return myY;
      } else {
         let sumY = 0;
         for (const childId of children) {
            sumY += layoutNode(childId, depth + 1, depthX + (X_SPACING * direction), direction, depthTracker);
         }
         const avgY = sumY / children.length;
         
         const requiredY = depthTracker[depth] || 0;
         myY = Math.max(requiredY, avgY);
         const shift = myY - avgY; 
         
         if (shift > 0) {
            shiftSubtree(nodeId, shift);
            for (const dStr in depthTracker) {
                const d = parseInt(dStr);
                if (d > depth) {
                    depthTracker[d] += shift;
                }
            }
         }
         
         node.worldY = myY;
         depthTracker[depth] = myY + NODE_HEIGHT + Y_SPACING;
         return myY;
      }
    }

    for (const root of roots) {
       const rootNode = nodeMap.get(root.id);
       if (rootNode) {
           rootNode.worldX = 0; // 루트 노드는 중앙(0)에 고정
           visibleNodes.add(root.id);
           
           const rootChildren = treeChildrenMap.get(root.id) || [];
           if (rootChildren.length > 0 && !collapsedNodeIds.has(root.id)) {
               // 루트의 자식들을 좌우로 분배
               const leftChildren = [];
               const rightChildren = [];
               for (let i = 0; i < rootChildren.length; i++) {
                   if (i % 2 === 0) rightChildren.push(rootChildren[i]);
                   else leftChildren.push(rootChildren[i]);
               }
               
               let leftSumY = 0;
               for (const c of leftChildren) {
                   leftSumY += layoutNode(c, 1, -X_SPACING, -1, leftDepthY);
               }
               let rightSumY = 0;
               for (const c of rightChildren) {
                   rightSumY += layoutNode(c, 1, X_SPACING, 1, rightDepthY);
               }
               
               rootNode.worldY = 0;
               const totalValid = (leftChildren.length > 0 ? 1 : 0) + (rightChildren.length > 0 ? 1 : 0);
               if (totalValid > 0) {
                   let overallAvg = 0;
                   if (leftChildren.length > 0) overallAvg += leftSumY / leftChildren.length;
                   if (rightChildren.length > 0) overallAvg += rightSumY / rightChildren.length;
                   overallAvg /= totalValid;
                   rootNode.worldY = overallAvg;
               }

               // 좌우 분리가 끝난 루트의 depthTracker 업데이트
               const finalRootY = rootNode.worldY;
               leftDepthY[0] = Math.max(leftDepthY[0] || 0, finalRootY + NODE_HEIGHT + Y_SPACING);
               rightDepthY[0] = Math.max(rightDepthY[0] || 0, finalRootY + NODE_HEIGHT + Y_SPACING);
           } else {
               rootNode.worldY = Math.max(leftDepthY[0] || 0, rightDepthY[0] || 0);
               leftDepthY[0] = rootNode.worldY + NODE_HEIGHT + Y_SPACING;
               rightDepthY[0] = rootNode.worldY + NODE_HEIGHT + Y_SPACING;
           }
       }
       
       for (const dStr in leftDepthY) leftDepthY[dStr] += Y_SPACING * 3;
       for (const dStr in rightDepthY) rightDepthY[dStr] += Y_SPACING * 3;
    }'''

content = content.replace(old_logic, new_logic)

with open('src/lib/engine/OntologyLayout.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Replaced successfully.')
