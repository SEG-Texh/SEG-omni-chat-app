// ============================================================================
// CONFIGURATION
// ============================================================================

// Demo data for frontend testing
const demoUsers = [
    { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', isOnline: true },
    { id: '2', name: 'Jane Smith', email: 'user@example.com', role: 'user', isOnline: false, supervisor: 'Admin User' },
    { id: '3', name: 'Bob Johnson', email: 'supervisor@example.com', role: 'supervisor', isOnline: true }
];

const demoMessages = [
    { id: '1', sender: demoUsers[1], receiver: demoUsers[0], content: 'Hello Admin!', createdAt: new Date() },
    { id: '2', sender: demoUsers[0], receiver: demoUsers[1], content: 'Hi there! How can I help?', createdAt: new Date() }
];

// Demo credentials for login
const demoCredentials = {
    'admin@example.com': { password: 'admin123', user: demoUsers[0] },
    'user@example.com': { password: 'user123', user: demoUsers[1] },
    'supervisor@example.com': { password: 'super123', user: demoUsers[2] }
};

// App configuration
const APP_CONFIG = {
    socketUrl: window.location.origin,
    apiUrl: '/api',
    defaultRedirects: {
        admin: 'dashboard.html',
        supervisor: 'chat.html',
        user: 'chat.html'
    },
    pages: {
        login: 'index.html',
        dashboard: 'dashboard.html',
        chat: 'chat.html'
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        demoUsers,
        demoMessages,
        demoCredentials,
        APP_CONFIG
    };
}