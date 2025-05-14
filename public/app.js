document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
  
    // SIGNUP HANDLER
    signupForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const name = document.getElementById('signupName').value;
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      const role = document.getElementById('signupRole').value;
  
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
  
      const data = await res.json();
      if (res.ok) {
        alert('Signup successful. You can now login.');
        signupForm.reset();
      } else {
        alert(data.message || 'Signup failed');
      }
    });
  
    // LOGIN HANDLER
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
  
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
  
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        alert('Login successful');
        window.location.href = 'index.html';
      } else {
        alert(data.message || 'Login failed');
      }
    });
  });
  