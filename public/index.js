<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Omni Chat Dashboard</title>
  <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
  <style>
    body { font-family: Arial; padding: 20px; }
    .message { margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
    .claimed { color: orange; }
    .reply { margin-left: 20px; color: green; }
  </style>
</head>
<body>
  <h1>📡 Omni Chat Real-Time Dashboard</h1>
  <div id="messages"></div>

  <script>
    const socket = io('http://localhost:5000'); // Change port if different

    const messagesDiv = document.getElementById('messages');

    function renderMessage(message, type = 'new') {
      const div = document.createElement('div');
      div.className = 'message';
      div.innerHTML = `
        <strong>📨 ${message.channel.toUpperCase()}</strong><br/>
        From: ${message.sender} → To: ${message.recipient}<br/>
        Content: ${message.content}<br/>
        ${type === 'claimed' ? `<span class="claimed">⚠️ Claimed by User ID: ${message.claimedBy}</span><br/>` : ''}
        <div class="replies" id="replies-${message._id}"></div>
      `;
      messagesDiv.prepend(div);
    }

    function appendReply(messageId, reply) {
      const replyDiv = document.getElementById(`replies-${messageId}`);
      if (replyDiv) {
        replyDiv.innerHTML += `<div class="reply">↪️ ${reply.content} (User: ${reply.sender})</div>`;
      }
    }

    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO');
    });

    socket.on('new_message', (msg) => {
      console.log('📥 New Message:', msg);
      renderMessage(msg, 'new');
    });

    socket.on('message_claimed', (data) => {
      console.log('🧾 Message Claimed:', data);
      const claimedInfo = document.createElement('div');
      claimedInfo.className = 'claimed';
      claimedInfo.innerText = `⚠️ Message ${data.messageId} claimed by User ID: ${data.claimedBy}`;
      messagesDiv.prepend(claimedInfo);
    });

    socket.on('new_reply', ({ messageId, reply }) => {
      console.log('🗨️ New Reply:', reply);
      appendReply(messageId, reply);
    });
  </script>
</body>
</html>
