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

    // 16.67ms (60fps threshold) is the performance limit
    if (duration > 16.67) {
      this.warningCount++;
      console.warn(`[PERF ALERT] Rendering frame took ${duration.toFixed(2)}ms (Threshold: 16.67ms)`);
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
}
