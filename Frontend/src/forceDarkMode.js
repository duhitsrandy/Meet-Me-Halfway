// Force dark mode immediately
document.documentElement.setAttribute('data-theme', 'dark');
document.body.setAttribute('data-theme', 'dark');
localStorage.setItem('theme', 'dark');

// Update the theme toggle button if it exists
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    // Clear any text content
    themeToggle.textContent = '';
  }
});

// Add this to your index.js or App.js
console.log('Forced dark mode'); 