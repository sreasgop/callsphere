/* =========================================
   THEME MANAGER
   ========================================= */

const ThemeManager = {
    init() {
        // 1. Check LocalStorage
        const savedTheme = localStorage.getItem('callsphere_theme');
        
        // 2. Check System Preference
        const systemPref = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        
        // 3. Apply Theme (Default to dark if nothing saved)
        const theme = savedTheme || 'dark'; // Force dark as default unless system says light
        this.apply(theme);
    },

    toggle() {
        const current = document.body.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        this.apply(newTheme);
    },

    apply(theme) {
        // Set attribute on body
        document.body.setAttribute('data-theme', theme);
        // Save to storage
        localStorage.setItem('callsphere_theme', theme);
        // Update Icon
        this.updateIcon(theme);
    },

    updateIcon(theme) {
        const icon = document.getElementById('theme-icon');
        if (icon) {
            // Remove old classes
            icon.classList.remove('bi-moon-stars-fill', 'bi-sun-fill');
            // Add new class
            if (theme === 'light') {
                icon.classList.add('bi-moon-stars-fill'); // Show Moon to switch to Dark
                icon.style.color = '#1a1d21';
            } else {
                icon.classList.add('bi-sun-fill'); // Show Sun to switch to Light
                icon.style.color = '#ffffff';
            }
        }
    }
};

// Run on load
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    
    // Attach listener to button
    const btn = document.getElementById('theme-toggle');
    if(btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            ThemeManager.toggle();
        });
    }
});