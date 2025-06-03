// ============================================================================
// MAIN APP INITIALIZATION (for login page)
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Only run on login page
    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            const loginText = document.getElementById('loginText');
            const loginSpinner = document.getElementById('loginSpinner');
            const loginError = document.getElementById('loginError');
            
            // Show loading state
            loginBtn.disabled = true;
            loginText.style.display = 'none';
            loginSpinner.style.display = 'block';
            loginError.textContent = '';
            
            try {
                const user = await login(email, password);
                // Redirect based on role
                if (user.role === 'admin') {
                    showDashboard();
                } else {
                    showChat();
                }
            } catch (error) {
                loginError.textContent = error.message;
            } finally {
                // Reset loading state
                loginBtn.disabled = false;
                loginText.style.display = 'block';
                loginSpinner.style.display = 'none';
            }
        });
    }
});

// Make functions available globally
window.openChat = openChat;
window.logout = logout;
window.goToDashboard = goToDashboard;
window.showTab = showTab;
window.showAddUserModal = showAddUserModal;
window.closeAddUserModal = closeAddUserModal;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.searchMessages = searchMessages;
window.sendMessage = sendMessage;