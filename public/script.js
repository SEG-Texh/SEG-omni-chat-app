let socket, currentUser, currentPlatform = 'facebook', currentChatUser = null;
const listEl = document.getElementById('chatList');
const messagesEl = document.getElementById('chatMessages');
const inputEl = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

window.onload = async () => {
  currentUser = JSON.parse(localStorage.getItem('user'));
  initSocket();
  await loadConversations('facebook');
  await loadConversations('whatsapp');
};

function initSocket() {
  socket = io('/', { auth: { token: localStorage.getItem('token') } });
  socket.on('connect', () => console.log('Connected'));
  socket.on('new_message', message => {
    if (message.platform === currentPlatform) {
      if (!currentChatUser || currentChatUser !== message.platformThreadId) {
        addConversationListItem(message);
      } else {
        displayMessage(message);
      }
    }
  });
}

async function loadConversations(platform) {
  const res = await fetch(`/api/messages/conversations/${platform}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  const convos = await res.json();
  convos.forEach(addConversationListItem);
}

function addConversationListItem(msg) {
  const key = `${msg.platform}-${msg.platformThreadId}`;
  if (document.getElementById(key)) return;
  const div = document.createElement('div');
  div.id = key;
  div.className = 'chat-user';
  div.innerHTML = `<strong>${msg.platform} @ ${msg.platformSender?.name || msg.sender}</strong>
                   <p>${msg.content.text.slice(0,50)}</p>`;
  div.onclick = () => selectChat(msg.platform, msg.platformThreadId);
  listEl.appendChild(div);
}

async function selectChat(platform, threadId) {
  currentPlatform = platform;
  currentChatUser = threadId;
  document.getElementById('chatUserName').innerText = `${platform} Chat with ${threadId}`;
  
  inputEl.disabled = false;
  sendBtn.disabled = false;
  messagesEl.innerHTML = '';

  const res = await fetch(`/api/messages/thread/${platform}/${threadId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  const msgs = await res.json();
  msgs.forEach(displayMessage);
}

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || !currentChatUser) return;

  fetch('/api/messages', {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      platform: currentPlatform,
      receiverId: currentChatUser,
      content:{ text }
    })
  }).then(res=>res.ok && displayMessage({
    platform: currentPlatform,
    platformThreadId: currentChatUser,
    direction: 'outbound',
    content:{text},
    createdAt: new Date().toISOString()
  }));

  inputEl.value = '';
}

function displayMessage(msg) {
  const div = document.createElement('div');
  div.className = msg.direction === 'outbound' ? 'sent' : 'received';
  div.innerHTML = `<div>${msg.content.text}</div><div class="timestamp">${new Date(msg.createdAt).toLocaleTimeString()}</div>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showPlatform(platform) {
  currentPlatform = platform;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase()===platform));
  listEl.innerHTML = '';
  currentChatUser = null;
  loadConversations(platform);
}
