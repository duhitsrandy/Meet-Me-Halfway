// Detect if device is touch-enabled
export const isTouchDevice = () => {
  // Check for small screen as an additional signal for mobile devices
  const isSmallScreen = window.innerWidth <= 768;
  
  // More reliable touch detection
  const prefersTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  
  // Fallback detection methods
  const hasTouch = 
    'ontouchstart' in window || 
    navigator.maxTouchPoints > 0 || 
    navigator.msMaxTouchPoints > 0;
  
  // Check for mobile user agent as additional signal
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Log for debugging
  console.log("Touch detection:", { prefersTouch, hasTouch, mobileUserAgent, isSmallScreen });
  
  // Return true if any detection method indicates a touch device
  return prefersTouch || hasTouch || mobileUserAgent || isSmallScreen;
};

// Add passive touch listeners to improve performance
export const addPassiveEventListener = (element, eventName, handler) => {
  element.addEventListener(eventName, handler, { passive: true });
  return () => {
    element.removeEventListener(eventName, handler);
  };
};

// Prevent double-tap zoom on iOS
export const preventDoubleTapZoom = (element) => {
  let lastTap = 0;
  const handler = (e) => {
    const now = new Date().getTime();
    const timeDiff = now - lastTap;
    if (timeDiff < 300 && timeDiff > 0) {
      e.preventDefault();
    }
    lastTap = now;
  };
  
  element.addEventListener('touchend', handler, false);
  return () => {
    element.removeEventListener('touchend', handler);
  };
}; 