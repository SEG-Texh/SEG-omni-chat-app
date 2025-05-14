// Redirect to dashboard if logged in
if (window.location.pathname === '/login.html' && localStorage.getItem('token')) {
    window.location.href = '/index.html';
  }
  
  // Redirect to login if not logged in
  if (window.location.pathname === '/index.html' && !localStorage.getItem('token')) {
    window.location.href = '/login.html';
  }
  
  const API = '/api';
  const socket = io();
  
  if (window.location.pathname === '/login.html') {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value;
      const password = form.password.value;
  
      try {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
  
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('token', data.token);
          window.location.href = '/index.html';
        } else {
          document.getElementById('error').innerText = data.message;
        }
      } catch (err) {
        document.getElementById('error').innerText = 'Login failed';
      }
    });
  }
  
  // Dashboard functionality
  if (window.location.pathname === '/index.html') {
    const token = localStorage.getItem('token');
    const messageList = document.getElementById('messages');
    const replySection = document.getElementById('replySection');
    const replyTo = document.getElementById('replyTo');
    const replyContent = document.getElementById('replyContent');
    let activeMessageId = null;
  
    const fetchMessages = async () => {
      const res = await fetch(`${API}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const messages = await res.json();
      messageList.innerHTML = '';
      messages.forEach(msg => {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${msg.channel}</strong>: ${msg.content} <br />
          From: ${msg.sender} | To: ${msg.recipient}
          <button onclick="claimMessage('${msg._id}')">Claim</button>
        `;
        messageList.appendChild(li);
      });
    };
  
    window.claimMessage = async (id) => {
      const res = await fetch(`${API}/messages/${id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
  
      if (res.ok) {
        activeMessageId = id;
        replyTo.innerText = id;
        replySection.style.display = 'block';
        fetchMessages();
      } else {
        alert('Could not claim message');
      }
    };
  
    window.sendReply = async () => {
      const content = replyContent.value;
      const res = await fetch(`${API}/messages/${activeMessageId}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
  
      if (res.ok) {
        alert('Reply sent!');
        replyContent.value = '';
      } else {
        alert('Failed to send reply');
      }
    };
  
    window.logout = () => {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    };
  
    fetchMessages();
  
    // Real-time listeners
    socket.on('new_message', (msg) => {
      console.log('🔔 New Message:', msg);
      fetchMessages();
    });
  
    socket.on('message_claimed', ({ messageId, claimedBy }) => {
      console.log(`📌 Message ${messageId} claimed`);
      fetchMessages();
    });
  
    socket.on('new_reply', ({ messageId, reply }) => {
      console.log(`💬 New reply to ${messageId}`, reply);
    });
  }
  