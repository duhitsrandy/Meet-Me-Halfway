// Device detection utility functions

/**
 * Detects if the current device is a mobile device
 * @returns {boolean} True if the device is mobile
 */
export const isMobileDevice = () => {
  // Check screen width
  const isSmallScreen = window.innerWidth <= 767;
  
  // Check for mobile user agent
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Return true if any of these conditions are met
  return isSmallScreen || mobileUserAgent || hasTouch;
};

/**
 * Detects if the device has touch capability
 * @returns {boolean} True if the device has touch capability
 */
export const hasTouchCapability = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}; 