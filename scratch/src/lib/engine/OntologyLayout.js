"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OntologyLayout = exports.CULL_MARGIN = exports.MAX_TILT = exports.MIN_TILT = exports.MAX_ZOOM = exports.MIN_ZOOM = exports.LERP_SPEED = exports.ORBIT_SPEED_BASE = exports.MAX_NODE_R = exports.MIN_NODE_R = exports.ELLIPSE_RATIO = exports.NUM_ORBITS = void 0;
var PerformanceProfiler_1 = require("./PerformanceProfiler");
// ============ Constants ============
exports.NUM_ORBITS = 8;
exports.ELLIPSE_RATIO = 1.3;
exports.MIN_NODE_R = 3;
exports.MAX_NODE_R = 24;
exports.ORBIT_SPEED_BASE = 0.0006;
exports.LERP_SPEED = 0.08;
exports.MIN_ZOOM = 0.3;
exports.MAX_ZOOM = 3.0;
exports.MIN_TILT = 0.3;
exports.MAX_TILT = 1.0;
exports.CULL_MARGIN = 80;
// Layout parameters - defined inside computePositions
var OntologyLayout = /** @class */ (function () {
    function OntologyLayout() {
    }
    /**
     * 궤도 인덱스에 따른 비선형 반경을 반환하는 지능형 헬퍼
     * 1차 궤도(카테고리)는 145px로 좁게, 그 외 2/3차는 여유있는 190px 간격 유지
     * 대규모 맵(노드 수에 비례)일 때는 자동으로 궤도 간격을 확장하여 겹침을 방지함
     */
    OntologyLayout.getOrbitRadius = function (orbitIndex) {
        if (orbitIndex === 0)
            return 0;
        var totalCount = OntologyLayout.totalNodesCount;
        var expansionFactor = totalCount > 100
            ? Math.min(1.15, 1.0 + (totalCount - 100) * 0.0005)
            : 1.0;
        var baseRadius1 = 80 * expansionFactor;
        var baseGap = 65 * expansionFactor;
        if (orbitIndex === 1)
            return baseRadius1;
        var radius = baseRadius1;
        var currentGap = baseGap;
        for (var i = 1; i < orbitIndex; i++) {
            radius += currentGap;
            currentGap = Math.max(25, currentGap * 0.75);
        }
        return radius;
    };
    /**
     * 노드의 효과적인 레이어 ID를 반환하는 지능형 헬퍼
     */
    OntologyLayout.getEffectiveLayerId = function (node) {
        if (node.layerId !== undefined && node.layerId !== null) {
            return Number(node.layerId);
        }
        var label = node.label || '';
        var id = node.id || '';
        var dyn = OntologyLayout.dynamicRules;
        // 0: 인물 (Agent)
        if (/[가-힣]+ (이사|대리|부장|과장|사원|담당|대표|팀장|주임|주무관|소장|선생님)/.test(label) ||
            label.endsWith('님') ||
            id.startsWith('user_') ||
            id.includes('person') ||
            id.includes('assignee') ||
            id === 'hong_jongnam' ||
            id === 'kim_jaeeun' ||
            id === 'oh_changsun' ||
            id === 'gangnam_health_center' ||
            label.includes('담당자') ||
            label.includes('본부장') ||
            label.includes('과장') ||
            label.includes('팀장') ||
            label.includes('주무관') ||
            label.includes('소장') ||
            label.includes('선생님') ||
            label.includes('인수자') ||
            label.includes('인계자') ||
            label.includes('입회자') ||
            label.includes('팀장대직') ||
            // 실무 인력 직접 매핑
            label.includes('오창선') ||
            label.includes('김형종') ||
            label.includes('신진성') ||
            label.includes('김은주') ||
            label.includes('김태환') ||
            ((dyn === null || dyn === void 0 ? void 0 : dyn.agents) && dyn.agents.some(function (w) { return label.includes(w); }))) {
            return 0;
        }
        // 1: 예산/비품 (Resource)
        if (label.includes('예산') ||
            label.includes('비용') ||
            label.includes('구매') ||
            label.includes('임대') ||
            label.includes('비품') ||
            label.includes('원') ||
            id.includes('budget') ||
            id.includes('inventory') ||
            id.includes('equip') ||
            id.includes('cost') ||
            id.includes('fee') ||
            id.includes('price') ||
            id.includes('amount') ||
            label.includes('지출') ||
            label.includes('단가') ||
            label.includes('집행액') ||
            label.includes('지출잔액') ||
            label.includes('예산현액') ||
            label.includes('불용') ||
            label.includes('용역비') ||
            label.includes('계약') ||
            label.includes('수익') ||
            label.includes('차액') ||
            ((dyn === null || dyn === void 0 ? void 0 : dyn.resources) && dyn.resources.some(function (w) { return label.includes(w); }))) {
            return 1;
        }
        // 2: 업무/회의/프로젝트 (Execution)
        if (label.includes('회의') ||
            label.includes('개발') ||
            label.includes('도입') ||
            label.includes('시스템') ||
            label.includes('프로그램') ||
            label.includes('검사') ||
            label.includes('체크업') ||
            label.includes('센터') ||
            label.includes('검진') ||
            label.includes('업무') ||
            id.includes('task') ||
            id.includes('meeting') ||
            id.includes('checkup') ||
            id.includes('program') ||
            id.includes('test') ||
            id.includes('system') ||
            id.includes('sports') ||
            id.includes('center') ||
            id.includes('project') ||
            id.includes('execution') ||
            id.includes('campaign') ||
            id.includes('challenge') ||
            id.includes('event') ||
            id.includes('report') ||
            label.includes('캠페인') ||
            label.includes('챌린지') ||
            label.includes('조례') ||
            label.includes('행사') ||
            label.includes('교육') ||
            label.includes('계획') ||
            label.includes('성과관리') ||
            label.includes('보고') ||
            label.includes('인계') ||
            label.includes('인수') ||
            ((dyn === null || dyn === void 0 ? void 0 : dyn.executions) && dyn.executions.some(function (w) { return label.includes(w); }))) {
            return 2;
        }
        // 3: 위키/문서 (Knowledge) - 기본값
        return 3;
    };
    /**
     * 캔버스와 카메라 상태에 따른 각 노드의 렌더링 좌표를 계산합니다.
     * NotebookLM 스타일의 계층형 가로 트리(Horizontal Tidy Tree) 구조로 배치합니다.
     */
    OntologyLayout.computePositions = function (nodes, nodeMap, edges, canvasW, canvasH, cameraOffsetX, cameraOffsetY, zoom, collapsedNodeIds, activeLayers, isInteractive, recomputeWorldPositions, isOrbiting, isDragging) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
        if (isInteractive === void 0) { isInteractive = false; }
        if (recomputeWorldPositions === void 0) { recomputeWorldPositions = true; }
        if (isOrbiting === void 0) { isOrbiting = false; }
        if (isDragging === void 0) { isDragging = false; }
        if (nodes.length === 0)
            return;
        OntologyLayout.totalNodesCount = nodes.length;
        // Silence unused parameter warnings when maxIterations === 0
        if (isInteractive) {
            // noop
        }
        if (recomputeWorldPositions) {
            // 1. 방향성이 있는 인접 리스트 (Directed Adjacency List) 생성 및 무방향(Fallback) 준비
            // - 크로스 엣지(횡적 연결)로 인해 하위 노드가 잘못된 부모 밑으로(Spanning Tree 구조 붕괴) 종속되는 것을 방지하기 위함
            var directedDir_1 = new Map();
            var undirectedDir_1 = new Map();
            nodes.forEach(function (n) {
                // 1회 계산 및 런타임 캐싱
                n.effectiveLayer = OntologyLayout.getEffectiveLayerId(n);
                directedDir_1.set(n.id, []);
                undirectedDir_1.set(n.id, []);
            });
            for (var _i = 0, edges_1 = edges; _i < edges_1.length; _i++) {
                var edge = edges_1[_i];
                if (undirectedDir_1.has(edge.source) && undirectedDir_1.has(edge.target)) {
                    undirectedDir_1.get(edge.source).push(edge.target);
                    undirectedDir_1.get(edge.target).push(edge.source);
                    // 구조적 엣지(하위 종속)인 경우에만 방향성을 부여하여 트리 구조를 명확히 잡습니다
                    var targetNode = nodeMap.get(edge.target);
                    // 중요: 타겟 노드가 명시적인 parentId를 갖고 있다면, 오직 이 부모로부터 온 간선만 트리 구조로 허용 (AI 교차 추천 등 차단)
                    if (targetNode && targetNode.parentId) {
                        if (targetNode.parentId === edge.source) {
                            directedDir_1.get(edge.source).push(edge.target);
                        }
                    }
                    // 예외: 카테고리 노드는 parentId가 없으나 CAUSAL_DRIVE 간선으로 루트와 연결됨
                    else if (edge.type === 'CAUSAL_DRIVE' || edge.type === 'DEPENDENCY') {
                        directedDir_1.get(edge.source).push(edge.target);
                    }
                }
            }
            // 2. 방향성 그래프 기반 중앙 노드(Orbit 0) 트리 추출
            var treeChildrenMap_1 = new Map();
            OntologyLayout.lastTreeChildrenMap = treeChildrenMap_1;
            nodes.forEach(function (n) { return treeChildrenMap_1.set(n.id, []); });
            var roots = [];
            var mainRoot_1 = nodes.find(function (n) { return n.centralityScore === 9999999; }) || nodes.find(function (n) { return n.id === 'root-HCHPS'; }) || nodes[0];
            roots.push(mainRoot_1);
            var visitedBfs_1 = new Set();
            visitedBfs_1.add(mainRoot_1.id);
            // Phase A: 엄격한 방향성 트리를 먼저 순회 (올바른 부모-자식 정렬 우선 배정)
            var queue = [mainRoot_1.id];
            while (queue.length > 0) {
                var curr = queue.shift();
                var neighbors = directedDir_1.get(curr) || [];
                neighbors.sort(function (a, b) {
                    var _a, _b, _c, _d;
                    var orderA = (_b = (_a = nodeMap.get(a)) === null || _a === void 0 ? void 0 : _a.customSortOrder) !== null && _b !== void 0 ? _b : 0;
                    var orderB = (_d = (_c = nodeMap.get(b)) === null || _c === void 0 ? void 0 : _c.customSortOrder) !== null && _d !== void 0 ? _d : 0;
                    if (orderA !== orderB)
                        return orderA - orderB;
                    return a.localeCompare(b);
                });
                for (var _5 = 0, neighbors_1 = neighbors; _5 < neighbors_1.length; _5++) {
                    var nxt = neighbors_1[_5];
                    if (!visitedBfs_1.has(nxt)) {
                        visitedBfs_1.add(nxt);
                        treeChildrenMap_1.get(curr).push(nxt);
                        queue.push(nxt);
                    }
                }
            }
            // Phase B: 메인 방향성 트리에 결속되지 못한 남은 노드들을 무방향 엣지로 구제 (Spanning Tree 보완)
            for (var retry = 0; retry < 2; retry++) {
                // 첫 번째 retry에서는 기존에 방문된 노드들과 무방향 선분이 있는 미방문 노드들을 흡수
                var existingVisited = Array.from(visitedBfs_1);
                for (var _6 = 0, existingVisited_1 = existingVisited; _6 < existingVisited_1.length; _6++) {
                    var curr = existingVisited_1[_6];
                    var neighbors = undirectedDir_1.get(curr) || [];
                    for (var _7 = 0, neighbors_2 = neighbors; _7 < neighbors_2.length; _7++) {
                        var nxt = neighbors_2[_7];
                        if (!visitedBfs_1.has(nxt)) {
                            visitedBfs_1.add(nxt);
                            treeChildrenMap_1.get(curr).push(nxt);
                            queue.push(nxt);
                            // 서브트리 전개
                            while (queue.length > 0) {
                                var subCurr = queue.shift();
                                var subNeighbors = ((_a = directedDir_1.get(subCurr)) === null || _a === void 0 ? void 0 : _a.length) ? directedDir_1.get(subCurr) : undirectedDir_1.get(subCurr);
                                subNeighbors.sort(function (a, b) { return a.localeCompare(b); });
                                for (var _8 = 0, subNeighbors_1 = subNeighbors; _8 < subNeighbors_1.length; _8++) {
                                    var subNxt = subNeighbors_1[_8];
                                    if (!visitedBfs_1.has(subNxt)) {
                                        visitedBfs_1.add(subNxt);
                                        treeChildrenMap_1.get(subCurr).push(subNxt);
                                        queue.push(subNxt);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // Phase C: 영원히 고립된 완전히 끊어진 노드/서브그래프 렌더링을 위한 독립 루트 선언
            // 💡 토폴로지 위계가 꼬이지 않도록, parentId가 없거나 부모가 이미 방문된 노드부터 우선적으로 루트로 선언하여 BFS를 구동합니다.
            while (true) {
                var sortedUnvisited = nodes
                    .filter(function (n) { return !visitedBfs_1.has(n.id); })
                    .sort(function (a, b) {
                    var hasParentA = a.parentId && !visitedBfs_1.has(a.parentId) ? 1 : 0;
                    var hasParentB = b.parentId && !visitedBfs_1.has(b.parentId) ? 1 : 0;
                    return hasParentA - hasParentB;
                });
                if (sortedUnvisited.length === 0)
                    break;
                var n = sortedUnvisited[0];
                roots.push(n);
                visitedBfs_1.add(n.id);
                queue.push(n.id);
                while (queue.length > 0) {
                    var curr = queue.shift();
                    var neighbors = undirectedDir_1.get(curr) || [];
                    neighbors.sort(function (a, b) {
                        var _a, _b, _c, _d;
                        var orderA = (_b = (_a = nodeMap.get(a)) === null || _a === void 0 ? void 0 : _a.customSortOrder) !== null && _b !== void 0 ? _b : 0;
                        var orderB = (_d = (_c = nodeMap.get(b)) === null || _c === void 0 ? void 0 : _c.customSortOrder) !== null && _d !== void 0 ? _d : 0;
                        if (orderA !== orderB)
                            return orderA - orderB;
                        return a.localeCompare(b);
                    });
                    for (var _9 = 0, neighbors_3 = neighbors; _9 < neighbors_3.length; _9++) {
                        var nxt = neighbors_3[_9];
                        if (!visitedBfs_1.has(nxt)) {
                            visitedBfs_1.add(nxt);
                            treeChildrenMap_1.get(curr).push(nxt);
                            queue.push(nxt);
                        }
                    }
                }
            }
            // 3. Layout Execution
            var visibleNodes_1 = new Set();
            // Concentric Orbit Layout: 모든 노드를 중앙(0,0) 중심의 동심 궤도에 배치
            var getNodeDepth_1 = function (nodeId) {
                var depth = 0;
                var visited = new Set();
                var curr = nodeMap.get(nodeId);
                while (curr && curr.parentId) {
                    if (visited.has(curr.id)) {
                        console.error("[OntologyLayout] Circular parentId reference detected at node: ".concat(curr.id, ". Breaking loop to prevent infinite loop hang."));
                        break;
                    }
                    visited.add(curr.id);
                    depth++;
                    curr = nodeMap.get(curr.parentId);
                }
                return depth;
            };
            var layoutOrbitNode_1 = function (nodeId, parentNode, assignedAngle) {
                var _a;
                var node = nodeMap.get(nodeId);
                if (!node)
                    return;
                visibleNodes_1.add(nodeId);
                var depth = getNodeDepth_1(nodeId);
                if (depth === 0 && nodeId !== mainRoot_1.id) {
                    depth = 1;
                }
                var defaultOrbit;
                if (parentNode) {
                    if (parentNode.orbitIndex === 0) {
                        defaultOrbit = 2;
                    }
                    else {
                        defaultOrbit = parentNode.orbitIndex + 1;
                    }
                }
                else {
                    defaultOrbit = Math.max(2, depth);
                }
                node.orbitIndex = (_a = node.customOrbitIndex) !== null && _a !== void 0 ? _a : defaultOrbit;
                node.orbitAngle = assignedAngle;
                var staticOffset = 0;
                if (depth > 0 && parentNode) {
                    var siblings = treeChildrenMap_1.get(parentNode.id) || [];
                    var sibIdx = siblings.indexOf(nodeId);
                    if (sibIdx !== -1) {
                        staticOffset = sibIdx % 2 === 0 ? -12 : 12; // 2D 평면에서는 정적 지그재그 오프셋 폭을 12px로 축소
                    }
                }
                node.radialOffset = staticOffset;
                if (depth === 0) {
                    node.targetWorldX = 0;
                    node.targetWorldY = 0;
                }
                else {
                    if (!isOrbiting && node.fixedX !== undefined && node.fixedX !== null && node.fixedY !== undefined && node.fixedY !== null) {
                        node.targetWorldX = node.fixedX;
                        node.targetWorldY = node.fixedY;
                        node.worldX = node.fixedX;
                        node.worldY = node.fixedY;
                    }
                    else {
                        if (depth === 1) {
                            // 1차 카테고리: 절대 반경 145px
                            var R = OntologyLayout.getOrbitRadius(1);
                            node.targetWorldX = R * Math.cos(assignedAngle) * exports.ELLIPSE_RATIO;
                            node.targetWorldY = R * Math.sin(assignedAngle);
                        }
                        else if (depth === 2 && parentNode) {
                            // 2차 카테고리: 부모 1차 노드 기점 상대 반경 65px + 지그재그 오프셋
                            var r = 65 + staticOffset;
                            node.targetWorldX = parentNode.targetWorldX + r * Math.cos(assignedAngle) * exports.ELLIPSE_RATIO;
                            node.targetWorldY = parentNode.targetWorldY + r * Math.sin(assignedAngle);
                        }
                        else if (depth === 3 && parentNode) {
                            // 3차 카테고리: 부모 2차 노드 기점 상대 반경 50px + 지그재그 오프셋
                            var r = 50 + staticOffset;
                            node.targetWorldX = parentNode.targetWorldX + r * Math.cos(assignedAngle) * exports.ELLIPSE_RATIO;
                            node.targetWorldY = parentNode.targetWorldY + r * Math.sin(assignedAngle);
                        }
                        else {
                            // 폴백 (고아 노드 등)
                            var R = OntologyLayout.getOrbitRadius(node.orbitIndex);
                            node.targetWorldX = R * Math.cos(assignedAngle) * exports.ELLIPSE_RATIO;
                            node.targetWorldY = R * Math.sin(assignedAngle);
                        }
                    }
                }
                if (!collapsedNodeIds.has(nodeId)) {
                    var children = treeChildrenMap_1.get(nodeId) || [];
                    var N_1 = children.length;
                    if (N_1 > 0) {
                        var span = Math.PI * 0.75;
                        if (depth === 1) {
                            // 1차 카테고리의 자식들은 바깥 방향 240도(Math.PI * 1.33) 대역으로 쫙 펼침 (중심 루트 회피)
                            span = Math.PI * 1.33;
                        }
                        else if (depth === 2) {
                            // 2차 카테고리의 자식들은 바깥 방향 160도(Math.PI * 0.88) 대역으로 고르게 분산
                            span = Math.PI * 0.88;
                        }
                        var angleStep_1 = N_1 === 1 ? 0 : span / (N_1 - 1);
                        var startAngle_1 = assignedAngle - span / 2;
                        children.forEach(function (childId, idx) {
                            var childNode = nodeMap.get(childId);
                            if (childNode) {
                                var childAngle = N_1 === 1 ? assignedAngle : startAngle_1 + idx * angleStep_1;
                                layoutOrbitNode_1(childId, node, childAngle);
                            }
                        });
                    }
                }
            };
            if (mainRoot_1) {
                mainRoot_1.orbitIndex = 0;
                mainRoot_1.orbitAngle = 0;
                mainRoot_1.targetWorldX = 0;
                mainRoot_1.targetWorldY = 0;
                mainRoot_1.worldX = 0;
                mainRoot_1.worldY = 0;
                visibleNodes_1.add(mainRoot_1.id);
                var children = treeChildrenMap_1.get(mainRoot_1.id) || [];
                var N = children.length;
                if (N > 0) {
                    var angleStep_2 = (Math.PI * 2) / N;
                    var orbitRotationOffset_1 = 0.2; // 약간 경사진 느낌을 주기 위한 오프셋
                    children.forEach(function (childId, idx) {
                        var childNode = nodeMap.get(childId);
                        if (childNode) {
                            var childAngle = (idx * angleStep_2) + orbitRotationOffset_1;
                            layoutOrbitNode_1(childId, mainRoot_1, childAngle);
                        }
                    });
                }
            }
            var orphanRoots = roots.slice(1);
            var orphanCount = orphanRoots.length;
            if (orphanCount > 0) {
                var angleStep_3 = (Math.PI * 2) / orphanCount;
                orphanRoots.forEach(function (root, idx) {
                    var rootNode = nodeMap.get(root.id);
                    if (rootNode) {
                        var assignedAngle = idx * angleStep_3;
                        layoutOrbitNode_1(root.id, null, assignedAngle);
                    }
                });
            }
            // Build spanning tree edge set for fast O(1) rendering lookups
            var spanningTreeEdgeSet_1 = new Set();
            treeChildrenMap_1.forEach(function (children, parentId) {
                for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                    var childId = children_1[_i];
                    spanningTreeEdgeSet_1.add("".concat(parentId, "|||").concat(childId));
                    spanningTreeEdgeSet_1.add("".concat(childId, "|||").concat(parentId));
                }
            });
            OntologyLayout.lastSpanningTreeEdgeSet = spanningTreeEdgeSet_1;
            // Mark which nodes are topologically visible
            for (var _10 = 0, nodes_1 = nodes; _10 < nodes_1.length; _10++) {
                var node = nodes_1[_10];
                node.topoHidden = !visibleNodes_1.has(node.id);
            }
        }
        else {
            // Fast-path: 토폴로지가 변하지 않는 동안 공전 및 LERP 모핑을 지원하기 위한 targetWorldX/Y 최신화
            for (var _11 = 0, nodes_2 = nodes; _11 < nodes_2.length; _11++) {
                var node = nodes_2[_11];
                if (node.orbitIndex === 0) {
                    node.targetWorldX = 0;
                    node.targetWorldY = 0;
                }
                else if (!isOrbiting && node.fixedX !== undefined && node.fixedX !== null && node.fixedY !== undefined && node.fixedY !== null) {
                    node.targetWorldX = node.fixedX;
                    node.targetWorldY = node.fixedY;
                    node.worldX = node.fixedX;
                    node.worldY = node.fixedY;
                }
                else if (node.orbitIndex !== undefined && node.orbitAngle !== undefined) {
                    var cosS = (_b = node.cosSpeed) !== null && _b !== void 0 ? _b : Math.cos((_c = node.orbitSpeed) !== null && _c !== void 0 ? _c : 0);
                    var sinS = (_d = node.sinSpeed) !== null && _d !== void 0 ? _d : Math.sin((_e = node.orbitSpeed) !== null && _e !== void 0 ? _e : 0);
                    if (isOrbiting && node.orbitCos !== undefined && node.orbitSin !== undefined) {
                        // Rotate unit vector
                        var nextCos = node.orbitCos * cosS - node.orbitSin * sinS;
                        var nextSin = node.orbitCos * sinS + node.orbitSin * cosS;
                        // Renormalize using Taylor series fast-path + drift correction
                        var d = nextCos * nextCos + nextSin * nextSin;
                        node._renormFrame = (node._renormFrame || 0) + 1;
                        if (node._renormFrame >= 120 || d < 0.999 || d > 1.001) {
                            node._renormFrame = 0;
                            var len = Math.sqrt(d);
                            node.orbitCos = nextCos / (len || 0.1);
                            node.orbitSin = nextSin / (len || 0.1);
                        }
                        else {
                            var invLen = 1.5 - 0.5 * d; // Taylor series approximation around x = 1
                            node.orbitCos = nextCos * invLen;
                            node.orbitSin = nextSin * invLen;
                        }
                        // Map back to coordinates using exact radius
                        var rOffset = (_f = node.radialOffset) !== null && _f !== void 0 ? _f : 0;
                        var R = OntologyLayout.getOrbitRadius(node.orbitIndex) + rOffset;
                        node.targetWorldX = R * node.orbitCos * exports.ELLIPSE_RATIO;
                        node.targetWorldY = R * node.orbitSin;
                    }
                    else {
                        // 비공전 중이거나 초기화 상태일 때는 삼각함수로 위치 확정
                        if (node.targetWorldX === undefined || node.targetWorldY === undefined || isNaN(node.targetWorldX) || isNaN(node.targetWorldY)) {
                            var rOffset = (_g = node.radialOffset) !== null && _g !== void 0 ? _g : 0;
                            var R = OntologyLayout.getOrbitRadius(node.orbitIndex) + rOffset;
                            node.targetWorldX = R * Math.cos(node.orbitAngle) * exports.ELLIPSE_RATIO;
                            node.targetWorldY = R * Math.sin(node.orbitAngle);
                        }
                    }
                }
            }
        }
        // 6. Camera 변환 (World -> Screen - 3D Perspective Projection 복원)
        var cx = canvasW / 2 + cameraOffsetX;
        var cy = canvasH / 2 + cameraOffsetY;
        var cosTilt = OntologyLayout.cosTilt;
        var sinTilt = OntologyLayout.sinTilt;
        var cameraDist = 800; // 3D 원근 기준 거리
        for (var _12 = 0, nodes_3 = nodes; _12 < nodes_3.length; _12++) {
            var node = nodes_3[_12];
            var effectiveLayer = (_h = node.effectiveLayer) !== null && _h !== void 0 ? _h : 3;
            var risk = (_j = node.riskFactor) !== null && _j !== void 0 ? _j : 0;
            var isRiskOrigin = node.group === 'SYSTEM_RISK';
            var isRiskAffected = risk > 0.3;
            var isRiskHigh = isRiskOrigin || isRiskAffected;
            var isFiltered = false;
            if (OntologyLayout.filterLayers && !OntologyLayout.filterLayers.has(effectiveLayer)) {
                isFiltered = true;
            }
            if (OntologyLayout.filterGroups && OntologyLayout.filterGroups.size > 0 && !OntologyLayout.filterGroups.has(node.group)) {
                isFiltered = true;
            }
            if (OntologyLayout.filterRiskOnly && !isRiskHigh) {
                isFiltered = true;
            }
            // 레이어 필터 또는 계층 접힘에 의해 최종적으로 숨김 여부 설정
            node.layoutHidden = node.topoHidden || isFiltered;
            if (node.layoutHidden) {
                node.renderX = -999999;
                node.renderY = -999999;
                continue;
            }
            if (!isOrbiting && node.fixedX !== undefined && node.fixedX !== null && node.fixedY !== undefined && node.fixedY !== null) {
                node.worldX = node.fixedX;
                node.worldY = node.fixedY;
            }
            if (node.worldX === undefined || isNaN(node.worldX)) {
                node.worldX = (_k = node.targetWorldX) !== null && _k !== void 0 ? _k : 0;
            }
            if (node.worldY === undefined || isNaN(node.worldY)) {
                node.worldY = (_l = node.targetWorldY) !== null && _l !== void 0 ? _l : 0;
            }
            var worldX = (_m = node.worldX) !== null && _m !== void 0 ? _m : 0;
            var worldY = (_o = node.worldY) !== null && _o !== void 0 ? _o : 0;
            // 3D 조감도 원근 변환 적용
            var h = effectiveLayer * OntologyLayout.LAYER_GAP;
            var rotatedY = worldY * cosTilt - h * sinTilt;
            var depth = -worldY * sinTilt + h * cosTilt;
            var perspectiveScale = Math.max(0.05, cameraDist / Math.max(120, cameraDist + depth));
            node.renderX = cx + worldX * zoom * perspectiveScale;
            node.renderY = cy + rotatedY * zoom * perspectiveScale;
            node.renderZ = depth;
            node.perspectiveScale = perspectiveScale;
            node.nodeRadius = 24 * perspectiveScale;
            // Calculate and cache collision properties on the node itself:
            var weight = (_p = node.renderSize) !== null && _p !== void 0 ? _p : 0.5;
            var sizeFactor = 0.8 + 0.5 * weight;
            var scale = perspectiveScale * sizeFactor;
            var textW = (node.label || '').length * 7.5;
            if (node._cachedTextWidth) {
                var cache = node._cachedTextWidth;
                textW = cache['600'] || cache['500'] || textW;
            }
            node._collisionW = Math.max(60 * scale, textW * scale + 28 * scale) + 16 * scale;
            node._collisionH = Math.max(28 * scale, 12 * scale + 20 * scale) + 12 * scale;
            node._isCollisionFixed = (!isOrbiting && node.fixedX !== undefined && node.fixedX !== null && node.fixedY !== undefined && node.fixedY !== null) || node.orbitIndex === 0;
        }
        // 7. Screen-Space Collision Resolution (2D 화면 공간 충돌 방지 루프 복원)
        // 💡 노드들이 튕기고 흔들리는 물리적 요동(Jittering)을 박멸하기 위해 공전 중이 아닐 때만 충돌 방지 루프를 가동합니다.
        var shouldRunCollision = !isOrbiting && (recomputeWorldPositions || isDragging);
        var maxIterations = 0;
        if (shouldRunCollision) {
            if (isInteractive) {
                maxIterations = 5;
                var fps = PerformanceProfiler_1.PerformanceProfiler.getInstance().getMetrics().fps;
                if (fps > 0) {
                    if (fps < 40) {
                        maxIterations = 1;
                    }
                    else if (fps < 50) {
                        maxIterations = 2;
                    }
                }
            }
        }
        if (maxIterations > 0) {
            // Clear the pre-allocated static collisionGroups:
            for (var k = 0; k < 4; k++) {
                OntologyLayout.collisionGroups[k].length = 0;
            }
            // Populate collisionGroups using direct loop (no filter, no map, no array allocations):
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                if (!node.layoutHidden &&
                    node.renderX !== -999999 &&
                    node.renderX >= -exports.CULL_MARGIN &&
                    node.renderX <= canvasW + exports.CULL_MARGIN &&
                    node.renderY >= -exports.CULL_MARGIN &&
                    node.renderY <= canvasH + exports.CULL_MARGIN) {
                    var layer = (_q = node.effectiveLayer) !== null && _q !== void 0 ? _q : 3;
                    // Ensure layer is clamped to 0..3 to avoid index out of bounds
                    var layerIdx = Math.max(0, Math.min(3, layer));
                    OntologyLayout.collisionGroups[layerIdx].push(node);
                }
            }
            for (var k = 0; k < 4; k++) {
                var group = OntologyLayout.collisionGroups[k];
                var groupLen = group.length;
                if (groupLen === 0)
                    continue;
                var iterationDamping = 0.025;
                for (var iter = 0; iter < maxIterations; iter++) {
                    iterationDamping *= 0.80;
                    var hasOverlap = false;
                    for (var i = 0; i < groupLen; i++) {
                        var nodeA = group[i];
                        var wA = nodeA._collisionW;
                        var hA = nodeA._collisionH;
                        var isFixedA = nodeA._isCollisionFixed;
                        for (var j = i + 1; j < groupLen; j++) {
                            var nodeB = group[j];
                            var wB = nodeB._collisionW;
                            var hB = nodeB._collisionH;
                            var isFixedB = nodeB._isCollisionFixed;
                            // 두 노드 겹침 확인
                            var dx = nodeB.renderX - nodeA.renderX;
                            var dy = nodeB.renderY - nodeA.renderY;
                            var minDistX = (wA + wB) / 2;
                            var minDistY = (hA + hB) / 2;
                            var absDx = Math.abs(dx);
                            var absDy = Math.abs(dy);
                            var overlapX = minDistX - absDx;
                            var overlapY = minDistY - absDy;
                            if (overlapX <= 0 || overlapY <= 0) {
                                continue;
                            }
                            var overlap = Math.min(overlapX, overlapY);
                            if (overlap < 0.8) {
                                continue; // Ignore overlaps below 0.8px
                            }
                            hasOverlap = true;
                            var angleDiff = (nodeB.orbitAngle || 0) - (nodeA.orbitAngle || 0);
                            while (angleDiff < -Math.PI)
                                angleDiff += Math.PI * 2;
                            while (angleDiff > Math.PI)
                                angleDiff -= Math.PI * 2;
                            var radiusA = OntologyLayout.getOrbitRadius(nodeA.orbitIndex || 1);
                            var rawPushAngle = (overlap / Math.max(50, radiusA)) * iterationDamping;
                            var pushAngle = Math.min(0.005, rawPushAngle);
                            var direction = angleDiff >= 0 ? 1 : -1;
                            // compute dTheta for nodeA and nodeB
                            var dThetaA = 0;
                            var dThetaB = 0;
                            if (!isFixedA && !isFixedB) {
                                dThetaA = -pushAngle * 0.5 * direction;
                                dThetaB = pushAngle * 0.5 * direction;
                            }
                            else if (isFixedA && !isFixedB) {
                                dThetaB = pushAngle * direction;
                            }
                            else if (!isFixedA && isFixedB) {
                                dThetaA = -pushAngle * direction;
                            }
                            if (dThetaA !== 0) {
                                nodeA.orbitAngle = (nodeA.orbitAngle || 0) + dThetaA;
                                if (!isFixedA && nodeA.minAngle !== undefined) {
                                    nodeA.orbitAngle = Math.max(nodeA.minAngle, Math.min((_r = nodeA.maxAngle) !== null && _r !== void 0 ? _r : 0, nodeA.orbitAngle));
                                }
                                // Taylor-series approximation for nodeA unit vector
                                var cosDA = 1 - dThetaA * dThetaA * 0.5;
                                var sinDA = dThetaA;
                                var prevCosA = (_s = nodeA.orbitCos) !== null && _s !== void 0 ? _s : Math.cos(nodeA.orbitAngle - dThetaA);
                                var prevSinA = (_t = nodeA.orbitSin) !== null && _t !== void 0 ? _t : Math.sin(nodeA.orbitAngle - dThetaA);
                                var nextCosA = prevCosA * cosDA - prevSinA * sinDA;
                                var nextSinA = prevCosA * sinDA + prevSinA * cosDA;
                                var lenA = Math.sqrt(nextCosA * nextCosA + nextSinA * nextSinA);
                                nodeA.orbitCos = nextCosA / (lenA || 0.1);
                                nodeA.orbitSin = nextSinA / (lenA || 0.1);
                            }
                            if (dThetaB !== 0) {
                                nodeB.orbitAngle = (nodeB.orbitAngle || 0) + dThetaB;
                                if (!isFixedB && nodeB.minAngle !== undefined) {
                                    nodeB.orbitAngle = Math.max(nodeB.minAngle, Math.min((_u = nodeB.maxAngle) !== null && _u !== void 0 ? _u : 0, nodeB.orbitAngle));
                                }
                                // Taylor-series approximation for nodeB unit vector
                                var cosDB = 1 - dThetaB * dThetaB * 0.5;
                                var sinDB = dThetaB;
                                var prevCosB = (_v = nodeB.orbitCos) !== null && _v !== void 0 ? _v : Math.cos(nodeB.orbitAngle - dThetaB);
                                var prevSinB = (_w = nodeB.orbitSin) !== null && _w !== void 0 ? _w : Math.sin(nodeB.orbitAngle - dThetaB);
                                var nextCosB = prevCosB * cosDB - prevSinB * sinDB;
                                var nextSinB = prevCosB * sinDB + prevSinB * cosDB;
                                var lenB = Math.sqrt(nextCosB * nextCosB + nextSinB * nextSinB);
                                nodeB.orbitCos = nextCosB / (lenB || 0.1);
                                nodeB.orbitSin = nextSinB / (lenB || 0.1);
                            }
                            // 동일 궤도상 노드들 간 겹침 시 지그재그 반경 오프셋 적용
                            if (nodeA.orbitIndex === nodeB.orbitIndex && nodeA.orbitIndex > 0) {
                                var rawOverlap = overlap;
                                if (rawOverlap > 0) {
                                    var maxOffset = 45;
                                    if (!isFixedA) {
                                        nodeA.radialOffset = ((_x = nodeA.radialOffset) !== null && _x !== void 0 ? _x : 0) - rawOverlap * 0.05;
                                        nodeA.radialOffset = Math.max(-maxOffset, Math.min(maxOffset, nodeA.radialOffset));
                                    }
                                    if (!isFixedB) {
                                        nodeB.radialOffset = ((_y = nodeB.radialOffset) !== null && _y !== void 0 ? _y : 0) + rawOverlap * 0.05;
                                        nodeB.radialOffset = Math.max(-maxOffset, Math.min(maxOffset, nodeB.radialOffset));
                                    }
                                }
                            }
                            // worldX, worldY 즉시 싱크
                            if (nodeA.orbitIndex !== 0) {
                                var radiusA_1 = OntologyLayout.getOrbitRadius(nodeA.orbitIndex || 1);
                                var rOffsetA = (_z = nodeA.radialOffset) !== null && _z !== void 0 ? _z : 0;
                                nodeA.targetWorldX = (radiusA_1 + rOffsetA) * ((_0 = nodeA.orbitCos) !== null && _0 !== void 0 ? _0 : Math.cos(nodeA.orbitAngle)) * exports.ELLIPSE_RATIO;
                                nodeA.targetWorldY = (radiusA_1 + rOffsetA) * ((_1 = nodeA.orbitSin) !== null && _1 !== void 0 ? _1 : Math.sin(nodeA.orbitAngle));
                                nodeA.worldX = nodeA.targetWorldX;
                                nodeA.worldY = nodeA.targetWorldY;
                            }
                            else {
                                nodeA.targetWorldX = 0;
                                nodeA.targetWorldY = 0;
                                nodeA.worldX = 0;
                                nodeA.worldY = 0;
                            }
                            if (nodeB.orbitIndex !== 0) {
                                var radiusB = OntologyLayout.getOrbitRadius(nodeB.orbitIndex || 1);
                                var rOffsetB = (_2 = nodeB.radialOffset) !== null && _2 !== void 0 ? _2 : 0;
                                nodeB.targetWorldX = (radiusB + rOffsetB) * ((_3 = nodeB.orbitCos) !== null && _3 !== void 0 ? _3 : Math.cos(nodeB.orbitAngle)) * exports.ELLIPSE_RATIO;
                                nodeB.targetWorldY = (radiusB + rOffsetB) * ((_4 = nodeB.orbitSin) !== null && _4 !== void 0 ? _4 : Math.sin(nodeB.orbitAngle));
                                nodeB.worldX = nodeB.targetWorldX;
                                nodeB.worldY = nodeB.targetWorldY;
                            }
                            else {
                                nodeB.targetWorldX = 0;
                                nodeB.targetWorldY = 0;
                                nodeB.worldX = 0;
                                nodeB.worldY = 0;
                            }
                            // 2D 스크린 투영 좌표 즉시 갱신
                            var cosT = OntologyLayout.cosTilt;
                            var sinT = OntologyLayout.sinTilt;
                            var rotYA = nodeA.worldY * cosT;
                            var depthA = -nodeA.worldY * sinT;
                            var scaleA = cameraDist / (cameraDist + depthA);
                            nodeA.renderX = cx + nodeA.worldX * zoom * scaleA;
                            nodeA.renderY = cy + rotYA * zoom * scaleA;
                            nodeA.perspectiveScale = scaleA;
                            var rotYB = nodeB.worldY * cosT;
                            var depthB = -nodeB.worldY * sinT;
                            var scaleB = cameraDist / (cameraDist + depthB);
                            nodeB.renderX = cx + nodeB.worldX * zoom * scaleB;
                            nodeB.renderY = cy + rotYB * zoom * scaleB;
                            nodeB.perspectiveScale = scaleB;
                        }
                    }
                    if (!hasOverlap)
                        break;
                }
            }
        }
    };
    OntologyLayout.LAYER_GAP = 65;
    OntologyLayout.tiltAngle = 42 * Math.PI / 180;
    OntologyLayout.cosTilt = Math.cos(42 * Math.PI / 180);
    OntologyLayout.sinTilt = Math.sin(42 * Math.PI / 180);
    OntologyLayout.filterLayers = new Set([0, 1, 2, 3]);
    OntologyLayout.filterGroups = new Set();
    OntologyLayout.filterRiskOnly = false;
    OntologyLayout.lastTreeChildrenMap = new Map();
    OntologyLayout.lastSpanningTreeEdgeSet = new Set();
    OntologyLayout.dynamicRules = null;
    OntologyLayout.totalNodesCount = 0;
    OntologyLayout.collisionGroups = [[], [], [], []];
    return OntologyLayout;
}());
exports.OntologyLayout = OntologyLayout;
