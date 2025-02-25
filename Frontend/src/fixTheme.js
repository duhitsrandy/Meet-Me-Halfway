// Create this file and import it in your index.js or App.js

// Function to apply theme directly
function applyTheme(theme) {
  // Apply to both html and body to ensure it works
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  
  // Store in localStorage
  localStorage.setItem('theme', theme);
  
  console.log(`Theme set to: ${theme}`);
}

// Function to toggle theme
window.toggleTheme = function() {
  const currentTheme = localStorage.getItem('theme') || 'dark'; // Default to dark
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  applyTheme(newTheme);
  
  // Update any theme toggle button text if it exists
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  }
  
  return newTheme;
};

// Initialize theme on load
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // Default to dark mode instead of checking preferences
    applyTheme('dark');
  }
  
  // Add click handler to theme toggle button if it exists
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', window.toggleTheme);
    themeToggle.textContent = (localStorage.getItem('theme') === 'dark') ? '☀️' : '🌙';
  }
}

// Run initialization
initTheme();

// Add a global function to toggle theme from console for testing
console.log('Theme functions loaded. You can test by running toggleTheme() in the console.'); 