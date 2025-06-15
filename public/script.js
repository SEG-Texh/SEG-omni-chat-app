// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let currentUser = null;
let socket = null;
let currentChatUser = null;
let users = [];
let isTyping = false;
let typingTimeout = null;
let unclaimedMessages = [];

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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('broadcastMessageList')) {
        loadUnclaimedMessages();
        initializeSocket();
    }
});

// ============================================================================
// UNCLAIMED MESSAGES FUNCTIONS
// ============================================================================

async function loadUnclaimedMessages() {
    const token = localStorage.getItem('token');
    const messageList = document.getElementById('broadcastMessageList');
    
    if (!token) {
        messageList.innerHTML = `
            <div class="error">
                <p>Please login to view messages</p>
                <button onclick="showLogin()">Login Now</button>
            </div>
        `;
        return;
    }

    try {
        // Show loading state
        messageList.innerHTML = '<div class="loading">Loading messages...</div>';
        
        const response = await fetch('/api/messages/unclaimed', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            showLogin();
            return;
        }

        if (!response.ok) {
            throw new Error(`Failed to load messages: ${response.status}`);
        }

        const messages = await response.json();
        
        // Check if data is in expected format
        if (!Array.isArray(messages)) {
            throw new Error('Invalid data format from server');
        }
        
        unclaimedMessages = messages;
        renderUnclaimedMessages();
        
    } catch (error) {
        console.error('Error loading messages:', error);
        messageList.innerHTML = `
            <div class="error">
                <p>Failed to load messages</p>
                <small>${error.message}</small>
                <button onclick="loadUnclaimedMessages()" class="retry-btn">Retry</button>
            </div>
        `;
    }
}

function renderUnclaimedMessages() {
    const messageList = document.getElementById('broadcastMessageList');
    
    // Clear existing messages
    messageList.innerHTML = '';

    if (!unclaimedMessages || unclaimedMessages.length === 0) {
        messageList.innerHTML = '<div class="empty">No unclaimed messages available</div>';
        return;
    }

    // Sort messages by timestamp (newest first)
    unclaimedMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Create and append message elements
    unclaimedMessages.forEach(message => {
        const messageElement = createUnclaimedMessageElement(message);
        messageList.appendChild(messageElement);
    });
}

function createUnclaimedMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-item';
    messageDiv.dataset.messageId = message._id;
    
    // Format sender info
    const senderName = message.sender?.name || 'Unknown';
    const senderInitial = senderName.charAt(0).toUpperCase();
    const platformIcon = getPlatformIcon(message.platform);
    const timeAgo = formatTimeAgo(message.createdAt);
    const messagePreview = message.content?.text 
        ? message.content.text.substring(0, 50) + (message.content.text.length > 50 ? '...' : '')
        : '[No text content]';
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="sender-avatar">${senderInitial}</div>
            <div class="message-info">
                <div class="sender-name">${senderName}</div>
                <div class="message-time">${timeAgo}</div>
            </div>
            <div class="platform-icon">${platformIcon}</div>
        </div>
        <div class="message-preview">${messagePreview}</div>
        <div class="message-actions">
            <button class="claim-btn" onclick="claimMessage('${message._id}', event)">
                Claim Message
            </button>
        </div>
    `;
    
    // Add click handler for message details
    messageDiv.addEventListener('click', (e) => {
        if (!e.target.classList.contains('claim-btn')) {
            showMessageDetail(message);
        }
    });
    
    return messageDiv;
}

async function claimMessage(messageId, event) {
    event.stopPropagation(); // Prevent triggering parent click
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showLogin();
            return;
        }
        
        const response = await fetch(`/api/messages/${messageId}/claim`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to claim message');
        }
        
        // Remove from local array and re-render
        unclaimedMessages = unclaimedMessages.filter(msg => msg._id !== messageId);
        renderUnclaimedMessages();
        
        // Show success notification
        showNotification('Message claimed successfully!');
        
    } catch (error) {
        console.error('Error claiming message:', error);
        showNotification('Failed to claim message', 'error');
    }
}

// ============================================================================
// SOCKET.IO FUNCTIONS
// ============================================================================

function initializeSocket() {
    if (socket) socket.disconnect();
    
    socket = io('https://omni-chat-app-dbd9c00cc9c4.herokuapp.com', {
        transports: ['websocket'],
        upgrade: false
    });
    
    socket.on('connect', () => {
        console.log('Socket connected');
    });
    
    socket.on('new_message', (message) => {
        if ((message.labels && message.labels.includes('unclaimed')) || !message.claimed) {
            unclaimedMessages.unshift(message);
            renderUnclaimedMessages();
        }
    });
    
    socket.on('message_claimed', (messageId) => {
        unclaimedMessages = unclaimedMessages.filter(msg => msg._id !== messageId);
        renderUnclaimedMessages();
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getPlatformIcon(platform) {
    const icons = {
        whatsapp: '💬',
        facebook: '📘',
        email: '✉️',
        sms: '📱',
        telegram: '📨',
        instagram: '📸',
        web: '🌐'
    };
    return icons[platform?.toLowerCase()] || '🌐';
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    
    return 'Just now';
}

function showNotification(message, type = 'success') {
    // Implement your notification system here
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showMessageDetail(message) {
    const detailView = document.getElementById('messageDetailView') || createMessageDetailView();
    
    const formatted = formatMessageForDisplay(message);
    const platformIcon = getPlatformIcon(message.platform);
    
    detailView.innerHTML = `
        <div class="message-detail-header">
            <div class="sender-info">
                <div class="sender-avatar">${formatted.sender.name.charAt(0).toUpperCase()}</div>
                <div>
                    <h3>${formatted.sender.name}</h3>
                    <div class="message-meta">
                        <span class="platform-badge">${platformIcon} ${formatted.platform}</span>
                        <span class="message-time">${new Date(formatted.timestamp).toLocaleString()}</span>
                    </div>
                </div>
            </div>
            <button class="close-btn" onclick="closeMessageDetail()">&times;</button>
        </div>
        <div class="message-content">
            <p>${formatted.content.text}</p>
            ${formatted.content.attachments?.length > 0 ? `
                <div class="message-attachments">
                    <h4>Attachments:</h4>
                    <div class="attachments-list">
                        ${formatted.content.attachments.map(att => `
                            <div class="attachment">
                                <span class="attachment-icon">${getAttachmentIcon(att.type)}</span>
                                <a href="${att.url}" target="_blank" class="attachment-link">
                                    ${att.caption || att.type}
                                </a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
        <div class="message-actions">
            <button class="btn claim-btn" onclick="claimMessage('${formatted._id}', event)">
                Claim This Message
            </button>
            <button class="btn reply-btn" onclick="startReply('${formatted.sender.id}')">
                Reply
            </button>
        </div>
    `;
    
    detailView.style.display = 'block';
}

function createMessageDetailView() {
    const detailView = document.createElement('div');
    detailView.id = 'messageDetailView';
    detailView.className = 'message-detail-container';
    document.body.appendChild(detailView);
    return detailView;
}

function closeMessageDetail() {
    const detailView = document.getElementById('messageDetailView');
    if (detailView) {
        detailView.style.display = 'none';
    }
}

function getAttachmentIcon(type) {
    const icons = {
        image: '🖼️',
        video: '🎬',
        audio: '🎵',
        file: '📄',
        location: '📍',
        sticker: '🏷️'
    };
    return icons[type?.toLowerCase()] || '📎';
}

// ============================================================================
// REST OF YOUR EXISTING CODE REMAINS THE SAME
// ============================================================================
// ============================================================================
// ERROR HANDLING
// ============================================================================
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});

// ============================================================================
// EXPORT FOR TESTING (if needed)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        login,
        logout,
        addUser,
        deleteUser,
        sendMessage,
        displayMessage
    };
}