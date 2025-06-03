// ============================================================================
// LOGIN.JS - Authentication and Login Functionality
// ============================================================================

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let currentUser = null;

// Demo data for frontend testing
const demoUsers = [
    { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin', isOnline: true },
    { id: '2', name: 'Jane Smith', email: 'user@example.com', role: 'user', isOnline: false, supervisor: 'Admin User' },
    { id: '3', name: 'Bob Johnson', email: 'supervisor@example.com', role: 'supervisor', isOnline: true }
];

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================
async function login(email, password) {
    // Demo login logic
    const demoCredentials = {
        'admin@example.com': { password: 'admin123', user: demoUsers[0] },
        'user@example.com': { password: 'user123', user: demoUsers[1] },
        'supervisor@example.com': { password: 'super123', user: demoUsers[2] }
    };

    if (demoCredentials[email] && demoCredentials[email].password === password) {
        const user = demoCredentials[email].user;
        currentUser = user;
        
        // Store in memory (not localStorage as per restrictions)
        window.currentUserToken = 'demo-token-' + user.id;
        
        // Add a small delay to simulate real authentication
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Redirect based on role
        if (user.role === 'admin') {
            redirectToDashboard();
        } else {
            redirectToChat();
        }
        
        return user;
    } else {
        throw new Error('Invalid credentials');
    }
}

function logout() {
    currentUser = null;
    window.currentUserToken = null;
    
    // Redirect to login page
    window.location.href = 'index.html';
}

function checkAuth() {
    // For demo purposes, check if we have a token in memory
    return window.currentUserToken ? true : false;
}

function getCurrentUser() {
    return currentUser;
}

// ============================================================================
// UI NAVIGATION FUNCTIONS
// ============================================================================
function showLogin() {
    const loginContainer = document.getElementById('loginContainer');
    if (loginContainer) {
        loginContainer.style.display = 'flex';
    }
    
    // Hide other containers if they exist
    hideOtherContainers();
}

function hideOtherContainers() {
    const containers = ['dashboardContainer', 'chatContainer'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.display = 'none';
        }
    });
}

function redirectToDashboard() {
    console.log('Redirecting admin to dashboard...');
    // Always redirect to dashboard.html for admins
    window.location.href = 'dashboard.html';
}

function redirectToChat() {
    console.log('Redirecting user to chat...');
    // Always redirect to chat.html for users and supervisors
    window.location.href = 'chat.html';
}

function showDashboard() {
    const dashboardContainer = document.getElementById('dashboardContainer');
    if (dashboardContainer) {
        const loginContainer = document.getElementById('loginContainer');
        if (loginContainer) loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'block';
        
        // Update user info if elements exist
        updateUserInfo();
    }
}

function showChat() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        const loginContainer = document.getElementById('loginContainer');
        if (loginContainer) loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) userName.textContent = currentUser.name;
    if (userRole) {
        userRole.textContent = currentUser.role;
        userRole.className = `badge ${currentUser.role}`;
    }
    if (userAvatar) {
        userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    }
}

// ============================================================================
// FORM HANDLING
// ============================================================================
function initializeLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');
        const loginText = document.getElementById('loginText');
        const loginSpinner = document.getElementById('loginSpinner');
        const loginError = document.getElementById('loginError');
        
        // Validate form
        const errors = validateLoginForm(email, password);
        if (errors.length > 0) {
            if (loginError) {
                loginError.textContent = errors[0];
            }
            return;
        }
        
        // Show loading state
        setLoadingState(true, loginBtn, loginText, loginSpinner);
        if (loginError) loginError.textContent = '';
        
        try {
            await login(email, password);
        } catch (error) {
            if (loginError) {
                loginError.textContent = error.message;
            } else {
                console.error('Login error:', error.message);
                alert('Login failed: ' + error.message);
            }
        } finally {
            // Reset loading state
            setLoadingState(false, loginBtn, loginText, loginSpinner);
        }
    });
}

function setLoadingState(isLoading, button, textElement, spinnerElement) {
    if (!button) return;
    
    button.disabled = isLoading;
    
    if (textElement) {
        textElement.style.display = isLoading ? 'none' : 'block';
    }
    
    if (spinnerElement) {
        spinnerElement.style.display = isLoading ? 'block' : 'none';
    }
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    // Basic password validation - at least 6 characters
    return password && password.length >= 6;
}

function validateLoginForm(email, password) {
    const errors = [];
    
    if (!email) {
        errors.push('Email is required');
    } else if (!validateEmail(email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (!password) {
        errors.push('Password is required');
    } else if (!validatePassword(password)) {
        errors.push('Password must be at least 6 characters long');
    }
    
    return errors;
}

// ============================================================================
// INITIALIZATION
// ============================================================================
function initializeLogin() {
    // Check for existing auth
    if (checkAuth() && currentUser) {
        console.log('User already authenticated:', currentUser);
        // Auto-redirect based on role
        if (currentUser.role === 'admin') {
            redirectToDashboard();
        } else {
            redirectToChat();
        }
    } else {
        showLogin();
    }
    
    // Initialize form handlers
    initializeLoginForm();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    initializeLogin();
});

// ============================================================================
// EXPORT FOR MODULE USAGE
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        login,
        logout,
        checkAuth,
        getCurrentUser,
        validateEmail,
        validatePassword,
        validateLoginForm,
        showLogin,
        redirectToDashboard,
        redirectToChat
    };
}