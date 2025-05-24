// Socket.IO connection and event handlers
function initializeSocket() {
    socket = io(CONFIG.SOCKET_URL);
    
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('user-online', currentUser);
    });

    socket.on('new-message', (messageData) => {
        handleNewMessage(messageData);
    });

    socket.on('conversation-claimed', (data) => {
        updateConversationStatus(data.conversationId, data.agentId);
    });

    socket.on('user-status-update', (data) => {
        updateUserStatus(data.userId, data.status);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

function handleNewMessage(messageData) {
    // Update conversation in list
    const conversation = conversations.find(c => c.id === messageData.conversationId);
    if (conversation) {
        conversation.lastMessage = messageData.content;
        conversation.timestamp = new Date();
        renderConversations();
    }

    // If this is the active conversation, add message to chat
    if (activeConversation && activeConversation.id === messageData.conversationId) {
        const container = document.getElementById('messagesContainer');
        const messageElement = document.createElement('div');
        messageElement.className = 'message incoming';
        messageElement.innerHTML = `
            <div>${messageData.content}</div>
            <div class="message-time">${formatTime(new Date())}</div>
        `;
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    // Show notification for new messages
    if (!activeConversation || activeConversation.id !== messageData.conversationId) {
        showNotification(`New message from ${messageData.customerName}`, 'info');
    }
}

function updateConversationStatus(conversationId, agentId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
        conversation.claimed = true;
        conversation.agentId = agentId;
        renderConversations();
        
        if (activeConversation && activeConversation.id === conversationId) {
            selectConversation(conversationId);
        }
    }
}

function updateUserStatus(userId, status) {
    const user = users.find(u => u.id === userId);
    if (user) {
        user.status = status;
        renderUsers();
    }
}