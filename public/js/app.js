// Main application logic
let currentUser = null;
let conversations = [];
let activeConversation = null;
let socket = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const savedUser = getLocalStorage('currentUser');
    if (savedUser && savedUser.token) {
        currentUser = savedUser;
        showMainApp();
    } else {
        showLoginScreen();
    }

    // Set up event listeners
    setupEventListeners();
});

// Set up global event listeners
function setupEventListeners() {
    // Message input enter key
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Claim button
    const claimButton = document.getElementById('claimButton');
    if (claimButton) {
        claimButton.addEventListener('click', claimConversation);
    }

    // Window focus/blur events for activity tracking
    window.addEventListener('focus', function() {
        if (currentUser && socket) {
            socket.emit('user-active', currentUser.id);
        }
    });

    window.addEventListener('blur', function() {
        if (currentUser && socket) {
            socket.emit('user-inactive', currentUser.id);
        }
    });

    // Before unload - clean up
    window.addEventListener('beforeunload', function() {
        if (socket) {
            socket.disconnect();
        }
    });
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

// Show main application
function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Update UI with current user info
    updateUserInfo();
    
    // Initialize socket connection
    initializeSocket();
    
    // Load initial data
    loadConversations();
    
    // Show/hide admin tab based on role
    toggleAdminAccess();
}

// Update user info in header
function updateUserInfo() {
    const userElement = document.getElementById('currentUser');
    if (userElement && currentUser) {
        userElement.textContent = `${currentUser.name} (${currentUser.role})`;
    }
}

// Toggle admin access
function toggleAdminAccess() {
    const adminTab = document.getElementById('adminTab');
    if (adminTab) {
        if (currentUser && currentUser.role === 'admin') {
            adminTab.classList.remove('hidden');
        } else {
            adminTab.classList.add('hidden');
        }
    }
}

// Logout functionality
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clean up
        currentUser = null;
        conversations = [];
        activeConversation = null;
        
        // Disconnect socket
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        
        // Clear local storage
        removeLocalStorage('currentUser');
        removeLocalStorage('authToken');
        
        // Show login screen
        showLoginScreen();
        
        showNotification('Logged out successfully', 'success');
    }
}

// Handle incoming socket events
function handleSocketEvents() {
    if (!socket) return;

    // New message received
    socket.on('new-message', function(data) {
        handleIncomingMessage(data);
    });

    // Conversation claimed by another agent
    socket.on('conversation-claimed', function(data) {
        handleConversationClaimed(data);
    });

    // New conversation available
    socket.on('new-conversation', function(data) {
        handleNewConversation(data);
    });

    // User status updates
    socket.on('user-status-changed', function(data) {
        handleUserStatusChange(data);
    });

    // Connection status
    socket.on('connect', function() {
        showNotification('Connected to server', 'success');
    });

    socket.on('disconnect', function() {
        showNotification('Disconnected from server', 'error');
    });

    socket.on('reconnect', function() {
        showNotification('Reconnected to server', 'success');
        // Rejoin rooms or refresh data as needed
        if (currentUser) {
            socket.emit('agent-online', currentUser.id);
        }
    });
}

// Handle incoming message
function handleIncomingMessage(data) {
    // Update conversation last message
    const conversation = conversations.find(c => c.id === data.conversationId);
    if (conversation) {
        conversation.lastMessage = data.content;
        conversation.timestamp = new Date(data.timestamp);
        renderConversations();
    }

    // If this is the active conversation, add message to chat
    if (activeConversation && activeConversation.id === data.conversationId) {
        const container = document.getElementById('messagesContainer');
        const messageElement = document.createElement('div');
        messageElement.className = 'message incoming';
        messageElement.innerHTML = `
            <div>${escapeHtml(data.content)}</div>
            <div class="message-time">${formatTime(new Date(data.timestamp))}</div>
        `;
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    // Show notification if not active conversation
    if (!activeConversation || activeConversation.id !== data.conversationId) {
        const customerName = conversation ? conversation.customerName : 'Customer';
        showNotification(`New message from ${customerName}`, 'info');
    }
}

// Handle conversation claimed by another agent
function handleConversationClaimed(data) {
    const conversation = conversations.find(c => c.id === data.conversationId);
    if (conversation) {
        conversation.claimed = true;
        conversation.agentId = data.agentId;
        renderConversations();

        // If this was the active conversation and claimed by someone else
        if (activeConversation && activeConversation.id === data.conversationId && data.agentId !== currentUser.id) {
            showNotification('This conversation has been claimed by another agent', 'warning');
            selectConversation(data.conversationId); // Refresh the UI
        }
    }
}

// Handle new conversation
function handleNewConversation(data) {
    conversations.unshift(data);
    renderConversations();
    showNotification(`New conversation from ${data.customerName}`, 'info');
}

// Handle user status change
function handleUserStatusChange(data) {
    // Update user status in admin panel if open
    const currentTab = document.querySelector('.content.active');
    if (currentTab && currentTab.id === 'adminContent') {
        const user = users.find(u => u.id === data.userId);
        if (user) {
            user.status = data.status;
            user.lastActive = new Date(data.lastActive);
            renderUsers();
        }
    }
}

// Auto-refresh conversations periodically
function startAutoRefresh() {
    setInterval(() => {
        if (currentUser && !document.hidden) {
            loadConversations();
        }
    }, 30000); // Refresh every 30 seconds
}

// Start auto-refresh when app loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(startAutoRefresh, 5000); // Start after 5 seconds
});

// Error handling for uncaught errors
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('An unexpected error occurred', 'error');
});

// Handle promise rejections
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification('An unexpected error occurred', 'error');
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + / to focus message input
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const messageInput = document.getElementById('messageInput');
        if (messageInput && !messageInput.disabled) {
            messageInput.focus();
        }
    }

    // ESC to clear active conversation
    if (e.key === 'Escape') {
        if (activeConversation) {
            activeConversation = null;
            document.getElementById('chatPlaceholder').classList.remove('hidden');
            document.getElementById('activeChatArea').classList.add('hidden');
            renderConversations();
        }
    }
});

// Initialize app based on current state
function initializeApp() {
    if (currentUser) {
        showMainApp();
    } else {
        showLoginScreen();
    }
}