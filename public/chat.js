// ============================================================================
// CHAT FUNCTIONS AND SOCKET MANAGEMENT
// ============================================================================

let socket = null;
let currentChatUser = null;
let isTyping = false;
let typingTimeout = null;

// Demo users for chat (same as dashboard)
const demoUsers = [
    { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', isOnline: true },
    { id: '2', name: 'Jane Smith', email: 'user@example.com', role: 'user', isOnline: false, supervisor: 'Admin User' },
    { id: '3', name: 'Bob Johnson', email: 'supervisor@example.com', role: 'supervisor', isOnline: true }
];

const demoMessages = [
    { id: '1', sender: demoUsers[1], receiver: demoUsers[0], content: 'Hello Admin!', createdAt: new Date() },
    { id: '2', sender: demoUsers[0], receiver: demoUsers[1], content: 'Hi there! How can I help?', createdAt: new Date() }
];

// ============================================================================
// SOCKET INITIALIZATION
// ============================================================================
function initializeSocket() {
    // Demo socket simulation - replace with real Socket.IO connection
    socket = {
        emit: (event, data) => {
            console.log('Socket emit:', event, data);
            handleSocketEmit(event, data);
        },
        on: (event, callback) => {
            console.log('Socket listening to:', event);
            // Store callbacks for later use
            window.socketCallbacks = window.socketCallbacks || {};
            window.socketCallbacks[event] = callback;
        }
    };
    
    // Set up socket event listeners
    socket.on('newMessage', displayMessage);
    socket.on('userTyping', showTypingIndicator);
    socket.on('userStoppedTyping', hideTypingIndicator);
    socket.on('userStatusChanged', updateUserStatus);
}

function handleSocketEmit(event, data) {
    if (event === 'sendMessage') {
        // Simulate message sending
        setTimeout(() => {
            const currentUser = getCurrentUser();
            const message = {
                id: Date.now().toString(),
                sender: currentUser,
                receiver: currentChatUser,
                content: data.content,
                createdAt: new Date()
            };
            displayMessage(message);
            
            // Simulate auto-reply for demo
            if (currentChatUser && currentChatUser.id !== currentUser.id) {
                setTimeout(() => {
                    const autoReply = {
                        id: (Date.now() + 1).toString(),
                        sender: currentChatUser,
                        receiver: currentUser,
                        content: `Thanks for your message: "${data.content}"`,
                        createdAt: new Date()
                    };
                    displayMessage(autoReply);
                }, 2000);
            }
        }, 100);
    }
}

// ============================================================================
// CHAT USER MANAGEMENT
// ============================================================================
function loadChatUsers() {
    const userList = document.getElementById('chatUserList');
    userList.innerHTML = '';
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const otherUsers = demoUsers.filter(u => u.id !== currentUser.id);
    
    otherUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.onclick = () => selectChatUser(user);
        userDiv.innerHTML = `
            <div class="user-status ${user.isOnline ? 'online' : ''}"></div>
            <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div>
                <div>${user.name}</div>
                <div style="font-size: 12px; color: #666;">${user.isOnline ? 'Online' : 'Offline'}</div>
            </div>
        `;
        userList.appendChild(userDiv);
    });
}

function selectChatUser(user) {
    currentChatUser = user;
    
    // Update active user
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Update chat header
    document.getElementById('chatUserName').textContent = user.name;
    
    // Enable input
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.placeholder = `Type a message to ${user.name}...`;
    
    // Load messages for this conversation
    loadChatMessages(user);
    
    // Focus on input
    messageInput.focus();
}

function loadChatMessages(user) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Filter messages for this conversation
    const conversationMessages = demoMessages.filter(msg => 
        (msg.sender.id === currentUser.id && msg.receiver.id === user.id) ||
        (msg.sender.id === user.id && msg.receiver.id === currentUser.id)
    );
    
    conversationMessages.forEach(message => {
        displayMessage(message);
    });
    
    // Scroll to bottom
    scrollToBottom();
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================
function displayMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');
    const currentUser = getCurrentUser();
    if (!messagesContainer || !currentUser) return;
    
    const messageDiv = document.createElement('div');
    const isOwnMessage = message.sender.id === currentUser.id;
    
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${message.sender.name.charAt(0).toUpperCase()}</div>
        <div class="message-content">
            <div class="message-bubble">
                ${sanitizeMessage(message.content)}
            </div>
            <div class="message-info">
                ${message.sender.name} • ${formatTime(message.createdAt)}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentChatUser || !socket) return;
    
    // Send message via socket
    socket.emit('sendMessage', {
        receiverId: currentChatUser.id,
        content: content
    });
    
    // Clear input and stop typing
    input.value = '';
    stopTyping();
}

function sanitizeMessage(content) {
    // Basic HTML sanitization
    const div = document.createElement('div');
    div.textContent = content;
    return div.innerHTML;
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// ============================================================================
// TYPING INDICATORS
// ============================================================================
function handleTyping() {
    if (!isTyping && currentChatUser && socket) {
        isTyping = true;
        socket.emit('typing', { receiverId: currentChatUser.id });
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        stopTyping();
    }, 1000);
}

function stopTyping() {
    if (isTyping && currentChatUser && socket) {
        isTyping = false;
        socket.emit('stopTyping', { receiverId: currentChatUser.id });
    }
}

function showTypingIndicator(data) {
    if (data.senderId === currentChatUser?.id) {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.textContent = `${currentChatUser.name} is typing...`;
            indicator.style.display = 'block';
        }
    }
}

function hideTypingIndicator(data) {
    if (data.senderId === currentChatUser?.id) {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

// ============================================================================
// USER STATUS UPDATES
// ============================================================================
function updateUserStatus(data) {
    const user = demoUsers.find(u => u.id === data.userId);
    if (user) {
        user.isOnline = data.isOnline;
        loadChatUsers();
        
        // Update current chat user status if applicable
        if (currentChatUser && currentChatUser.id === data.userId) {
            currentChatUser.isOnline = data.isOnline;
        }
    }
}

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
function goToDashboard() {
    const currentUser = getCurrentUser();
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'supervisor')) {
        window.location.href = 'dashboard.html';
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// ============================================================================
// INITIALIZATION AND EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    // Show/hide admin controls
    const backToDashboard = document.getElementById('backToDashboard');
    if (backToDashboard && (currentUser.role === 'admin' || currentUser.role === 'supervisor')) {
        backToDashboard.style.display = 'inline-block';
    }
    
    // Initialize socket and load users
    initializeSocket();
    loadChatUsers();
    
    // Message input event listeners
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', handleTyping);
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Stop typing when input loses focus
        messageInput.addEventListener('blur', stopTyping);
    }
    
    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Logout handlers
    const logoutBtns = document.querySelectorAll('[onclick="logout()"]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    });
    
    // Dashboard navigation
    const dashboardBtns = document.querySelectorAll('[onclick="goToDashboard()"]');
    dashboardBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            goToDashboard();
        });
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopTyping();
        }
    });
    
    // Handle beforeunload
    window.addEventListener('beforeunload', function() {
        if (socket) {
            stopTyping();
        }
    });
});

// ============================================================================
// REAL SOCKET.IO INTEGRATION (for when you have a backend)
// ============================================================================
function initializeRealSocket() {
    // Uncomment and modify when you have a real backend
    /*
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        const currentUser = getCurrentUser();
        if (currentUser) {
            socket.emit('userOnline', { userId: currentUser.id });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    socket.on('newMessage', (message) => {
        if (currentChatUser && 
            (message.sender.id === currentChatUser.id || message.receiver.id === currentChatUser.id)) {
            displayMessage(message);
        }
    });
    
    socket.on('userTyping', (data) => {
        showTypingIndicator(data);
    });
    
    socket.on('userStoppedTyping', (data) => {
        hideTypingIndicator(data);
    });
    
    socket.on('userStatusChanged', (data) => {
        updateUserStatus(data);
    });
    */
}

// Export functions for use in other files
window.chatFunctions = {
    initializeSocket,
    loadChatUsers,
    selectChatUser,
    sendMessage,
    displayMessage,
    goToDashboard,
    handleTyping,
    stopTyping
};