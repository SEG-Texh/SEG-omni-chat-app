// Global configuration and variables
const CONFIG = {
    API_BASE_URL: '/api',
    SOCKET_URL: window.location.origin,
    NOTIFICATION_DURATION: 3000,
    MESSAGE_SIMULATION_INTERVAL: 30000
};

// Global state
let socket;
let currentUser = null;
let activeConversation = null;
let conversations = [];
let users = [];