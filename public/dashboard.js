// ============================================================================
// DASHBOARD FUNCTIONS
// ============================================================================

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

let users = [];

function loadDashboardData() {
    users = [...demoUsers];
    loadUsersTable();
    loadSupervisors();
    updateStats();
}

function updateStats() {
    const totalUsers = users.length;
    const onlineUsers = users.filter(u => u.isOnline).length;
    const totalMessages = demoMessages.length;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('onlineUsers').textContent = onlineUsers;
    document.getElementById('totalMessages').textContent = totalMessages;
}

function loadUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="badge ${user.role}">${user.role}</span></td>
            <td>${user.supervisor || 'None'}</td>
            <td><span class="badge ${user.isOnline ? 'online' : 'offline'}">${user.isOnline ? 'Online' : 'Offline'}</span></td>
            <td>
                <div class="actions">
                    <button class="btn-small btn-edit" onclick="editUser('${user.id}')">Edit</button>
                    ${getCurrentUser().role === 'admin' ? `<button class="btn-small btn-delete" onclick="deleteUser('${user.id}')">Delete</button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

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
    loadSupervisors();
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('show');
    document.getElementById('addUserForm').reset();
    document.getElementById('addUserError').textContent = '';
}

function addUser(userData) {
    // Check if email already exists
    if (users.some(u => u.email === userData.email)) {
        document.getElementById('addUserError').textContent = 'Email already exists';
        return;
    }
    
    const newUser = {
        id: generateUserId(),
        name: userData.name,
        email: userData.email,
        role: userData.role,
        supervisor: userData.supervisor || null,
        isOnline: false
    };
    
    users.push(newUser);
    loadUsersTable();
    updateStats();
    closeAddUserModal();
    showAlert('User added successfully!', 'success');
}

function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    // For now, just show an alert. In a real app, this would open an edit modal
    showAlert('Edit functionality would open a modal with user details for: ' + user.name, 'info');
}

function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (!confirm(`Are you sure you want to delete user "${user.name}"?`)) return;
    
    users = users.filter(u => u.id !== userId);
    loadUsersTable();
    updateStats();
    showAlert('User deleted successfully!', 'success');
}

function searchMessages() {
    const query = document.getElementById('messageSearchInput').value.trim();
    if (!query) {
        showAlert('Please enter a search term', 'warning');
        return;
    }
    
    const results = demoMessages.filter(msg => 
        msg.content.toLowerCase().includes(query.toLowerCase()) ||
        msg.sender.name.toLowerCase().includes(query.toLowerCase()) ||
        (msg.receiver && msg.receiver.name.toLowerCase().includes(query.toLowerCase()))
    );
    
    displaySearchResults(results, query);
}

function displaySearchResults(messages, query) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';
    
    if (messages.length === 0) {
        resultsDiv.innerHTML = `<p style="text-align: center; color: #666; padding: 20px;">No messages found for "${query}"</p>`;
        return;
    }
    
    const header = document.createElement('div');
    header.innerHTML = `<h4 style="margin-bottom: 15px;">Found ${messages.length} message(s) for "${query}"</h4>`;
    resultsDiv.appendChild(header);
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = 'border: 1px solid #e1e5e9; padding: 15px; margin: 10px 0; border-radius: 6px; background: white;';
        messageDiv.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>From:</strong> ${message.sender.name} (${message.sender.email})</div>
            <div style="margin-bottom: 8px;"><strong>To:</strong> ${message.receiver ? message.receiver.name + ' (' + message.receiver.email + ')' : 'Broadcast'}</div>
            <div style="margin-bottom: 8px;"><strong>Message:</strong> ${highlightSearchTerm(message.content, query)}</div>
            <div style="color: #666; font-size: 14px;"><strong>Time:</strong> ${formatDateTime(message.createdAt)}</div>
        `;
        resultsDiv.appendChild(messageDiv);
    });
}

function highlightSearchTerm(text, term) {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark style="background-color: yellow; padding: 2px;">$1</mark>');
}

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
function openChat() {
    window.location.href = 'chat.html';
}

function goToDashboard() {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role === 'admin') {
        window.location.href = 'dashboard.html';
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDateTime(date) {
    return new Date(date).toLocaleString();
}

function showAlert(message, type = 'info') {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        min-width: 250px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    };
    alert.style.backgroundColor = colors[type] || colors.info;
    
    alert.textContent = message;
    document.body.appendChild(alert);
    
    // Animate in
    setTimeout(() => {
        alert.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        alert.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(alert);
        }, 300);
    }, 3000);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    // Initialize dashboard
    const currentUser = getCurrentUser();
    if (currentUser) {
        // Update user info in header
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userRole').textContent = currentUser.role;
        document.getElementById('userRole').className = `badge ${currentUser.role}`;
        document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
        
        // Load dashboard data
        loadDashboardData();
        
        // Show/hide admin controls
        if (currentUser.role !== 'admin') {
            const adminOnlyElements = document.querySelectorAll('.admin-only');
            adminOnlyElements.forEach(el => el.style.display = 'none');
        }
    }
    
    // Add user form handler
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const userData = {
                name: document.getElementById('newUserName').value.trim(),
                email: document.getElementById('newUserEmail').value.trim(),
                password: document.getElementById('newUserPassword').value,
                role: document.getElementById('newUserRole').value,
                supervisor: document.getElementById('newUserSupervisor').value
            };
            
            // Basic validation
            if (!userData.name || !userData.email || !userData.password) {
                document.getElementById('addUserError').textContent = 'All required fields must be filled';
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                document.getElementById('addUserError').textContent = 'Please enter a valid email address';
                return;
            }
            
            // Password validation
            if (userData.password.length < 6) {
                document.getElementById('addUserError').textContent = 'Password must be at least 6 characters long';
                return;
            }
            
            addUser(userData);
        });
    }
    
    // Search messages handler
    const searchInput = document.getElementById('messageSearchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchMessages();
            }
        });
    }
    
    // Modal click outside to close
    const addUserModal = document.getElementById('addUserModal');
    if (addUserModal) {
        addUserModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAddUserModal();
            }
        });
    }
    
    // Logout handler
    const logoutBtns = document.querySelectorAll('[onclick="logout()"]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    });
});

// Export functions for use in other files
window.dashboardFunctions = {
    loadDashboardData,
    showAddUserModal,
    closeAddUserModal,
    addUser,
    editUser,
    deleteUser,
    searchMessages,
    showTab,
    openChat,
    goToDashboard
};