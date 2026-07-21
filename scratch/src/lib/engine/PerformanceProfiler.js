"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceProfiler = void 0;
/**
 * Performance Profiler for Canvas 2D Rendering
 * Decoupled from React to minimize profiling overhead.
 */
var PerformanceProfiler = /** @class */ (function () {
    function PerformanceProfiler() {
        // Metrics
        this.renderDurations = [];
        this.maxDuration = 0;
        this.warningCount = 0;
        this.totalRenders = 0;
        this.lagSpikes = [];
        // FPS tracking
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.currentFps = 0;
        // Last render duration
        this.lastDuration = 0;
        // Detailed breakdown of the last frame (in ms)
        this.lastPhysics = 0;
        this.lastLayout = 0;
        this.lastBackground = 0;
        this.lastEdges = 0;
        this.lastNodes = 0;
        this.lastFpsTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
    PerformanceProfiler.getInstance = function () {
        if (!PerformanceProfiler.instance) {
            PerformanceProfiler.instance = new PerformanceProfiler();
        }
        return PerformanceProfiler.instance;
    };
    /**
     * Records a single render execution duration in milliseconds.
     */
    PerformanceProfiler.prototype.recordRender = function (duration) {
        this.totalRenders++;
        this.lastDuration = duration;
        // Add to rolling buffer (max 60 samples)
        this.renderDurations.push(duration);
        if (this.renderDurations.length > 60) {
            this.renderDurations.shift();
        }
        // Track peak latency
        if (duration > this.maxDuration) {
            this.maxDuration = duration;
        }
        // 33.33ms (30fps threshold) is the practical interactive limit for complex 2D Canvas animations.
        // Setting this to 33.33ms to avoid console warning flooding, which itself harms browser runtime performance.
        if (duration > 33.33) {
            this.warningCount++;
            console.warn("[PERF ALERT] Rendering frame took ".concat(duration.toFixed(2), "ms (Threshold: 33.33ms)"));
        }
    };
    /**
     * Tracks animation loop ticks to calculate FPS.
     * Call this on every requestAnimationFrame iteration.
     */
    PerformanceProfiler.prototype.tick = function () {
        this.frameCount++;
        var now = performance.now();
        var elapsed = now - this.lastFpsTime;
        if (elapsed >= 1000) {
            this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
            this.frameCount = 0;
            this.lastFpsTime = now;
        }
    };
    /**
     * Retrieves the current performance report metrics.
     */
    PerformanceProfiler.prototype.getMetrics = function () {
        var sum = this.renderDurations.reduce(function (a, b) { return a + b; }, 0);
        var avg = this.renderDurations.length > 0 ? sum / this.renderDurations.length : 0;
        return {
            lastRenderTime: this.lastDuration,
            avgRenderTime: avg,
            maxRenderTime: this.maxDuration,
            warningCount: this.warningCount,
            totalRenders: this.totalRenders,
            fps: this.currentFps
        };
    };
    /**
     * Resets the accumulated max latency and warnings count.
     */
    PerformanceProfiler.prototype.resetStats = function () {
        this.maxDuration = 0;
        this.warningCount = 0;
    };
    PerformanceProfiler.prototype.recordPhysics = function (ms) { this.lastPhysics = ms; };
    PerformanceProfiler.prototype.recordLayout = function (ms) { this.lastLayout = ms; };
    PerformanceProfiler.prototype.recordBackground = function (ms) { this.lastBackground = ms; };
    PerformanceProfiler.prototype.recordEdges = function (ms) { this.lastEdges = ms; };
    PerformanceProfiler.prototype.recordNodes = function (ms) { this.lastNodes = ms; };
    PerformanceProfiler.prototype.getSpikeDiagnostic = function (totalDelta) {
        var physics = this.lastPhysics;
        var layout = this.lastLayout;
        var bg = this.lastBackground;
        var edges = this.lastEdges;
        var nodes = this.lastNodes;
        var measuredScript = physics + layout + bg + edges + nodes;
        var browserGc = Math.max(0, totalDelta - measuredScript);
        // Identify dominant factor
        var factors = [
            { name: '물리 연산 (Physics)', val: physics },
            { name: '좌표 투영 (Layout)', val: layout },
            { name: '배경 렌더 (Background)', val: bg },
            { name: '관계선 렌더 (Edges)', val: edges },
            { name: '노드/텍스트 렌더 (Nodes)', val: nodes },
            { name: '브라우저/GC 지연 (Browser/GC)', val: browserGc }
        ];
        factors.sort(function (a, b) { return b.val - a.val; });
        var primaryFactor = factors[0];
        return "".concat(totalDelta.toFixed(1), "ms [").concat(primaryFactor.name, " \uC8FC\uC6D0\uC778: ").concat(primaryFactor.val.toFixed(1), "ms]");
    };
    PerformanceProfiler.prototype.recordLagSpike = function (spike) {
        this.lagSpikes.unshift(spike);
        if (this.lagSpikes.length > 5) {
            this.lagSpikes.pop();
        }
    };
    PerformanceProfiler.prototype.getLagSpikes = function () {
        return this.lagSpikes;
    };
    PerformanceProfiler.prototype.clearLagSpikes = function () {
        this.lagSpikes = [];
    };
    PerformanceProfiler.instance = null;
    return PerformanceProfiler;
}());
exports.PerformanceProfiler = PerformanceProfiler;
