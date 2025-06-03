// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let currentUser = null;
let socket = null;
let currentChatUser = null;
let users = [];
let isTyping = false;
let typingTimeout = null;

// Demo data for frontend testing (replace with API data in production)
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Login failed');
        }

        localStorage.setItem('token', data.token);
        currentUser = data.user;

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
    // Could add token validation here
    const token = localStorage.getItem('token');
    return !!token;
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

    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role;
    document.getElementById('userRole').className = `badge ${currentUser.role}`;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

    loadUsers();
    loadSupervisors();
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
// USER MANAGEMENT FUNCTIONS
// ============================================================================

async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/users', {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to fetch users');

        users = await res.json();

        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.supervisor ? user.supervisor.name || user.supervisor : '-'}</td>
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

function loadSupervisors() {
    const select = document.getElementById('newUserSupervisor');
    select.innerHTML = '<option value="">No Supervisor</option>';

    const supervisors = users.filter(u => u.role === 'supervisor' || u.role === 'admin');
    supervisors.forEach(supervisor => {
        const option = document.createElement('option');
        option.value = supervisor._id || supervisor.id;
        option.textContent = supervisor.name;
        select.appendChild(option);
    });
}

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

    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const role = document.getElementById('newUserRole').value;
    const supervisor_id = document.getElementById('newUserSupervisor').value || null;

    if (!name || !email || !password) {
        document.getElementById('addUserError').textContent = 'Please fill in all required fields.';
        return;
    }

    const newUser = { name, email, password, role, supervisor_id };

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(newUser),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to add user');
        }

        alert('User added successfully!');
        closeAddUserModal();
        await loadUsers();
    } catch (err) {
        document.getElementById('addUserError').textContent = err.message;
    }
});

function editUser(userId) {
    alert(`Edit functionality for user ${userId} to be implemented`);
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!res.ok) throw new Error('Failed to delete user');

        alert('User deleted successfully!');
        await loadUsers();
    } catch (error) {
        alert('Error deleting user: ' + error.message);
    }
}

// ============================================================================
// CHAT FUNCTIONS
// ============================================================================
function initializeSocket() {
    // Simulated socket - replace with actual socket.io connection in production
    socket = {
        emit: (event, data) => {
            console.log('Socket emit:', event, data);

            if (event === 'sendMessage') {
                setTimeout(() => {
                    const message = {
                        id: Date.now().toString(),
                        sender: currentUser,
                        receiver: currentChatUser,
                        content: data.content,
                        createdAt: new Date(),
                    };
                    displayMessage(message);

                    if (currentChatUser && currentChatUser.id !== currentUser.id) {
                        setTimeout(() => {
                            const autoReply = {
                                id: (Date.now() + 1).toString(),
                                sender: currentChatUser,
                                receiver: currentUser,
                                content: `Thanks for your message: "${data.content}"`,
                                createdAt: new Date(),
                            };
                            displayMessage(autoReply);
                        }, 2000);
                    }
                }, 100);
            }
        },
        on: (event, callback) => {
            console.log('Socket listening to:', event);
            // This can be implemented if you use real socket.io client
        },
    };

    socket.on('newMessage', displayMessage);
}

function loadChatUsers() {
    // In real app, load from API or socket
    users = demoUsers;

    const userList = document.getElementById('userList');
    userList.innerHTML = '';

    users.forEach(user => {
        if (user.id === currentUser?.id) return; // Don't show yourself in chat user list

        const userDiv = document.createElement('div');
        userDiv.className = 'user';
        userDiv.textContent = user.name;
        userDiv.onclick = (e) => selectChatUser(user, e);
        userList.appendChild(userDiv);
    });
}

function selectChatUser(user, event) {
    currentChatUser = user;

    // Remove active class from all users
    const allUsers = document.querySelectorAll('#userList .user');
    allUsers.forEach(u => u.classList.remove('active'));

    // Add active class to clicked user
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    const chatHeader = document.getElementById('chatHeader');
    chatHeader.textContent = `Chat with ${user.name}`;

    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    // Load demo messages for selected user (replace with real messages from API)
    demoMessages
        .filter(m =>
            (m.sender.id === user.id && m.receiver.id === currentUser.id) ||
            (m.sender.id === currentUser.id && m.receiver.id === user.id)
        )
        .forEach(displayMessage);
}

function displayMessage(message) {
    const chatMessages = document.getElementById('chatMessages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender.id === currentUser.id ? 'sent' : 'received'}`;

    messageDiv.innerHTML = `
        <div><strong>${message.sender.name}</strong></div>
        <div>${message.content}</div>
        <div class="timestamp">${new Date(message.createdAt).toLocaleString()}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;

    if (!currentChatUser) {
        alert('Please select a user to chat with first.');
        return;
    }

    socket.emit('sendMessage', { to: currentChatUser.id, content });

    input.value = '';
    input.focus();
}

function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing', { to: currentChatUser.id });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        socket.emit('stopTyping', { to: currentChatUser.id });
    }, 1000);
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================
function showTab(tabName, event) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.style.display = tab.id === tabName ? 'block' : 'none';
    });

    // Remove active from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Login form submit
document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
        await login(email, password);
    } catch (err) {
        alert(err.message);
    }
});

// Logout button
document.getElementById('logoutBtn').addEventListener('click', () => {
    logout();
});

// Send message on Enter key in chat input
document.getElementById('messageInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    } else {
        handleTyping();
    }
});

// Add user button
document.getElementById('addUserBtn').addEventListener('click', showAddUserModal);

// Close add user modal
document.getElementById('closeAddUserModal').addEventListener('click', closeAddUserModal);

// Tab buttons
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        showTab(btn.dataset.tab, e);
    });
});

// ============================================================================
// INITIALIZATION
// ============================================================================
window.onload = () => {
    if (checkAuth()) {
        // Load user info from token or fetch user data
        // For demo, use dummy user
        currentUser = demoUsers[0]; // Admin user by default for demo
        showDashboard();
    } else {
        showLogin();
    }
};
