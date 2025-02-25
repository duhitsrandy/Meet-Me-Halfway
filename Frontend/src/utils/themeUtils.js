// Ensure theme is applied to the HTML element
export const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

// Get the current theme
export const getTheme = () => {
  return localStorage.getItem('theme') || 'light';
};

// Toggle between light and dark themes
export const toggleTheme = () => {
  const currentTheme = getTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  return newTheme;
};

// Initialize theme on page load
export const initTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else {
    // Check if user prefers dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    localStorage.setItem('theme', prefersDark ? 'dark' : 'light');
  }
}; 