// public/app.js
const socket = io();
let token = localStorage.getItem('token');
let selectedMessageId = null;

window.onload = () => {
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  fetch('/api/messages', {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      const messagesDiv = document.getElementById('messages');
      messagesDiv.innerHTML = '';

      data.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message' + (msg.claimedBy ? ' claimed' : '');
        div.innerHTML = `<strong>${msg.source}</strong>: ${msg.content}<br/>
          From: ${msg.sender}<br/>
          Claimed by: ${msg.claimedBy || 'Unclaimed'}<br/>
          <button onclick="claimMessage('${msg._id}')">Claim</button>`;
        messagesDiv.appendChild(div);
      });
    });

  document.getElementById('reply-form').addEventListener('submit', e => {
    e.preventDefault();
    const replyText = document.getElementById('reply').value;
    if (!selectedMessageId) return alert('Select a message to reply');

    fetch(`/api/messages/${selectedMessageId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ reply: replyText })
    }).then(() => {
      socket.emit('newMessage', { messageId: selectedMessageId, reply: replyText });
      document.getElementById('reply').value = '';
    });
  });

  socket.on('messageUpdate', updated => {
    console.log('🔁 Message updated:', updated);
    location.reload(); // Refresh message list
  });
};

function claimMessage(id) {
  fetch(`/api/messages/${id}/claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  }).then(() => {
    selectedMessageId = id;
    alert('✅ Message claimed! You can now reply.');
  });
}
