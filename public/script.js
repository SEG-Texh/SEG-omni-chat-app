// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let currentUser = JSON.parse(localStorage.getItem("user"));
let selectedRecipientId = null;
let selectedPlatform = null;
let socket = null;
let isTyping = false;
let typingTimeout = null;

// DOM Elements
const broadcastMessageList = document.getElementById("broadcastMessageList");
const chatUserName = document.getElementById("chatUserName");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================
async function login(email, password) {
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Login failed');
        }

        localStorage.setItem('token', data.token);
        currentUser = data.user;
        localStorage.setItem("user", JSON.stringify(currentUser));

        if (currentUser.role === 'admin') {
            showDashboard();
        } else {
            showChat();
        }
    } catch (err) {
        throw new Error(err.message || 'Login error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    if (socket) socket.disconnect();
    showLogin();
}

// ============================================================================
// UI NAVIGATION FUNCTIONS
// ============================================================================
function showLogin() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('dashboardContainer').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'block';
    document.getElementById('chatContainer').style.display = 'none';
    
    // Update user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role;
    document.getElementById('userRole').className = `badge ${currentUser.role}`;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    
    loadDashboardData();
}

function showChat() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    
    initializeSocket();
    loadBroadcastedMessages();
}

function openChat() {
    showChat();
}

function goToDashboard() {
    if (currentUser && currentUser.role === 'admin') {
        showDashboard();
    }
}

// ============================================================================
// DASHBOARD FUNCTIONS
// ============================================================================
async function loadDashboardData() {
    try {
        const res = await fetch('/api/users', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });
        const users = await res.json();
        
        const usersTableBody = document.getElementById('usersTableBody');
        usersTableBody.innerHTML = '';

        // Update stats
        document.getElementById('totalUsers').textContent = users.length;
        const onlineUsers = users.filter(u => u.isOnline).length;
        document.getElementById('onlineUsers').textContent = onlineUsers;

        // Populate users table
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.supervisor || '-'}</td>
                <td>${user.isOnline ? '🟢 Online' : '⚪ Offline'}</td>
                <td class="actions">
                    <button class="btn-small btn-edit" onclick="editUser('${user._id}')">Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteUser('${user._id}')">Delete</button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// ============================================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================================
function showAddUserModal() {
    document.getElementById('addUserModal').classList.add('show');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('show');
    document.getElementById('addUserForm').reset();
    document.getElementById('addUserError').textContent = '';
}

async function addUser(userData) {
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(userData)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to add user');
        }

        alert('User added successfully!');
        closeAddUserModal();
        loadDashboardData();
    } catch (err) {
        document.getElementById('addUserError').textContent = err.message;
    }
}

function editUser(userId) {
    alert('Edit functionality would open a modal with user details');
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const res = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("token")}`
            }
        });

        if (!res.ok) {
            throw new Error('Failed to delete user');
        }

        alert('User deleted successfully!');
        loadDashboardData();
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
    }
}

// ============================================================================
// MESSAGE SEARCH FUNCTIONS
// ============================================================================
async function searchMessages() {
    const query = document.getElementById('messageSearchInput').value.trim();
    if (!query) return;
    
    try {
        const res = await fetch(`/api/messages/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("token")}`
            }
        });
        const results = await res.json();
        displaySearchResults(results);
    } catch (error) {
        console.error('Error searching messages:', error);
    }
}

function displaySearchResults(messages) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';
    
    if (messages.length === 0) {
        resultsDiv.innerHTML = '<p>No messages found.</p>';
        return;
    }
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = 'border: 1px solid #e1e5e9; padding: 15px; margin: 10px 0; border-radius: 6px;';
        messageDiv.innerHTML = `
            <div><strong>From:</strong> ${message.sender.name} (${message.sender.email})</div>
            <div><strong>To:</strong> ${message.receiver ? message.receiver.name : 'Broadcast'}</div>
            <div><strong>Message:</strong> ${message.content}</div>
            <div><strong>Time:</strong> ${new Date(message.createdAt).toLocaleString()}</div>
        `;
        resultsDiv.appendChild(messageDiv);
    });
}

// ============================================================================
// CHAT FUNCTIONS
// ============================================================================
async function loadBroadcastedMessages() {
    try {
        const res = await fetch("/api/messages/unclaimed", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });
        const messages = await res.json();
        broadcastMessageList.innerHTML = '';

        messages.forEach(msg => {
            const div = document.createElement("div");
            div.classList.add("chat-user");
            div.innerHTML = `
                <strong>${msg.senderName || msg.sourceId}</strong><br>
                <small>${msg.platform.toUpperCase()} | ${msg.text.slice(0, 50)}...</small>
            `;
            div.onclick = () => selectMessage(msg);
            broadcastMessageList.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading broadcasted messages:', error);
    }
}

async function selectMessage(msg) {
    selectedRecipientId = msg.sourceId;
    selectedPlatform = msg.platform;
    chatUserName.textContent = `Replying to ${msg.senderName || msg.sourceId} via ${msg.platform}`;
    messageInput.disabled = false;
    sendBtn.disabled = false;

    try {
        const res = await fetch(`/api/messages/conversation/${selectedRecipientId}`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });
        const convo = await res.json();
        chatMessages.innerHTML = '';

        convo.forEach(m => {
            const div = document.createElement("div");
            div.className = m.from === currentUser._id ? 'sent' : 'received';
            div.innerHTML = `<p>${m.text}</p><small>${new Date(m.createdAt).toLocaleString()}</small>`;
            chatMessages.appendChild(div);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error loading conversation:', error);
    }
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !selectedRecipientId) return;

    try {
        const res = await fetch("/api/messages/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({
                to: selectedRecipientId,
                platform: selectedPlatform,
                text
            })
        });

        const data = await res.json();
        if (data.success) {
            messageInput.value = '';
            await selectMessage({ sourceId: selectedRecipientId, platform: selectedPlatform });
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

function initializeSocket() {
    socket = io('https://omni-chat-app-dbd9c00cc9c4.herokuapp.com', {
        transports: ['websocket'],
        auth: {
            token: localStorage.getItem('token')
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20000
    });

    socket.on('connect', () => {
        console.log('✅ Connected to server via WebSocket');
    });

    socket.on('disconnect', (reason) => {
        console.warn('⚠️ Disconnected from server:', reason);
        if (reason === 'io server disconnect') {
            socket.connect();
        }
    });

    socket.on('reconnect_attempt', () => {
        console.log('🔄 Attempting to reconnect...');
    });

    socket.on('newMessage', displayMessage);
    socket.on('userTyping', showTypingIndicator);
    socket.on('userStoppedTyping', hideTypingIndicator);
    socket.on('userOnline', updateUserStatus);
    socket.on('userOffline', updateUserStatus);
}

function handleTyping() {
    if (!isTyping && selectedRecipientId) {
        isTyping = true;
        socket.emit('typing', { 
            receiverId: selectedRecipientId,
            platform: selectedPlatform
        });
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        stopTyping();
    }, 1000);
}

function stopTyping() {
    if (isTyping && selectedRecipientId) {
        isTyping = false;
        socket.emit('stopTyping', { 
            receiverId: selectedRecipientId,
            platform: selectedPlatform
        });
    }
}

function showTypingIndicator(data) {
    if (data.senderId === selectedRecipientId && data.platform === selectedPlatform) {
        const indicator = document.getElementById('typingIndicator');
        indicator.textContent = `${data.senderName || data.senderId} is typing...`;
        indicator.style.display = 'block';
    }
}

function hideTypingIndicator(data) {
    if (data.senderId === selectedRecipientId && data.platform === selectedPlatform) {
        const indicator = document.getElementById('typingIndicator');
        indicator.style.display = 'none';
    }
}

function updateUserStatus(data) {
    // Update user status in the UI
    if (currentUser.role === 'admin') {
        loadDashboardData();
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Check for existing auth
    if (localStorage.getItem("token")) {
        currentUser = JSON.parse(localStorage.getItem("user"));
        if (currentUser.role === 'admin') {
            showDashboard();
        } else {
            showChat();
        }
    } else {
        showLogin();
    }
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        const loginText = document.getElementById('loginText');
        const loginSpinner = document.getElementById('loginSpinner');
        const loginError = document.getElementById('loginError');
        
        // Show loading state
        loginBtn.disabled = true;
        loginText.style.display = 'none';
        loginSpinner.style.display = 'block';
        loginError.textContent = '';
        
        try {
            await login(email, password);
        } catch (error) {
            loginError.textContent = error.message;
        } finally {
            loginBtn.disabled = false;
            loginText.style.display = 'block';
            loginSpinner.style.display = 'none';
        }
    });
    
    // Add user form
    document.getElementById('addUserForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const userData = {
            name: document.getElementById('newUserName').value,
            email: document.getElementById('newUserEmail').value,
            password: document.getElementById('newUserPassword').value,
            role: document.getElementById('newUserRole').value,
            supervisor: document.getElementById('newUserSupervisor').value || null
        };
        
        if (!userData.name || !userData.email || !userData.password) {
            document.getElementById('addUserError').textContent = 'All fields are required';
            return;
        }
        
        addUser(userData);
    });
    
    // Message input events
    if (messageInput) {
        messageInput.addEventListener('input', handleTyping);
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Click outside modal to close
    document.getElementById('addUserModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeAddUserModal();
        }
    });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatDate(date) {
    return new Date(date).toLocaleDateString();
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString();
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});