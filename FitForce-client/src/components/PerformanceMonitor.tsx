'use client';

import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  // Core Web Vitals
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  
  // Custom metrics
  pageLoadTime?: number;
  domContentLoaded?: number;
  resourceLoadTime?: number;
  
  // User interactions
  clickLatency?: number;
  scrollLatency?: number;
  
  // Memory usage
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observer: PerformanceObserver | null = null;
  private clickStartTime = 0;
  private scrollStartTime = 0;

  constructor() {
    this.initializeObservers();
    this.measureCoreWebVitals();
    this.measureCustomMetrics();
    this.setupUserInteractionTracking();
  }

  private initializeObservers() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Observe navigation timing
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.pageLoadTime = navEntry.loadEventEnd - navEntry.fetchStart;
            this.metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.fetchStart;
            this.metrics.TTFB = navEntry.responseStart - navEntry.fetchStart;
          }
        });
      });

      this.observer.observe({ entryTypes: ['navigation'] });
    } catch (error) {
      console.warn('Performance monitoring not supported:', error);
    }
  }

  private measureCoreWebVitals() {
    if (typeof window === 'undefined') return;

    // First Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcpEntry) {
            this.metrics.FCP = fcpEntry.startTime;
          }
        });
        observer.observe({ entryTypes: ['paint'] });
      } catch (error) {
        console.warn('FCP measurement not supported:', error);
      }
    }

    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.LCP = lastEntry.startTime;
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        console.warn('LCP measurement not supported:', error);
      }
    }

    // First Input Delay
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.processingStart && entry.startTime) {
              this.metrics.FID = entry.processingStart - entry.startTime;
            }
          });
        });
        observer.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        console.warn('FID measurement not supported:', error);
      }
    }

    // Cumulative Layout Shift
    if ('PerformanceObserver' in window) {
      try {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.metrics.CLS = clsValue;
        });
        observer.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('CLS measurement not supported:', error);
      }
    }
  }

  private measureCustomMetrics() {
    if (typeof window === 'undefined') return;

    // Measure memory usage
    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        this.metrics.memoryUsage = {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        };
      }
    };

    // Measure memory periodically
    setInterval(measureMemory, 30000); // Every 30 seconds
    measureMemory(); // Initial measurement

    // Measure resource load time
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              if (resourceEntry.transferSize > 0) {
                this.metrics.resourceLoadTime = resourceEntry.responseEnd - resourceEntry.fetchStart;
              }
            }
          });
        });
        observer.observe({ entryTypes: ['resource'] });
      } catch (error) {
        console.warn('Resource timing not supported:', error);
      }
    }
  }

  private setupUserInteractionTracking() {
    if (typeof window === 'undefined') return;

    // Track click latency
    document.addEventListener('click', (event) => {
      this.clickStartTime = performance.now();
      
      setTimeout(() => {
        const clickLatency = performance.now() - this.clickStartTime;
        this.metrics.clickLatency = clickLatency;
        
        // Log slow clicks
        if (clickLatency > 100) {
          console.warn(`Slow click detected: ${clickLatency.toFixed(2)}ms`);
        }
      }, 0);
    });

    // Track scroll latency
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      if (this.scrollStartTime === 0) {
        this.scrollStartTime = performance.now();
      }
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollLatency = performance.now() - this.scrollStartTime;
        this.metrics.scrollLatency = scrollLatency;
        this.scrollStartTime = 0;
      }, 100);
    });
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public reportMetrics() {
    const metrics = this.getMetrics();
    
    // Log metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Performance Metrics:', metrics);
    }

    // Send to monitoring service
    try {
      fetch('/api/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...metrics,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        // Silently fail if performance reporting fails
      });
    } catch (error) {
      // Silently fail if performance reporting fails
    }
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const monitorRef = useRef<PerformanceMonitor | null>(null);

  useEffect(() => {
    monitorRef.current = new PerformanceMonitor();

    // Report metrics on page unload
    const handleBeforeUnload = () => {
      if (monitorRef.current) {
        monitorRef.current.reportMetrics();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (monitorRef.current) {
        monitorRef.current.destroy();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return {
    getMetrics: () => monitorRef.current?.getMetrics() || {},
    reportMetrics: () => monitorRef.current?.reportMetrics(),
  };
}

export default PerformanceMonitor;

