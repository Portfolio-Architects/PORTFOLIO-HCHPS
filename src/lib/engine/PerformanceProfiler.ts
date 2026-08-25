/**
 * Performance Profiler for Canvas 2D Rendering
 * Decoupled from React to minimize profiling overhead.
 */
export class PerformanceProfiler {
  private static instance: PerformanceProfiler | null = null;

  // Metrics (O(1) Ring Buffer)
  private renderDurations: Float32Array = new Float32Array(60);
  private durationCount = 0;
  private durationIndex = 0;
  private rollingSum = 0;
  private maxDuration = 0;
  private warningCount = 0;
  private totalRenders = 0;
  private lagSpikes: string[] = [];
  
  // FPS tracking
  private frameCount = 0;
  private lastFpsTime = 0;
  private currentFps = 0;

  // Last render duration
  private lastDuration = 0;

  private constructor() {
    this.lastFpsTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  public static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  // Last active tick timestamp
  private lastTickTime = 0;

  /**
   * Records a single render execution duration in milliseconds in O(1) without array reallocations.
   */
  public recordRender(duration: number): void {
    this.totalRenders++;
    this.lastDuration = duration;
    
    // Add to rolling ring buffer in O(1)
    if (this.durationCount < 60) {
      this.renderDurations[this.durationIndex] = duration;
      this.rollingSum += duration;
      this.durationCount++;
    } else {
      const oldVal = this.renderDurations[this.durationIndex];
      this.renderDurations[this.durationIndex] = duration;
      this.rollingSum += duration - oldVal;
    }
    this.durationIndex = (this.durationIndex + 1) % 60;

    // Track peak latency
    if (duration > this.maxDuration) {
      this.maxDuration = duration;
    }

    // 33.33ms (30fps threshold) is the practical interactive limit for complex 2D Canvas animations.
    // Setting this to 33.33ms to avoid console warning flooding, which itself harms browser runtime performance.
    if (duration > 33.33) {
      this.warningCount++;
      console.warn(`[PERF ALERT] Rendering frame took ${duration.toFixed(2)}ms (Threshold: 33.33ms)`);
    }
  }

  /**
   * Tracks animation loop ticks to calculate FPS.
   * Call this on every requestAnimationFrame iteration.
   */
  public tick(): void {
    this.frameCount++;
    const now = performance.now();
    this.lastTickTime = now;
    const elapsed = now - this.lastFpsTime;

    if (elapsed >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  /**
   * Retrieves the current performance report metrics in O(1).
   */
  public getMetrics() {
    const avg = this.durationCount > 0 ? this.rollingSum / this.durationCount : 0;
    
    const now = performance.now();
    const isIdle = (now - this.lastTickTime) > 1500;
    const fpsToReport = isIdle ? 60 : (this.currentFps || 60);

    return {
      lastRenderTime: isIdle ? 0 : this.lastDuration,
      avgRenderTime: isIdle ? 0 : avg,
      maxRenderTime: this.maxDuration,
      warningCount: this.warningCount,
      totalRenders: this.totalRenders,
      fps: fpsToReport,
      isIdle: isIdle
    };
  }

  /**
   * Resets the accumulated max latency and warnings count.
   */
  public resetStats(): void {
    this.maxDuration = 0;
    this.warningCount = 0;
    this.durationCount = 0;
    this.durationIndex = 0;
    this.rollingSum = 0;
    this.renderDurations.fill(0);
  }

  // Detailed breakdown of the last frame (in ms)
  private lastPhysics = 0;
  private lastLayout = 0;
  private lastBackground = 0;
  private lastEdges = 0;
  private lastNodes = 0;

  public recordPhysics(ms: number) { this.lastPhysics = ms; }
  public recordLayout(ms: number) { this.lastLayout = ms; }
  public recordBackground(ms: number) { this.lastBackground = ms; }
  public recordEdges(ms: number) { this.lastEdges = ms; }
  public recordNodes(ms: number) { this.lastNodes = ms; }

  public getSpikeDiagnostic(totalDelta: number): string {
    const physics = this.lastPhysics;
    const layout = this.lastLayout;
    const bg = this.lastBackground;
    const edges = this.lastEdges;
    const nodes = this.lastNodes;
    
    const measuredScript = physics + layout + bg + edges + nodes;
    const browserGc = Math.max(0, totalDelta - measuredScript);

    // Identify dominant factor without array allocation
    let maxName = '물리 연산 (Physics)';
    let maxVal = physics;

    if (layout > maxVal) { maxName = '좌표 투영 (Layout)'; maxVal = layout; }
    if (bg > maxVal) { maxName = '배경 렌더 (Background)'; maxVal = bg; }
    if (edges > maxVal) { maxName = '관계선 렌더 (Edges)'; maxVal = edges; }
    if (nodes > maxVal) { maxName = '노드/텍스트 렌더 (Nodes)'; maxVal = nodes; }
    if (browserGc > maxVal) { maxName = '브라우저/GC 지연 (Browser/GC)'; maxVal = browserGc; }

    return `${totalDelta.toFixed(1)}ms [${maxName} 주원인: ${maxVal.toFixed(1)}ms]`;
  }

  public recordLagSpike(spike: string): void {
    this.lagSpikes.unshift(spike);
    if (this.lagSpikes.length > 5) {
      this.lagSpikes.pop();
    }
  }

  public getLagSpikes(): string[] {
    return this.lagSpikes;
  }

  public clearLagSpikes(): void {
    this.lagSpikes = [];
  }
}
