/**
 * Vercel Speed Insights initialization for static HTML site
 * This script integrates Vercel Speed Insights to track Web Vitals
 */

// Initialize Speed Insights queue
window.si = window.si || function () { 
  (window.siq = window.siq || []).push(arguments); 
};

// Track Web Vitals using the Vercel Speed Insights endpoint
(function() {
  // Configuration
  const VERCEL_ANALYTICS_ID = window.VERCEL_ANALYTICS_ID || 'auto';
  const endpoint = '/_vercel/speed-insights/vitals';
  
  // Helper to send vitals data
  function sendToVercel(metric) {
    const body = {
      dsn: VERCEL_ANALYTICS_ID,
      id: metric.id,
      page: window.location.pathname,
      href: window.location.href,
      event_name: metric.name,
      value: metric.value.toString(),
      speed: 'unknown'
    };

    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(body));
    } else {
      fetch(endpoint, {
        body: JSON.stringify(body),
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(console.error);
    }
  }

  // Function to report Web Vitals
  function reportWebVitals() {
    // Only run if Web Vitals API is available
    if (typeof PerformanceObserver === 'undefined') return;

    // CLS (Cumulative Layout Shift)
    try {
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        if (clsValue > 0) {
          sendToVercel({
            name: 'CLS',
            value: clsValue,
            id: 'v3-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
          });
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // Layout shift not supported
    }

    // FID (First Input Delay)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          sendToVercel({
            name: 'FID',
            value: entry.processingStart - entry.startTime,
            id: 'v3-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
          });
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      // First input not supported
    }

    // LCP (Largest Contentful Paint)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        sendToVercel({
          name: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          id: 'v3-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // LCP not supported
    }

    // FCP (First Contentful Paint)
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            sendToVercel({
              name: 'FCP',
              value: entry.startTime,
              id: 'v3-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            });
          }
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
    } catch (e) {
      // FCP not supported
    }

    // TTFB (Time to First Byte)
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0];
      if (navigationEntry) {
        sendToVercel({
          name: 'TTFB',
          value: navigationEntry.responseStart - navigationEntry.requestStart,
          id: 'v3-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        });
      }
    } catch (e) {
      // TTFB not supported
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'complete') {
    reportWebVitals();
  } else {
    window.addEventListener('load', reportWebVitals);
  }
})();
