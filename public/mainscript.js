// mainscript.js - Replace your existing login code with this

document.addEventListener('DOMContentLoaded', function() {
    // Find your login form - adjust the selector to match your HTML
    const loginForm = document.getElementById('loginForm') || document.querySelector('form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(event) {
    event.preventDefault(); // Prevent default form submission
    
    // Get form data
    const formData = new FormData(event.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    console.log('Attempting login for:', email);
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('Login successful:', data);
            
            // Store the token in localStorage
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Show success message
            showMessage('Login successful!', 'success');
            
            // Redirect to dashboard or main app
            // window.location.href = '/dashboard.html';
            
        } else {
            console.error('Login failed:', data.message);
            showMessage(data.message || 'Login failed', 'error');
        }
        
    } catch (error) {
        console.error('Network error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

// Helper function to show messages
function showMessage(message, type) {
    // Create or find message element
    let messageDiv = document.getElementById('message');
    if (!messageDiv) {
        messageDiv = document.createElement('div');
        messageDiv.id = 'message';
        document.body.insertBefore(messageDiv, document.body.firstChild);
    }
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Alternative: If you're not using a form, but have separate input fields and button
function setupManualLogin() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    
    if (loginButton) {
        loginButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value;
            const password = passwordInput.value;
            
            if (!email || !password) {
                showMessage('Please enter both email and password', 'error');
                return;
            }
            
            // Call the same login function
            await performLogin(email, password);
        });
    }
}

async function performLogin(email, password) {
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
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showMessage('Login successful!', 'success');
            // Handle successful login (redirect, etc.)
        } else {
            showMessage(data.message || 'Login failed', 'error');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}