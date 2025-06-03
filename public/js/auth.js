// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================
let currentUser = null;

const demoUsers = [
    { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', isOnline: true },
    { id: '2', name: 'Jane Smith', email: 'user@example.com', role: 'user', isOnline: false, supervisor: 'Admin User' },
    { id: '3', name: 'Bob Johnson', email: 'supervisor@example.com', role: 'supervisor', isOnline: true }
];

async function login(email, password) {
    // Demo login logic
    const demoCredentials = {
        'admin@example.com': { password: 'admin123', user: demoUsers[0] },
        'user@example.com': { password: 'user123', user: demoUsers[1] },
        'supervisor@example.com': { password: 'super123', user: demoUsers[2] }
    };

    if (demoCredentials[email] && demoCredentials[email].password === password) {
        const user = demoCredentials[email].user;
        currentUser = user;
        
        // Store in memory (not localStorage as per restrictions)
        window.currentUserToken = 'demo-token-' + user.id;
        return user;
    } else {
        throw new Error('Invalid credentials');
    }
}

function logout() {
    currentUser = null;
    window.currentUserToken = null;
    if (window.socket) {
        window.socket = null;
    }
    showLogin();
}

function checkAuth() {
    // For demo purposes, no persistent auth
    return false;
}

// UI Navigation functions that are auth-related
function showLogin() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('dashboardContainer').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'none';
}