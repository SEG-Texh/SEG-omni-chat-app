// ============================================================================
// CHAT FUNCTIONS
// ============================================================================
let socket = null;
let currentChatUser = null;
let isTyping = false;
let typingTimeout = null;

const demoMessages = [
    { id: '1', sender: demoUsers[1], receiver: demoUsers[0], content: 'Hello Admin!', createdAt: new Date() },
    { id: '2', sender: demoUsers[0], receiver: demoUsers[1], content: 'Hi there! How can I help?', createdAt: new Date() }
];

function initializeSocket() {
    // ... (socket initialization code from original) ...
}

function loadChatUsers() {
    // ... (chat users loading code from original) ...
}

// ... (all other chat functions from the original code) ...

function showChat() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    
    initializeSocket();
    loadChatUsers();
}