// Global variables
let currentTab = 'overview';
let allUsers = [];
let allMessages = [];

// API Service
const API = {
  getStats: async () => {
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/admin/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  },
  
  getUsers: async (params = {}) => {
    const token = localStorage.getItem('authToken');
    const { page = 1, limit = 10, search = '', status = '' } = params;
    const url = `/api/admin/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}${status ? `&status=${status}` : ''}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  },
  
  getMessages: async (params = {}) => {
    const token = localStorage.getItem('authToken');
    const { page = 1, limit = 10, filter = 'all', search = '' } = params;
    const url = `/api/admin/messages?page=${page}&limit=${limit}&filter=${filter}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  },
  
  getRecentActivity: async () => {
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/admin/recent-activity', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  },
  
  createUser: async (userData) => {
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });
    return await res.json();
  },
  
  deleteUser: async (userId) => {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  },
  
  updateUserStatus: async (userId, status) => {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    return await res.json();
  },
  
  deleteMessage: async (messageId) => {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`/api/admin/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  },
  
  clearAllMessages: async () => {
    const token = localStorage.getItem('authToken');
    const res = await fetch('/api/admin/messages', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  }
};

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Check authentication and admin status
  const token = localStorage.getItem('authToken');
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName');
  
  if (!token || userRole !== 'admin') {
    window.location.href = '/login.html';
    return;
  }
  
  // Set admin name in header
  if (userName) {
    document.getElementById('adminName').textContent = `Welcome, ${userName}`;
  }
  
  loadDashboard();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  // Add user form submission
  const addUserForm = document.getElementById('addUserForm');
  if (addUserForm) {
    addUserForm.addEventListener('submit', handleAddUser);
  }

  // User search
  const userSearch = document.getElementById('userSearch');
  if (userSearch) {
    userSearch.addEventListener('input', filterUsers);
  }

  // Message search
  const messageSearch = document.getElementById('messageSearch');
  if (messageSearch) {
    messageSearch.addEventListener('input', filterMessages);
  }

  // Message filter change
  const messageFilter = document.getElementById('messageFilter');
  if (messageFilter) {
    messageFilter.addEventListener('change', loadMessages);
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

// Load dashboard data
async function loadDashboard() {
  try {
    await Promise.all([
      loadStats(),
      loadRecentActivity(),
      loadUsers(),
      loadMessages()
    ]);
    showAlert('Dashboard loaded successfully', 'success');
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showAlert('Failed to load dashboard data', 'error');
  }
}

// Load statistics
async function loadStats() {
  try {
    const { data } = await API.getStats();
    document.getElementById('totalUsers').textContent = data.totalUsers || 0;
    document.getElementById('activeUsers').textContent = data.activeUsers || 0;
    document.getElementById('totalMessages').textContent = data.totalMessages || 0;
    document.getElementById('todayMessages').textContent = data.todayMessages || 0;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load recent activity
async function loadRecentActivity() {
  try {
    const { data } = await API.getRecentActivity();
    displayRecentActivity(data);
  } catch (error) {
    console.error('Error loading recent activity:', error);
    document.getElementById('recentActivity').innerHTML = '<p>Failed to load recent activity</p>';
  }
}

// Display recent activity
function displayRecentActivity(activities) {
  const container = document.getElementById('recentActivity');
  
  if (!activities || activities.length === 0) {
    container.innerHTML = '<p>No recent activity</p>';
    return;
  }

  const activityHTML = activities.map(activity => `
    <div class="activity-item" style="padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 10px; background: #f9fafb; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fas ${activity.icon || 'fa-info-circle'} ${activity.color || 'text-blue-500'}"></i>
        <div>
          <p style="margin: 0; font-weight: 500;">${activity.description}</p>
          <small style="color: #6b7280;">${formatDate(activity.timestamp)}</small>
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = activityHTML;
}

// Load users
async function loadUsers() {
  try {
    const { data } = await API.getUsers();
    allUsers = data.users;
    displayUsers(allUsers);
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="6">Failed to load users</td></tr>';
  }
}

// Display users in table
function displayUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
    return;
  }

  const usersHTML = users.map(user => `
    <tr>
      <td>${user.username || 'N/A'}</td>
      <td>${user.email}</td>
      <td>
        <span class="role-badge role-${user.role}">${user.role}</span>
      </td>
      <td>
        <span class="status-badge status-${user.status || 'active'}">${user.status || 'active'}</span>
      </td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        <button class="btn-small" onclick="editUser('${user._id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-small btn-danger" onclick="deleteUser('${user._id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
        <select onchange="updateUserStatus('${user._id}', this.value)" style="margin-left: 5px; padding: 4px;">
          <option value="">Change Status</option>
          <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>Suspended</option>
          <option value="banned" ${user.status === 'banned' ? 'selected' : ''}>Banned</option>
        </select>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = usersHTML;
}

// Filter users based on search
function filterUsers() {
  const searchTerm = document.getElementById('userSearch').value.toLowerCase();
  const filteredUsers = allUsers.filter(user => 
    (user.username && user.username.toLowerCase().includes(searchTerm)) ||
    user.email.toLowerCase().includes(searchTerm)
  );
  displayUsers(filteredUsers);
}

// Handle add user form submission
async function handleAddUser(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const userData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role')
  };

  try {
    const { success, message, data } = await API.createUser(userData);

    if (success) {
      showAlert(message || 'User created successfully!', 'success');
      event.target.reset();
      await loadUsers();
      await loadStats();
    } else {
      showAlert(message || 'Failed to create user', 'error');
    }
  } catch (error) {
    console.error('Error creating user:', error);
    showAlert('Failed to create user', 'error');
  }
}

// Edit user (placeholder)
function editUser(userId) {
  console.log('Edit user:', userId);
  showAlert('Edit functionality coming soon', 'info');
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
    return;
  }

  try {
    const { success, message } = await API.deleteUser(userId);

    if (success) {
      showAlert(message || 'User deleted successfully!', 'success');
      await loadUsers();
      await loadStats();
    } else {
      showAlert(message || 'Failed to delete user', 'error');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    showAlert('Failed to delete user', 'error');
  }
}

// Update user status
async function updateUserStatus(userId, newStatus) {
  if (!newStatus) return;

  try {
    const { success, message } = await API.updateUserStatus(userId, newStatus);

    if (success) {
      showAlert(message || `User status updated to ${newStatus}!`, 'success');
      await loadUsers();
      await loadStats();
    } else {
      showAlert(message || 'Failed to update user status', 'error');
    }
  } catch (error) {
    console.error('Error updating user status:', error);
    showAlert('Failed to update user status', 'error');
  }
}

// Load messages
async function loadMessages() {
  try {
    const filter = document.getElementById('messageFilter').value;
    const search = document.getElementById('messageSearch').value;
    
    const { data } = await API.getMessages({
      filter,
      search
    });

    allMessages = data.messages;
    displayMessages(allMessages);
  } catch (error) {
    console.error('Error loading messages:', error);
    document.getElementById('messagesContainer').innerHTML = '<p>Failed to load messages</p>';
  }
}

// Display messages
function displayMessages(messages) {
  const container = document.getElementById('messagesContainer');
  
  if (!messages || messages.length === 0) {
    container.innerHTML = '<p>No messages found</p>';
    return;
  }

  const messagesHTML = messages.map(message => `
    <div class="message-item" style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
            <span class="message-type-badge ${message.type || 'text'}">${(message.type || 'text').toUpperCase()}</span>
            <span class="platform-badge">${message.platform || 'web'}</span>
            <span style="color: #6b7280; font-size: 0.875rem;">${formatDate(message.createdAt)}</span>
          </div>
          <div style="font-weight: 500; color: #374151;">
            From: ${message.sender || 'Unknown'}
            ${message.recipient ? `→ To: ${message.recipient}` : ''}
          </div>
          ${message.subject ? `<div style="font-weight: 500; color: #374151; margin-top: 5px;">Subject: ${message.subject}</div>` : ''}
        </div>
        <button class="btn-small btn-danger" onclick="deleteMessage('${message._id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div style="color: #4b5563; line-height: 1.5; max-height: 100px; overflow-y: auto;">
        ${truncateText(message.content, 300)}
      </div>
    </div>
  `).join('');

  container.innerHTML = messagesHTML;
}

// Filter messages based on search
function filterMessages() {
  loadMessages(); // Reload with current search term
}

// Delete message
async function deleteMessage(messageId) {
  if (!confirm('Are you sure you want to delete this message?')) {
    return;
  }

  try {
    const { success, message } = await API.deleteMessage(messageId);

    if (success) {
      showAlert(message || 'Message deleted successfully!', 'success');
      await loadMessages();
      await loadStats();
    } else {
      showAlert(message || 'Failed to delete message', 'error');
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    showAlert('Failed to delete message', 'error');
  }
}

// Clear all messages
async function clearMessages() {
  if (!confirm('Are you sure you want to clear ALL messages? This action cannot be undone and will delete all messages and emails from the database.')) {
    return;
  }

  try {
    const { success, message, data } = await API.clearAllMessages();

    if (success) {
      showAlert(message || `All messages cleared! (${data?.totalDeleted || 0} messages deleted)`, 'success');
      await loadMessages();
      await loadStats();
    } else {
      showAlert(message || 'Failed to clear messages', 'error');
    }
  } catch (error) {
    console.error('Error clearing messages:', error);
    showAlert('Failed to clear messages', 'error');
  }
}

// Switch tabs
function switchTab(tabName) {
  // Remove active class from all tabs and contents
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Add active class to clicked tab and corresponding content
  event.target.classList.add('active');
  document.getElementById(tabName).classList.add('active');
  
  currentTab = tabName;
  
  // Load data for the current tab if needed
  if (tabName === 'users') {
    loadUsers();
  } else if (tabName === 'messages') {
    loadMessages();
  } else if (tabName === 'overview') {
    loadStats();
    loadRecentActivity();
  }
}

// Utility function to show alerts
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alertContainer');
  const alertId = 'alert-' + Date.now();
  
  const alertHTML = `
    <div id="${alertId}" class="alert alert-${type}" style="margin: 10px 0; padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="fas ${getAlertIcon(type)}"></i>
        <span>${message}</span>
      </div>
      <button onclick="closeAlert('${alertId}')" style="background: none; border: none; font-size: 1.2em; cursor: pointer;">×</button>
    </div>
  `;
  
  alertContainer.insertAdjacentHTML('beforeend', alertHTML);
  
  // Auto-remove alert after 5 seconds
  setTimeout(() => {
    closeAlert(alertId);
  }, 5000);
}

// Get alert icon based on type
function getAlertIcon(type) {
  switch(type) {
    case 'success': return 'fa-check-circle';
    case 'error': return 'fa-exclamation-circle';
    case 'warning': return 'fa-exclamation-triangle';
    default: return 'fa-info-circle';
  }
}

// Close alert
function closeAlert(alertId) {
  const alert = document.getElementById(alertId);
  if (alert) {
    alert.remove();
  }
}

// Utility function to format dates
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Utility function to truncate text
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Logout function
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    // Clear all stored user data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    
    // Redirect to login page
    window.location.href = '/';
  }
}