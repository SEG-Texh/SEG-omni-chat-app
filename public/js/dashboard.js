// ============================================================================
// DASHBOARD FUNCTIONS
// ============================================================================
let users = [...demoUsers];

function loadDashboardData() {
    loadUsersTable();
    loadSupervisors();
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
                    ${currentUser.role === 'admin' ? `<button class="btn-small btn-delete" onclick="deleteUser('${user.id}')">Delete</button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// ... (all other dashboard functions from the original code) ...

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