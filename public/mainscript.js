// mainscript.js
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('message');
    const loginButton = document.getElementById('loginButton');

    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');
    
    if (token && userRole) {
        // Redirect based on role
        redirectByRole(userRole);
        return;
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Disable login button and show loading state
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store authentication data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('userRole', data.user.role);
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('userEmail', data.user.email || email);
                
                showMessage('Login successful! Redirecting...', 'success');
                
                // Redirect based on user role
                setTimeout(() => {
                    redirectByRole(data.user.role);
                }, 1000);
                
            } else {
                showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Network error. Please try again.', 'error');
        } finally {
            // Re-enable login button
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });
    
    // Function to handle role-based redirects
    function redirectByRole(role) {
        switch(role.toLowerCase()) {
            case 'admin':
                window.location.href = '/admin.html';
                break;
            case 'moderator':
                window.location.href = '/moderator.html';
                break;
            case 'agent':
            case 'support':
            case 'user':
            default:
                window.location.href = '/dashboard.html'; // Regular user dashboard
                break;
        }
    }
    
    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        // Hide message after 5 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});