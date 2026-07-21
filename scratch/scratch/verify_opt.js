"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var OntologyLayout_1 = require("../src/lib/engine/OntologyLayout");
// ==========================================
// Mocks for Dom / Browser globals since this runs under node
// ==========================================
global.window = {};
global.document = {
    createElement: function () { return ({
        getContext: function () { return ({}); },
        width: 0,
        height: 0
    }); }
};
// ==========================================
// 1. Spatial Grid Logic copy from OntologyRenderer.ts
// ==========================================
var SpatialGridTest = /** @class */ (function () {
    function SpatialGridTest() {
    }
    SpatialGridTest.addBoxToGrid = function (box, gridCellSize) {
        var colStart = Math.floor(box.x1 / gridCellSize);
        var colEnd = Math.floor(box.x2 / gridCellSize);
        var rowStart = Math.floor(box.y1 / gridCellSize);
        var rowEnd = Math.floor(box.y2 / gridCellSize);
        for (var r = rowStart; r <= rowEnd; r++) {
            for (var c = colStart; c <= colEnd; c++) {
                var key = ((r + 32768) << 16) | (c + 32768);
                var arr = SpatialGridTest.spatialGrid.get(key);
                if (!arr) {
                    if (SpatialGridTest.cellArrayPoolUsed < SpatialGridTest.cellArrayPool.length) {
                        arr = SpatialGridTest.cellArrayPool[SpatialGridTest.cellArrayPoolUsed++];
                        arr.length = 0;
                    }
                    else {
                        arr = [];
                        SpatialGridTest.cellArrayPool.push(arr);
                        SpatialGridTest.cellArrayPoolUsed++;
                    }
                    SpatialGridTest.spatialGrid.set(key, arr);
                }
                arr.push(box);
            }
        }
    };
    SpatialGridTest.checkOverlapWithGrid = function (rect, gridCellSize) {
        var colStart = Math.floor(rect.x1 / gridCellSize);
        var colEnd = Math.floor(rect.x2 / gridCellSize);
        var rowStart = Math.floor(rect.y1 / gridCellSize);
        var rowEnd = Math.floor(rect.y2 / gridCellSize);
        for (var r = rowStart; r <= rowEnd; r++) {
            for (var c = colStart; c <= colEnd; c++) {
                var key = ((r + 32768) << 16) | (c + 32768);
                var boxes = SpatialGridTest.spatialGrid.get(key);
                if (boxes) {
                    for (var i = 0; i < boxes.length; i++) {
                        var box = boxes[i];
                        if (!(rect.x2 < box.x1 || rect.x1 > box.x2 || rect.y2 < box.y1 || rect.y1 > box.y2)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    };
    SpatialGridTest.reset = function () {
        SpatialGridTest.spatialGrid.clear();
        SpatialGridTest.cellArrayPoolUsed = 0;
    };
    SpatialGridTest.spatialGrid = new Map();
    SpatialGridTest.cellArrayPool = [];
    SpatialGridTest.cellArrayPoolUsed = 0;
    return SpatialGridTest;
}());
// Helper to generate hash key
function getGridKey(r, c) {
    return ((r + 32768) << 16) | (c + 32768);
}
function createMockNode(id, group, parentId, layerId) {
    return {
        id: id,
        label: "Label for ".concat(id),
        group: group,
        baseValue: 50,
        parentId: parentId,
        layerId: layerId,
        orbitIndex: parentId ? 1 : 0,
        orbitAngle: 0,
        orbitSpeed: 0.0006,
        renderX: 0,
        renderY: 0,
        renderZ: 0,
        connectionToCenter: 1,
        nodeRadius: 10
    };
}
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var rMin, rMax, cMin, cMax, testedKeys, collisions, totalTested, boundaryCoords, edgeCoords, _i, edgeCoords_1, r, _a, edgeCoords_2, c, _b, boundaryCoords_1, _c, r, c, key, i, r, c, key, decodedC, decodedR, gridCellSize, box1, box2, overlap2, box3, overlap3, box4, overlap4, box5, overlap5, box6, overlap6, overlapErrors, i, x, y, poolSizeAfterWarmup, poolUsedAfterWarmup, i, x, y, poolSizeAfterReuse, poolUsedAfterReuse, poolErrors, i, arr, mockNodes, nodeMap, rootNode, i, parentId, layerId, node, mockEdges, iterations, startTime, successCount, errorMsg, it_1, recompute, orbiting, dragging, duration, computeErrors, collisionGroups, k, _d, _e, node, layer, clampedLayer;
        var _f;
        return __generator(this, function (_g) {
            console.log("=== STARTING OPTIMIZATION VERIFICATION HARNESS ===");
            // ==========================================
            // Test 1: Spatial Grid Key Collisions
            // ==========================================
            console.log("\n--- TEST 1: Spatial Grid Key Uniqueness (Collision Check) ---");
            rMin = -2000, rMax = 2000;
            cMin = -2000, cMax = 2000;
            testedKeys = new Set();
            collisions = 0;
            totalTested = 0;
            boundaryCoords = [];
            edgeCoords = [-32768, -32767, -2000, -1, 0, 1, 2000, 32767];
            for (_i = 0, edgeCoords_1 = edgeCoords; _i < edgeCoords_1.length; _i++) {
                r = edgeCoords_1[_i];
                for (_a = 0, edgeCoords_2 = edgeCoords; _a < edgeCoords_2.length; _a++) {
                    c = edgeCoords_2[_a];
                    boundaryCoords.push([r, c]);
                }
            }
            for (_b = 0, boundaryCoords_1 = boundaryCoords; _b < boundaryCoords_1.length; _b++) {
                _c = boundaryCoords_1[_b], r = _c[0], c = _c[1];
                key = getGridKey(r, c);
                if (testedKeys.has(key)) {
                    collisions++;
                    console.error("COLLISION DETECTED for boundary: (".concat(r, ", ").concat(c, ")"));
                }
                testedKeys.add(key);
                totalTested++;
            }
            // Test random coordinates within range
            for (i = 0; i < 500000; i++) {
                r = Math.floor(Math.random() * (rMax - rMin + 1)) + rMin;
                c = Math.floor(Math.random() * (cMax - cMin + 1)) + cMin;
                key = getGridKey(r, c);
                decodedC = (key & 0xFFFF) - 32768;
                decodedR = (key >> 16) - 32768;
                if (decodedR !== r || decodedC !== c) {
                    collisions++;
                    console.error("COLLISION/RECOVERY ERROR for: (".concat(r, ", ").concat(c, ") decoded as (").concat(decodedR, ", ").concat(decodedC, "), key: ").concat(key));
                }
                totalTested++;
            }
            if (collisions === 0) {
                console.log("[PASS] Verified ".concat(totalTested, " key mapping pairs. 0 collisions detected. Reverse mapping is bijective."));
            }
            else {
                console.error("[FAIL] ".concat(collisions, " collisions or decoding errors detected!"));
                process.exit(1);
            }
            // ==========================================
            // Test 2: Overlap Detection Correctness
            // ==========================================
            console.log("\n--- TEST 2: Overlap Detection Correctness ---");
            SpatialGridTest.reset();
            gridCellSize = 100;
            box1 = { x1: 150, y1: 150, x2: 250, y2: 250 };
            SpatialGridTest.addBoxToGrid(box1, gridCellSize);
            box2 = { x1: 160, y1: 160, x2: 240, y2: 240 };
            overlap2 = SpatialGridTest.checkOverlapWithGrid(box2, gridCellSize);
            box3 = { x1: 240, y1: 240, x2: 300, y2: 300 };
            overlap3 = SpatialGridTest.checkOverlapWithGrid(box3, gridCellSize);
            box4 = { x1: 100, y1: 200, x2: 200, y2: 210 };
            overlap4 = SpatialGridTest.checkOverlapWithGrid(box4, gridCellSize);
            box5 = { x1: 251, y1: 251, x2: 300, y2: 300 };
            overlap5 = SpatialGridTest.checkOverlapWithGrid(box5, gridCellSize);
            box6 = { x1: -100, y1: -100, x2: 0, y2: 0 };
            overlap6 = SpatialGridTest.checkOverlapWithGrid(box6, gridCellSize);
            overlapErrors = 0;
            if (!overlap2) {
                overlapErrors++;
                console.error("Error: Failed to detect complete overlap.");
            }
            if (!overlap3) {
                overlapErrors++;
                console.error("Error: Failed to detect corner overlap.");
            }
            if (!overlap4) {
                overlapErrors++;
                console.error("Error: Failed to detect edge overlap.");
            }
            if (overlap5) {
                overlapErrors++;
                console.error("Error: False positive on adjacent non-overlapping box.");
            }
            if (overlap6) {
                overlapErrors++;
                console.error("Error: False positive on far away non-overlapping box.");
            }
            if (overlapErrors === 0) {
                console.log("[PASS] Overlap detection behaves correctly for all tested cases.");
            }
            else {
                console.error("[FAIL] ".concat(overlapErrors, " overlap detection errors found."));
                process.exit(1);
            }
            // ==========================================
            // Test 3: cellArrayPool under load (Dynamic allocation & reuse)
            // ==========================================
            console.log("\n--- TEST 3: cellArrayPool Under Load & Reuse ---");
            SpatialGridTest.reset();
            // Warm up: Add 1000 boxes to 1000 different cells
            for (i = 0; i < 1000; i++) {
                x = i * 150;
                y = i * 150;
                SpatialGridTest.addBoxToGrid({ x1: x, y1: y, x2: x + 10, y2: y + 10 }, gridCellSize);
            }
            poolSizeAfterWarmup = SpatialGridTest.cellArrayPool.length;
            poolUsedAfterWarmup = SpatialGridTest.cellArrayPoolUsed;
            console.log("After inserting 1000 boxes:");
            console.log("  - cellArrayPool size: ".concat(poolSizeAfterWarmup));
            console.log("  - cellArrayPoolUsed: ".concat(poolUsedAfterWarmup));
            // Frame transition: clear spatial grid, reset pool pointer
            SpatialGridTest.reset();
            // Re-insert 1000 boxes to different cells
            for (i = 0; i < 1000; i++) {
                x = i * 150;
                y = i * 150;
                SpatialGridTest.addBoxToGrid({ x1: x, y1: y, x2: x + 10, y2: y + 10 }, gridCellSize);
            }
            poolSizeAfterReuse = SpatialGridTest.cellArrayPool.length;
            poolUsedAfterReuse = SpatialGridTest.cellArrayPoolUsed;
            console.log("After second frame insertion of 1000 boxes (expecting reuse):");
            console.log("  - cellArrayPool size: ".concat(poolSizeAfterReuse));
            console.log("  - cellArrayPoolUsed: ".concat(poolUsedAfterReuse));
            poolErrors = 0;
            if (poolSizeAfterReuse > poolSizeAfterWarmup) {
                poolErrors++;
                console.error("Error: Pool size grew from ".concat(poolSizeAfterWarmup, " to ").concat(poolSizeAfterReuse, " instead of reusing arrays."));
            }
            if (poolUsedAfterReuse !== poolUsedAfterWarmup) {
                poolErrors++;
                console.error("Error: Pool utilization mismatch. Expected ".concat(poolUsedAfterWarmup, ", got ").concat(poolUsedAfterReuse, "."));
            }
            // Verify that reusing an array clears its length
            for (i = 0; i < SpatialGridTest.cellArrayPool.length; i++) {
                arr = SpatialGridTest.cellArrayPool[i];
                if (i < SpatialGridTest.cellArrayPoolUsed) {
                    if (arr.length !== 1) {
                        poolErrors++;
                        console.error("Error: Reused array at index ".concat(i, " has length ").concat(arr.length, " instead of 1."));
                    }
                }
            }
            if (poolErrors === 0) {
                console.log("[PASS] Array pooling behaves correctly. Pool size is capped, and arrays are reset on reuse.");
            }
            else {
                console.error("[FAIL] Array pooling errors detected!");
                process.exit(1);
            }
            // ==========================================
            // Test 4: computePositions grouping and safety
            // ==========================================
            console.log("\n--- TEST 4: computePositions Grouping & Memory Safety ---");
            mockNodes = [];
            nodeMap = new Map();
            rootNode = createMockNode('root-HCHPS', 'CORE_PROJECT');
            rootNode.centralityScore = 9999999;
            rootNode.effectiveLayer = 0;
            mockNodes.push(rootNode);
            nodeMap.set(rootNode.id, rootNode);
            // Add 1st, 2nd, 3rd tier nodes
            for (i = 1; i <= 59; i++) {
                parentId = 'root-HCHPS';
                layerId = 1;
                if (i > 15 && i <= 35) {
                    parentId = "node-".concat(i - 10);
                    layerId = 2;
                }
                else if (i > 35) {
                    parentId = "node-".concat(i - 20);
                    layerId = 3;
                }
                node = createMockNode("node-".concat(i), i % 5 === 0 ? 'SYSTEM_RISK' : (i % 3 === 0 ? 'MACRO_RESEARCH' : 'CORE_PROJECT'), parentId, layerId);
                mockNodes.push(node);
                nodeMap.set(node.id, node);
            }
            mockEdges = [];
            mockNodes.forEach(function (node) {
                if (node.parentId) {
                    mockEdges.push({
                        source: node.parentId,
                        target: node.id,
                        type: 'DEPENDENCY',
                        weight: 1.0
                    });
                }
            });
            iterations = 1000;
            console.log("Running OntologyLayout.computePositions under load for ".concat(iterations, " iterations..."));
            startTime = Date.now();
            successCount = 0;
            errorMsg = '';
            try {
                for (it_1 = 0; it_1 < iterations; it_1++) {
                    recompute = it_1 === 0 || it_1 % 20 === 0;
                    orbiting = it_1 % 2 === 0;
                    dragging = it_1 % 3 === 0;
                    OntologyLayout_1.OntologyLayout.computePositions(mockNodes, nodeMap, mockEdges, 1200, // canvasW
                    800, // canvasH
                    0, // cameraOffsetX
                    0, // cameraOffsetY
                    1.0, // zoom
                    new Set(), // collapsedNodeIds
                    undefined, // activeLayers
                    true, // isInteractive
                    recompute, // recomputeWorldPositions
                    orbiting, // isOrbiting
                    dragging // isDragging
                    );
                    successCount++;
                }
            }
            catch (err) {
                errorMsg = err.message || String(err);
                console.error("Crash inside computePositions: ".concat(errorMsg));
            }
            duration = Date.now() - startTime;
            console.log("Completed ".concat(successCount, "/").concat(iterations, " layout loops in ").concat(duration, "ms."));
            computeErrors = 0;
            if (successCount !== iterations) {
                computeErrors++;
                console.error("Error: computePositions crashed. Success rate: ".concat(successCount, "/").concat(iterations));
            }
            collisionGroups = OntologyLayout_1.OntologyLayout.collisionGroups;
            if (collisionGroups) {
                console.log("Collision Groups sizes:");
                for (k = 0; k < collisionGroups.length; k++) {
                    console.log("  - Group ".concat(k, " size: ").concat(collisionGroups[k].length));
                    for (_d = 0, _e = collisionGroups[k]; _d < _e.length; _d++) {
                        node = _e[_d];
                        if (node.layoutHidden) {
                            computeErrors++;
                            console.error("Error: Hidden node ".concat(node.id, " is present in collision group ").concat(k, "."));
                        }
                        layer = (_f = node.effectiveLayer) !== null && _f !== void 0 ? _f : 3;
                        clampedLayer = Math.max(0, Math.min(3, layer));
                        if (clampedLayer !== k) {
                            computeErrors++;
                            console.error("Error: Node ".concat(node.id, " with clamped layer ").concat(clampedLayer, " placed in group ").concat(k, "."));
                        }
                    }
                }
            }
            else {
                computeErrors++;
                console.error("Error: OntologyLayout.collisionGroups is not defined or accessible.");
            }
            if (computeErrors === 0) {
                console.log("[PASS] computePositions executed successfully. Correct grouping, zero crashes, and fast execution.");
            }
            else {
                console.error("[FAIL] computePositions verification failed with ".concat(computeErrors, " errors."));
                process.exit(1);
            }
            console.log("\n=== ALL HARNESS VERIFICATIONS PASSED SUCCESSFULLY! ===");
            return [2 /*return*/];
        });
    });
}
runTests().catch(function (err) {
    console.error("Harness failed with uncaught exception:", err);
    process.exit(1);
});
