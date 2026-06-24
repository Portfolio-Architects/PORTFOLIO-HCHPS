/**
 * Performance Profiler for Canvas 2D Rendering
 * Decoupled from React to minimize profiling overhead.
 */
export class PerformanceProfiler {
  private static instance: PerformanceProfiler | null = null;

  // Metrics
  private renderDurations: number[] = [];
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

  /**
   * Records a single render execution duration in milliseconds.
   */
  public recordRender(duration: number): void {
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
    const elapsed = now - this.lastFpsTime;

    if (elapsed >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  /**
   * Retrieves the current performance report metrics.
   */
  public getMetrics() {
    const sum = this.renderDurations.reduce((a, b) => a + b, 0);
    const avg = this.renderDurations.length > 0 ? sum / this.renderDurations.length : 0;
    
    return {
      lastRenderTime: this.lastDuration,
      avgRenderTime: avg,
      maxRenderTime: this.maxDuration,
      warningCount: this.warningCount,
      totalRenders: this.totalRenders,
      fps: this.currentFps
    };
  }

  /**
   * Resets the accumulated max latency and warnings count.
   */
  public resetStats(): void {
    this.maxDuration = 0;
    this.warningCount = 0;
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

    // Identify dominant factor
    const factors = [
      { name: '물리 연산 (Physics)', val: physics },
      { name: '좌표 투영 (Layout)', val: layout },
      { name: '배경 렌더 (Background)', val: bg },
      { name: '관계선 렌더 (Edges)', val: edges },
      { name: '노드/텍스트 렌더 (Nodes)', val: nodes },
      { name: '브라우저/GC 지연 (Browser/GC)', val: browserGc }
    ];
    factors.sort((a, b) => b.val - a.val);
    const primaryFactor = factors[0];

    return `${totalDelta.toFixed(1)}ms [${primaryFactor.name} 주원인: ${primaryFactor.val.toFixed(1)}ms]`;
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
