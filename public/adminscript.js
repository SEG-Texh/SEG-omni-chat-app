// adminscript.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated and is admin
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName');
    
    if (!token || userRole !== 'admin') {
        // Redirect to login if not authenticated or not admin
        window.location.href = '/login.html';
        return;
    }
    
    // Set admin name in header
    if (userName) {
        document.getElementById('adminName').textContent = `Welcome, ${userName}`;
    }
    
    // Load initial data
    loadDashboardData();
    
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Add user form submission
    document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    
    // Search functionality
    document.getElementById('userSearch').addEventListener('input', handleUserSearch);
    document.getElementById('messageSearch').addEventListener('input', handleMessageSearch);
    
    // Message filter
    document.getElementById('messageFilter').addEventListener('change', handleMessageFilter);
}

async function loadDashboardData() {
    try {
        await Promise.all([
            loadStats(),
            loadRecentActivity(),
            loadUsers(),
            loadMessages()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('Error loading dashboard data', 'error');
    }
}

async function loadStats() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
            document.getElementById('activeUsers').textContent = stats.activeUsers || 0;
            document.getElementById('totalMessages').textContent = stats.totalMessages || 0;
            document.getElementById('todayMessages').textContent = stats.todayMessages || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadRecentActivity() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/admin/recent-activity', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const activities = await response.json();
            displayRecentActivity(activities);
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
        document.getElementById('recentActivity').innerHTML = '<p>Error loading recent activity</p>';
    }
}

async function loadUsers() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            displayUsers(users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="6">Error loading users</td></tr>';
    }
}

async function loadMessages() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/admin/messages', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const messages = await response.json();
            displayMessages(messages);
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        document.getElementById('messagesContainer').innerHTML = '<p>Error loading messages</p>';
    }
}

function displayRecentActivity(activities) {
    const container = document.getElementById('recentActivity');
    
    if (!activities || activities.length === 0) {
        container.innerHTML = '<p>No recent activity</p>';
        return;
    }
    
    const html = activities.map(activity => `
        <div class="activity-item" style="padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 10px; background: #f8fafc;">
            <div style="font-weight: 600; color: #374151;">${activity.action}</div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 5px;">${activity.details}</div>
            <div style="color: #9ca3af; font-size: 12px; margin-top: 5px;">${formatDate(activity.timestamp)}</div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
        return;
    }
    
    const html = users.map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td><span class="status-badge ${user.status}">${user.status}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <button class="btn-small" onclick="editUser('${user._id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-small btn-danger" onclick="deleteUser('${user._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<p>No messages found</p>';
        return;
    }
    
    const html = messages.map(message => `
        <div class="message-item" style="padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px; background: white;">
            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 10px;">
                <div>
                    <strong>${message.sender?.name || 'Unknown'}</strong>
                    <span style="color: #6b7280; font-size: 14px; margin-left: 10px;">${message.sender?.email || ''}</span>
                </div>
                <div style="color: #9ca3af; font-size: 12px;">${formatDate(message.timestamp)}</div>
            </div>
            <div style="color: #374151; margin-bottom: 10px;">${message.content}</div>
            <div style="display: flex; gap: 10px;">
                <span class="platform-badge">${message.platform || 'web'}</span>
                <button class="btn-small btn-danger" onclick="deleteMessage('${message._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

async function handleAddUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role')
    };
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });
        
        if (response.ok) {
            showAlert('User added successfully', 'success');
            e.target.reset();
            loadUsers();
            loadStats();
        } else {
            const error = await response.json();
            showAlert(error.message || 'Error adding user', 'error');
        }
    } catch (error) {
        console.error('Error adding user:', error);
        showAlert('Error adding user', 'error');
    }
}

function handleUserSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#usersTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function handleMessageSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const messages = document.querySelectorAll('.message-item');
    
    messages.forEach(message => {
        const text = message.textContent.toLowerCase();
        message.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function handleMessageFilter(e) {
    const filter = e.target.value;
    // Implement message filtering logic based on date
    loadMessages(); // For now, just reload messages
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

function refreshMessages() {
    loadMessages();
}

function clearMessages() {
    if (confirm('Are you sure you want to clear all messages? This action cannot be undone.')) {
        // Implement clear messages functionality
        console.log('Clear messages requested');
    }
}

function editUser(userId) {
    // Implement edit user functionality
    console.log('Edit user:', userId);
}

function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        // Implement delete user functionality
        console.log('Delete user:', userId);
    }
}

function deleteMessage(messageId) {
    if (confirm('Are you sure you want to delete this message?')) {
        // Implement delete message functionality
        console.log('Delete message:', messageId);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        window.location.href = '/login.html';
    }
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
    `;
    
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}