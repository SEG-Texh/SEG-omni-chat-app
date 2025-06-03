// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

let currentUser = null;

async function login(email, password) {
    // Demo login logic
    if (demoCredentials[email] && demoCredentials[email].password === password) {
        const user = demoCredentials[email].user;
        currentUser = user;
        
        // Store in memory (not localStorage as per restrictions)
        window.currentUserToken = 'demo-token-' + user.id;
        
        // Redirect based on role
        if (user.role === 'admin') {
            window.location.href = APP_CONFIG.pages.dashboard;
        } else {
            window.location.href = APP_CONFIG.pages.chat;
        }
    } else {
        throw new Error('Invalid credentials');
    }
}

function logout() {
    currentUser = null;
    window.currentUserToken = null;
    window.location.href = APP_CONFIG.pages.login;
}

function checkAuth() {
    // For demo purposes, check if we have a token
    return window.currentUserToken !== null && window.currentUserToken !== undefined;
}

function getCurrentUser() {
    // In a real app, this would decode the token or make an API call
    if (window.currentUserToken) {
        const userId = window.currentUserToken.replace('demo-token-', '');
        return demoUsers.find(u => u.id === userId);
    }
    return null;
}

function requireAuth() {
    if (!checkAuth()) {
        window.location.href = APP_CONFIG.pages.login;
        return false;
    }
    return true;
}

function requireAdmin() {
    if (!requireAuth()) return false;
    
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        window.location.href = APP_CONFIG.pages.chat;
        return false;
    }
    return true;
}

// Initialize auth check on page load
document.addEventListener('DOMContentLoaded', function() {
    // Only check auth on protected pages (not login page)
    if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
        if (window.location.pathname.includes('dashboard.html')) {
            requireAdmin();
        } else {
            requireAuth();
        }
        
        // Set current user if authenticated
        if (checkAuth()) {
            currentUser = getCurrentUser();
        }
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        login,
        logout,
        checkAuth,
        getCurrentUser,
        requireAuth,
        requireAdmin
    };
}   