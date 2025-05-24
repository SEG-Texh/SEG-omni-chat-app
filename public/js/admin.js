// Admin functionality
let users = [];

// Load users on admin panel access
async function loadUsers() {
    try {
        // Mock data for demonstration - replace with actual API call
        users = [
            {
                id: '1',
                name: 'John Doe',
                email: 'john@company.com',
                role: 'admin',
                status: 'online',
                lastActive: new Date()
            },
            {
                id: '2',
                name: 'Jane Smith',
                email: 'jane@company.com',
                role: 'agent',
                status: 'offline',
                lastActive: new Date(Date.now() - 1800000)
            },
            {
                id: '3',
                name: 'Mike Johnson',
                email: 'mike@company.com',
                role: 'agent',
                status: 'online',
                lastActive: new Date()
            }
        ];
        
        renderUsers();
    } catch (error) {
        console.error('Load users error:', error);
    }
}

function renderUsers() {
    const container = document.getElementById('usersList');
    
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No users found</p></div>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-details">
                    <strong>${user.name}</strong>
                    <div style="color: #6b7280; font-size: 0.9rem;">${user.email}</div>
                </div>
                <div class="user-meta">
                    <span class="user-role ${user.role}">${user.role.toUpperCase()}</span>
                    <span class="user-status ${user.status}">${user.status.toUpperCase()}</span>
                </div>
            </div>
            <div class="user-actions">
                <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem;">
                    Last active: ${formatTime(user.lastActive)}
                </div>
                <button class="btn-secondary" onclick="editUser('${user.id}')">Edit</button>
                <button class="btn-danger" onclick="deleteUser('${user.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Add new user
async function addUser(formData) {
    try {
        const newUser = {
            id: Date.now().toString(),
            name: formData.name,
            email: formData.email,
            role: formData.role,
            status: 'offline',
            lastActive: new Date()
        };

        // Mock API call - replace with actual implementation
        users.push(newUser);
        
        // Emit socket event if connected
        if (socket) {
            socket.emit('user-added', newUser);
        }

        renderUsers();
        showNotification('User added successfully!', 'success');
        
        return true;
    } catch (error) {
        console.error('Add user error:', error);
        showNotification('Failed to add user', 'error');
        return false;
    }
}

// Edit user
function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // Simple prompt-based editing (you can replace with a modal)
    const newName = prompt('Enter new name:', user.name);
    if (newName && newName.trim()) {
        user.name = newName.trim();
        
        // Emit socket event
        if (socket) {
            socket.emit('user-updated', user);
        }
        
        renderUsers();
        showNotification('User updated successfully!', 'success');
    }
}

// Delete user
function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (confirm(`Are you sure you want to delete ${user.name}?`)) {
        users = users.filter(u => u.id !== userId);
        
        // Emit socket event
        if (socket) {
            socket.emit('user-deleted', userId);
        }
        
        renderUsers();
        showNotification('User deleted successfully!', 'success');
    }
}

// Handle add user form submission
document.addEventListener('DOMContentLoaded', function() {
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const userData = {
                name: formData.get('name'),
                email: formData.get('email'),
                role: formData.get('role')
            };

            if (await addUser(userData)) {
                this.reset();
            }
        });
    }
});

// Check if current user has admin access
function checkAdminAccess() {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('Access denied. Admin privileges required.', 'error');
        showTab('chat');
        return false;
    }
    return true;
}

// Initialize admin panel
function initializeAdminPanel() {
    if (checkAdminAccess()) {
        loadUsers();
    }
}