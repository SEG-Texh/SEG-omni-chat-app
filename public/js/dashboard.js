// ============================================================================
// DASHBOARD FUNCTIONS
// ============================================================================
let users = [...demoUsers];

function loadDashboardData() {
    // Update user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role;
    document.getElementById('userRole').className = `badge ${currentUser.role}`;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    
    loadUsersTable();
    loadSupervisors();
}

// ... (rest of the dashboard functions remain the same as before) ...