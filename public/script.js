    // ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let currentUser = null;
let socket = null;
let currentChatUser = null;
let users = [];
let isTyping = false;
let typingTimeout = null;

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

        // Save the JWT token to localStorage
        localStorage.setItem('token', data.token);

        // Save user info in memory
        currentUser = data.user;

        // Redirect based on role
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
    currentUser = null;
    localStorage.removeItem('token');
    if (socket) socket = null;
    showLogin();
}


function checkAuth() {
    // For demo purposes, no persistent auth
    return false;
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
    loadChatUsers();
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
fetch('https://omni-chat-app-dbd9c00cc9c4.herokuapp.com/api/users')
    .then(response => response.json())
    .then(data => {
        const usersTableBody = document.getElementById('usersTableBody');

        // Clear previous rows (optional if reloading)
        usersTableBody.innerHTML = '';

        // Count users
        const totalUsers = data.length;
        const onlineUsers = data.filter(user => user.isOnline).length;

        // Update counts in the DOM
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('onlineUsers').textContent = onlineUsers;

        // Display each user in the table
        data.forEach(user => {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            nameTd.textContent = user.name;
            tr.appendChild(nameTd);

            const emailTd = document.createElement('td');
            emailTd.textContent = user.email;
            tr.appendChild(emailTd);

            const roleTd = document.createElement('td');
            roleTd.textContent = user.role;
            tr.appendChild(roleTd);

            const supervisorTd = document.createElement('td');
            supervisorTd.textContent = user.supervisor;
            tr.appendChild(supervisorTd);
            
            const statusTd = document.createElement('td');
            statusTd.textContent = user.isOnline ? '🟢 Online' : '⚪ Offline';
            tr.appendChild(statusTd);

            const actionsTd = document.createElement('td');
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.onclick = function() { editUser(user._id); };
            actionsTd.appendChild(editButton);
            tr.appendChild(actionsTd);

            usersTableBody.appendChild(tr);
        });
    })
    .catch(error => console.error('Error:', error));

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

document.getElementById('addUserForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('newUserName').value;
    const email = document.getElementById('newUserEmail').value;
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const supervisor_id = document.getElementById('newUserSupervisor').value || null;

    const newUser = { name, email, password, role, supervisor_id };

    try {
        const token = localStorage.getItem('token'); // assuming you store JWT this way

        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // if required
            },
            body: JSON.stringify(newUser)
        });
        
        // Update stats
        document.getElementById('totalUsers').textContent = users.length;

        const onlineCount = users.filter(u => u.isOnline).length;
        document.getElementById('onlineUsers').textContent = onlineCount;


        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to add user');
        }

        alert('User added successfully!');
        closeAddUserModal();
        loadUsersTable(); // reloads table
    } catch (err) {
        document.getElementById('addUserError').textContent = err.message;
    }
});

function editUser(userId) {
    alert('Edit functionality would open a modal with user details');
}

function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    users = users.filter(u => u.id !== userId);
    loadUsersTable();
    alert('User deleted successfully!');
}

function searchMessages() {
    const query = document.getElementById('messageSearchInput').value.trim();
    if (!query) return;
    
    const results = demoMessages.filter(msg => 
        msg.content.toLowerCase().includes(query.toLowerCase())
    );
    
    displaySearchResults(results);
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
/* ======================
   MESSAGE DISPLAY SYSTEM
   ====================== */

// 1. DOM Elements
const messageList = document.getElementById('broadcastMessageList');

// 2. Load initial messages when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await loadUnclaimedMessages();
  setupSocketListeners();
});

async function loadUnclaimedMessages() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    messageList.innerHTML = `
      <div class="error">
        <p>Not authenticated</p>
        <button onclick="showLogin()">Login Now</button>
      </div>
    `;
    return;
  }

  try {
    const response = await fetch('/api/messages/unclaimed', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      showLogin();
      return;
    }

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const messages = await response.json();
    updateUnclaimedMessages(messages);

  } catch (error) {
    console.error('Failed to load messages:', error);
    messageList.innerHTML = `
      <div class="error">
        <p>Failed to load messages</p>
        <small>${error.message}</small>
        <button onclick="loadUnclaimedMessages()" class="retry-btn">Retry</button>
      </div>
    `;
  }
}

// 4. Display messages in the sidebar
function updateUnclaimedMessages(messages) {
  messageList.innerHTML = ''; // Clear existing
  // Temporarily add this before your if statement
console.log("Messages array:", messages); 
  
  if (messages.length === 0) {
    messageList.innerHTML = '<div class="empty">No unclaimed messages</div>';
    return;
  }

  messages.forEach(msg => {
    const messageDiv = createMessageElement(msg);
    messageList.appendChild(messageDiv);
  });
}

// 5. Create individual message element
function createMessageElement(msg) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-user';
  messageDiv.dataset.messageId = msg._id;
  
  // Format message preview
  let preview = msg.content?.text || '';
  if (msg.content?.attachments?.length > 0) {
    preview = `[${msg.content.attachments[0].type.toUpperCase()}] ${msg.content.attachments[0].caption || ''}`;
  }

  messageDiv.innerHTML = `
    <div class="message-header">
      <strong>${msg.sender?.name || 'Facebook User'}</strong>
      <span class="message-time">${formatTime(msg.timestamp)}</span>
    </div>
    <div class="message-preview">${preview.slice(0, 50)}${preview.length > 50 ? '...' : ''}</div>
    <div class="message-platform">${msg.platform.toUpperCase()}</div>
  `;

  messageDiv.addEventListener('click', () => selectChatMessage(msg));
  return messageDiv;
}

// 6. Format timestamp
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// 7. Socket.IO real-time updates
function setupSocketListeners() {
  socket.on('new_message', (data) => {
    if (data.event === 'facebook_message') {
      const messageDiv = createMessageElement(data.message);
      messageList.insertBefore(messageDiv, messageList.firstChild);
      
      // Remove "No messages" placeholder if present
      const emptyMsg = document.querySelector('.empty');
      if (emptyMsg) emptyMsg.remove();
    }
  });
}
// ================================
// LOGIC 7: SELECT MESSAGE AND LOAD CHAT
// ================================

function selectChatMessage(messageMeta) {
    currentChatUser = { 
        id: messageMeta.sender?.id || messageMeta.senderId, 
        name: messageMeta.sender?.name || messageMeta.senderName 
    };

    // Update UI
    document.getElementById('chatUserName').textContent = `Chatting with ${currentChatUser.name}`;
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;

    // Load messages
    loadChatMessages(currentChatUser.id);
}

function loadChatMessages(senderId) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '<div class="loading">Loading messages...</div>';

    fetch(`/api/messages/${senderId}`, {
        headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(res => {
        if (!res.ok) throw new Error('Failed to load messages');
        return res.json();
    })
    .then(messages => {
        messagesContainer.innerHTML = '';
        messages.forEach(msg => displayMessage(msg));
        scrollToBottom();
    })
    .catch(err => {
        console.error('Failed to load messages:', err);
        messagesContainer.innerHTML = `<div class="error">${err.message}</div>`;
    });
}

function displayMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    const isOwnMessage = message.sender?.id === currentUser?.id || 
                        message.senderId === currentUser?.id;
    
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
    
    const senderName = message.sender?.name || 
                      (isOwnMessage ? 'You' : 'Unknown');
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${senderName.charAt(0).toUpperCase()}</div>
        <div class="message-content">
            <div class="message-bubble">
                ${message.content?.text || '[No content]'}
            </div>
            <div class="message-info">
                ${senderName} • ${new Date(message.timestamp || message.createdAt).toLocaleTimeString()}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Check for existing auth
    if (checkAuth()) {
        // Auto-login would go here
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
            // Reset loading state
            loginBtn.disabled = false;
            loginText.style.display = 'block';
            loginSpinner.style.display = 'none';
        }
    });
    
    // Add user form
    document.getElementById('addUserForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('newUserName') || document.getElementById('newUserName').value,
            email: formData.get('newUserEmail') || document.getElementById('newUserEmail').value,
            password: formData.get('newUserPassword') || document.getElementById('newUserPassword').value,
            role: formData.get('newUserRole') || document.getElementById('newUserRole').value,
            supervisor: document.getElementById('newUserSupervisor').value
        };
        
        // Basic validation
        if (!userData.name || !userData.email || !userData.password) {
            document.getElementById('addUserError').textContent = 'All fields are required';
            return;
        }
        
        // Check if email already exists
        if (users.some(u => u.email === userData.email)) {
            document.getElementById('addUserError').textContent = 'Email already exists';
            return;
        }
        
        addUser(userData);
    });
    
    // Message input events
    const messageInput = document.getElementById('messageInput');
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

function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function sanitizeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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