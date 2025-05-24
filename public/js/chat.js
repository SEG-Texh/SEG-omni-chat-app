// Chat functionality
async function loadConversations() {
    try {
        // Mock data for demonstration - replace with actual API call
        conversations = [
            {
                id: '1',
                customerName: 'John Smith',
                source: 'WhatsApp',
                lastMessage: 'Hi, I need help with my order',
                timestamp: new Date(),
                claimed: false,
                agentId: null
            },
            {
                id: '2',
                customerName: 'Sarah Johnson',
                source: 'Facebook',
                lastMessage: 'When will my package arrive?',
                timestamp: new Date(Date.now() - 300000),
                claimed: true,
                agentId: currentUser?.id
            },
            {
                id: '3',
                customerName: 'Mike Wilson',
                source: 'Instagram',
                lastMessage: 'I want to return this product',
                timestamp: new Date(Date.now() - 600000),
                claimed: false,
                agentId: null
            },
            {
                id: '4',
                customerName: 'Emily Davis',
                source: 'WhatsApp',
                lastMessage: 'Thank you for your help!',
                timestamp: new Date(Date.now() - 1200000),
                claimed: true,
                agentId: 'agent2'
            }
        ];
        
        renderConversations();
    } catch (error) {
        console.error('Load conversations error:', error);
        showNotification('Failed to load conversations', 'error');
    }
}

function renderConversations() {
    const container = document.getElementById('conversationsList');
    
    if (conversations.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No conversations yet</p></div>';
        return;
    }

    container.innerHTML = conversations.map(conv => `
        <div class="conversation-item ${conv.claimed ? '' : 'unclaimed'} ${activeConversation?.id === conv.id ? 'active' : ''}" 
             onclick="selectConversation('${conv.id}')">
            <div>
                <strong>${escapeHtml(conv.customerName)}</strong>
                <div class="conversation-source">${conv.source}</div>
                <div class="conversation-preview">${escapeHtml(conv.lastMessage)}</div>
            </div>
            <div style="text-align: right; font-size: 0.8rem; color: #6b7280;">
                ${formatTime(conv.timestamp)}
                ${!conv.claimed ? '<br><span style="color: #f59e0b; font-weight: 600;">UNCLAIMED</span>' : ''}
            </div>
        </div>
    `).join('');
}

function selectConversation(conversationId) {
    activeConversation = conversations.find(c => c.id === conversationId);
    
    if (!activeConversation) return;

    // Update UI
    document.getElementById('chatPlaceholder').classList.add('hidden');
    document.getElementById('activeChatArea').classList.remove('hidden');
    
    // Update header
    document.getElementById('customerName').textContent = activeConversation.customerName;
    document.getElementById('conversationSource').textContent = activeConversation.source;
    
    // Show/hide claim button and input controls
    const claimButton = document.getElementById('claimButton');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!activeConversation.claimed) {
        claimButton.classList.remove('hidden');
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = 'Claim this conversation to start chatting...';
    } else if (activeConversation.agentId === currentUser.id) {
        claimButton.classList.add('hidden');
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.placeholder = 'Type your message...';
        messageInput.focus();
    } else {
        claimButton.classList.add('hidden');
        messageInput.disabled = true;
        sendButton.disabled = true;
        messageInput.placeholder = 'This conversation is handled by another agent';
    }

    // Load messages
    loadMessages(conversationId);
    
    // Update conversation list
    renderConversations();
}

function loadMessages(conversationId) {
    // Mock messages - replace with actual API call
    const mockMessagesData = {
        '1': [
            {
                id: '1',
                content: 'Hi, I need help with my order',
                sender: 'customer',
                timestamp: new Date(Date.now() - 600000)
            }
        ],
        '2': [
            {
                id: '1',
                content: 'When will my package arrive?',
                sender: 'customer',
                timestamp: new Date(Date.now() - 600000)
            },
            {
                id: '2',
                content: 'Hello! I\'d be happy to help you with your package delivery. Could you please provide your tracking number?',
                sender: 'agent',
                timestamp: new Date(Date.now() - 300000)
            },
            {
                id: '3',
                content: 'Sure, it\'s TR123456789',
                sender: 'customer',
                timestamp: new Date(Date.now() - 200000)
            },
            {
                id: '4',
                content: 'Thank you! According to our system, your package is currently in transit and should arrive by tomorrow evening. You\'ll receive a text notification when it\'s out for delivery.',
                sender: 'agent',
                timestamp: new Date(Date.now() - 100000)
            }
        ],
        '3': [
            {
                id: '1',
                content: 'I want to return this product',
                sender: 'customer',
                timestamp: new Date(Date.now() - 600000)
            }
        ],
        '4': [
            {
                id: '1',
                content: 'I have a question about my recent order',
                sender: 'customer',
                timestamp: new Date(Date.now() - 1800000)
            },
            {
                id: '2',
                content: 'Of course! I\'m here to help. What would you like to know about your order?',
                sender: 'agent',
                timestamp: new Date(Date.now() - 1500000)
            },
            {
                id: '3',
                content: 'Thank you for your help!',
                sender: 'customer',
                timestamp: new Date(Date.now() - 1200000)
            }
        ]
    };

    const messages = mockMessagesData[conversationId] || [];

    const container = document.getElementById('messagesContainer');
    container.innerHTML = messages.map(msg => `
        <div class="message ${msg.sender === 'customer' ? 'incoming' : 'outgoing'}">
            <div>${escapeHtml(msg.content)}</div>
            <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function claimConversation() {
    if (!activeConversation) return;

    // Update conversation status
    activeConversation.claimed = true;
    activeConversation.agentId = currentUser.id;

    // Emit socket event
    if (socket) {
        socket.emit('claim-conversation', {
            conversationId: activeConversation.id,
            agentId: currentUser.id
        });
    }

    // Update UI
    selectConversation(activeConversation.id);
    showNotification('Conversation claimed successfully!', 'success');
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || !activeConversation) return;

    // Add message to UI immediately
    const container = document.getElementById('messagesContainer');
    const messageElement = document.createElement('div');
    messageElement.className = 'message outgoing fade-in';
    messageElement.innerHTML = `
        <div>${escapeHtml(message)}</div>
        <div class="message-time">${formatTime(new Date())}</div>
    `;
    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;

    // Update conversation last message
    activeConversation.lastMessage = message;
    activeConversation.timestamp = new Date();
    renderConversations();

    // Emit socket event
    if (socket) {
        socket.emit('send-message', {
            conversationId: activeConversation.id,
            content: message,
            sender: 'agent',
            timestamp: new Date().toISOString()
        });
    }

    // Clear input
    input.value = '';

    // Auto-resize if textarea
    if (input.tagName === 'TEXTAREA') {
        input.style.height = 'auto';
    }

    // Simulate customer response after a delay (for demo purposes)
    if (Math.random() > 0.7) { // 30% chance of auto-response
        setTimeout(() => {
            simulateCustomerResponse();
        }, 2000 + Math.random() * 3000);
    }
}

// Mock bot functionality - simulates incoming messages
function simulateIncomingMessage() {
    const mockMessages = [
        { content: "Hello, I need assistance with my order", customerName: "Alice Cooper", source: "WhatsApp" },
        { content: "Can you help me track my package?", customerName: "Bob Johnson", source: "Facebook" },
        { content: "I want to change my delivery address", customerName: "Carol White", source: "Instagram" },
        { content: "When will my refund be processed?", customerName: "David Brown", source: "WhatsApp" },
        { content: "The product I received is damaged", customerName: "Eva Green", source: "Facebook" }
    ];

    const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];
    
    // Check if conversation already exists for this customer
    let existingConv = conversations.find(c => c.customerName === randomMessage.customerName);
    
    if (existingConv) {
        // Update existing conversation
        existingConv.lastMessage = randomMessage.content;
        existingConv.timestamp = new Date();
        
        // If it's the active conversation, add message to chat
        if (activeConversation && activeConversation.id === existingConv.id) {
            const container = document.getElementById('messagesContainer');
            const messageElement = document.createElement('div');
            messageElement.className = 'message incoming fade-in';
            messageElement.innerHTML = `
                <div>${escapeHtml(randomMessage.content)}</div>
                <div class="message-time">${formatTime(new Date())}</div>
            `;
            container.appendChild(messageElement);
            container.scrollTop = container.scrollHeight;
        }
    } else {
        // Create new conversation
        const newConversation = {
            id: generateId(),
            customerName: randomMessage.customerName,
            source: randomMessage.source,
            lastMessage: randomMessage.content,
            timestamp: new Date(),
            claimed: false,
            agentId: null
        };
        
        conversations.unshift(newConversation);
    }
    
    renderConversations();
    
    // Show notification
    showNotification(`New message from ${randomMessage.customerName}`, 'info');
}

// Simulate customer response to agent messages
function simulateCustomerResponse() {
    if (!activeConversation || !activeConversation.claimed || activeConversation.agentId !== currentUser.id) {
        return;
    }

    const responses = [
        "Thank you for the quick response!",
        "That's exactly what I needed to know.",
        "Perfect, I appreciate your help.",
        "Got it, thanks!",
        "That makes sense, thank you.",
        "I understand now, thanks for explaining.",
        "Great! Is there anything else I should know?",
        "Thanks for your patience with my questions.",
        "This is very helpful, thank you!",
        "I really appreciate your assistance."
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    // Add customer message to UI
    const container = document.getElementById('messagesContainer');
    const messageElement = document.createElement('div');
    messageElement.className = 'message incoming fade-in';
    messageElement.innerHTML = `
        <div>${escapeHtml(randomResponse)}</div>
        <div class="message-time">${formatTime(new Date())}</div>
    `;
    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;

    // Update conversation
    activeConversation.lastMessage = randomResponse;
    activeConversation.timestamp = new Date();
    renderConversations();

    // Emit socket event
    if (socket) {
        socket.emit('customer-message', {
            conversationId: activeConversation.id,
            content: randomResponse,
            sender: 'customer',
            timestamp: new Date().toISOString()
        });
    }
}

// Start demo mode - simulates incoming messages
function startDemoMode() {
    // Simulate new conversations every 30-60 seconds
    setInterval(() => {
        if (Math.random() > 0.7) { // 30% chance
            simulateIncomingMessage();
        }
    }, 30000 + Math.random() * 30000);
}

// Initialize demo mode when app loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (currentUser) {
            startDemoMode();
        }
    }, 5000); // Start demo after 5 seconds
});

// Keyboard shortcuts for chat
document.addEventListener('keydown', function(e) {
    if (activeConversation && activeConversation.claimed && activeConversation.agentId === currentUser?.id) {
        // Ctrl/Cmd + Enter to send message
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    }
});

// Auto-save draft messages
let draftTimeout;
function saveDraft() {
    if (draftTimeout) clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
        const input = document.getElementById('messageInput');
        if (input && input.value.trim() && activeConversation) {
            setLocalStorage(`draft_${activeConversation.id}`, input.value);
        }
    }, 1000);
}

// Load draft message when selecting conversation
function loadDraft(conversationId) {
    const draft = getLocalStorage(`draft_${conversationId}`, '');
    const input = document.getElementById('messageInput');
    if (input && draft) {
        input.value = draft;
    }
}

// Clear draft when message is sent
function clearDraft(conversationId) {
    removeLocalStorage(`draft_${conversationId}`);
}

// Add event listener for draft saving
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', saveDraft);
    }
});

// Update sendMessage to clear draft
const originalSendMessage = sendMessage;
sendMessage = function() {
    const result = originalSendMessage();
    if (activeConversation) {
        clearDraft(activeConversation.id);
    }
    return result;
};

// Update selectConversation to load draft
const originalSelectConversation = selectConversation;
selectConversation = function(conversationId) {
    const result = originalSelectConversation(conversationId);
    if (activeConversation) {
        loadDraft(conversationId);
    }
    return result;
};