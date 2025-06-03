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
    const demoCredentials = {
        'admin@example.com': { password: 'admin123', user: demoUsers[0] },
        'user@example.com': { password: 'user123', user: demoUsers[1] },
        'supervisor@example.com': { password: 'super123', user: demoUsers[2] }
    };

    if (demoCredentials[email] && demoCredentials[email].password === password) {
        currentUser = demoCredentials[email].user;
        // Store user in sessionStorage for page navigation
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        return currentUser;
    } else {
        throw new Error('Invalid credentials');
    }
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    if (window.socket) {
        window.socket.disconnect();
    }
    window.location.href = 'index.html';
}

function checkAuth() {
    const user = sessionStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        return true;
    }
    return false;
}

// Navigation functions
function showDashboard() {
    window.location.href = 'dashboard.html';
}

function showChat() {
    window.location.href = 'chat.html';
}

function goToDashboard() {
    if (currentUser && currentUser.role === 'admin') {
        showDashboard();
    }
}

function openChat() {
    showChat();
}