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
// ============================================================================
async function loadDashboardData() {
    try {
        const response = await fetch('/api/users');
        users = await response.json();
        loadUsersTable();
        loadSupervisors();
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

const API_URL = 'https://omni-chat-app-dbd9c00cc9c4.herokuapp.com/api/users';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODNlY2E5ZTM1ZjE1NDBhZjhkN2E0OWUiLCJpYXQiOjE3NDg5NjYzMDMsImV4cCI6MTc0OTU3MTEwM30.2RUSGmyUgBb7rQTewn1XxZ7f57z6sqv03ZmIwydJkyQ'; // Replace with your actual token

async function loadUsers() {
  try {
    const res = await fetch(API_URL, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    if (!res.ok) {
      throw new Error('Failed to fetch users');
    }

    const users = await res.json();
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = ''; // Clear existing rows

    users.forEach(user => {
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${user.supervisor_id ? user.supervisor_id.name : '-'}</td>
        <td>${user.isOnline ? '🟢 Online' : '⚪ Offline'}</td>
        <td>
          <button onclick="editUser('${user._id}')">Edit</button>
          <button onclick="deleteUser('${user._id}')">Delete</button>
        </td>
      `;

      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading users:', err);
    alert('Could not load users.');
  }
}

// Call it when the page loads
window.addEventListener('DOMContentLoaded', loadUsers);
async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Network error');
    const users = await response.json();

    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';  // Clear any existing rows

    users.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${user.supervisor || '-'}</td>
        <td>${user.status}</td>
        <td>
          <button onclick="editUser('${user._id}')">Edit</button>
          <button onclick="deleteUser('${user._id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

// Call loadUsers() when the page or users tab loads
loadUsers();

function loadSupervisors() {
    const select = document.getElementById('newUserSupervisor');
    select.innerHTML = '<option value="">No Supervisor</option>';
    
    const supervisors = users.filter(u => u.role === 'supervisor' || u.role === 'admin');
    supervisors.forEach(supervisor => {
        const option = document.createElement('option');
        option.value = supervisor.id;
        option.textContent = supervisor.name;
        select.appendChild(option);
    });
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
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
function initializeSocket() {
    // Demo socket simulation
    socket = {
        emit: (event, data) => {
            console.log('Socket emit:', event, data);
            if (event === 'sendMessage') {
                // Simulate message sending
                setTimeout(() => {
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
        },
        on: (event, callback) => {
            console.log('Socket listening to:', event);
        }
    };
    
    // Simulate socket events
    socket.on('newMessage', displayMessage);
    socket.on('userTyping', showTypingIndicator);
    socket.on('userStoppedTyping', hideTypingIndicator);
    socket.on('userStatusChanged', updateUserStatus);
}

function loadChatUsers() {
    const userList = document.getElementById('chatUserList');
    userList.innerHTML = '';
    
    const otherUsers = demoUsers.filter(u => u.id !== currentUser.id);
    
    otherUsers.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.onclick = () => selectChatUser(user);
        userDiv.innerHTML = `
            <div class="user-status ${user.isOnline ? 'online' : 'offline'}"></div>
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
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    
    // Load messages for this conversation
    loadChatMessages(user);
}

function loadChatMessages(user) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    // Filter messages for this conversation
    const conversationMessages = demoMessages.filter(msg => 
        (msg.sender.id === currentUser.id && msg.receiver.id === user.id) ||
        (msg.sender.id === user.id && msg.receiver.id === currentUser.id)
    );
    
    conversationMessages.forEach(message => {
        displayMessage(message);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayMessage(message) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    const isOwnMessage = message.sender.id === currentUser.id;
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${message.sender.name.charAt(0).toUpperCase()}</div>
        <div class="message-content">
            <div class="message-bubble">
                ${message.content}
            </div>
            <div class="message-info">
                ${message.sender.name} • ${new Date(message.createdAt).toLocaleTimeString()}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentChatUser) return;
    
    socket.emit('sendMessage', {
        receiverId: currentChatUser.id,
        content: content
    });
    
    input.value = '';
    stopTyping();
}

function handleTyping() {
    if (!isTyping && currentChatUser) {
        isTyping = true;
        socket.emit('typing', { receiverId: currentChatUser.id });
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        stopTyping();
    }, 1000);
}

function stopTyping() {
    if (isTyping && currentChatUser) {
        isTyping = false;
        socket.emit('stopTyping', { receiverId: currentChatUser.id });
    }
}

function showTypingIndicator(data) {
    if (data.senderId === currentChatUser?.id) {
        const indicator = document.getElementById('typingIndicator');
        indicator.textContent = `${currentChatUser.name} is typing...`;
        indicator.style.display = 'block';
    }
}

function hideTypingIndicator(data) {
    if (data.senderId === currentChatUser?.id) {
        const indicator = document.getElementById('typingIndicator');
        indicator.style.display = 'none';
    }
}

function updateUserStatus(data) {
    const user = demoUsers.find(u => u.id === data.userId);
    if (user) {
        user.isOnline = data.isOnline;
        loadChatUsers();
        if (currentUser.role === 'admin') {
            loadUsersTable();
        }
    }
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