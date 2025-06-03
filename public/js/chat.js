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

function showChat() {
    // For multi-page, this is handled by the page load
    initializeSocket();
    loadChatUsers();
    
    // Show back button for admins
    if (currentUser.role === 'admin') {
        document.getElementById('backToDashboard').style.display = 'block';
    }
}

// ... (rest of the chat functions remain the same as before) ...