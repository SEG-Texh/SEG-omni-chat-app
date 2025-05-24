// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data.user;
            // Note: localStorage not used as per Claude.ai restrictions
            showNotification('Login successful!', 'success');
            showMainApp();
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}

function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Update UI based on user role
    document.getElementById('currentUser').textContent = currentUser.name;
    
    if (currentUser.role !== 'admin') {
        document.getElementById('adminTab').style.display = 'none';
    }

    // Initialize socket connection
    initializeSocket();
    
    // Load initial data
    loadConversations();
    loadUsers();
}

function logout() {
    // Note: localStorage not used as per Claude.ai restrictions
    if (socket) {
        socket.disconnect();
    }
    location.reload();
}

async function handleAddUser(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userData = {
        name: formData.get('name'),
        email: formData.get('email'),
        role: formData.get('role'),
        password: 'temp123' // Temporary password - should be changed by user
    };

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('User added successfully!', 'success');
            document.getElementById('addUserForm').reset();
            loadUsers();
        } else {
            showNotification(data.message || 'Failed to add user', 'error');
        }
    } catch (error) {
        console.error('Add user error:', error);
        showNotification('Connection error. Please try again.', 'error');
    }
}