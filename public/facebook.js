// Use currentUser from shared.js
const token = currentUser && currentUser.token;

// Redirect to login if not authenticated
if (!token) {
  window.location.href = 'login.html';
}

const facebookSocket = io({ auth: { token } });
let currentConversationId = null;
let conversations = [];

// DOM elements
const conversationsList = document.getElementById('facebookConversationsList');
const chatArea = document.getElementById('facebookChatArea');

// Load and render conversations
async function loadConversations() {
  const res = await fetch('/api/facebook/conversations', {
    headers: { Authorization: `Bearer ${token}` }
  });
  conversations = await res.json();
  renderConversations();
}

function renderConversations() {
  conversationsList.innerHTML = '';
  if (conversations.length === 0) {
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">No conversations.</div>';
    return;
  }
  conversations.forEach(conv => {
    const lastMsg = conv.lastMessage ? conv.lastMessage.content : '';
    const el = document.createElement('div');
    el.className = 'p-4 border-b cursor-pointer hover:bg-slate-100';
    el.innerHTML = `
      <div class="font-semibold">${conv.participants.find(id => id !== window.facebookPageId)}</div>
      <div class="text-sm text-slate-500 truncate">${lastMsg}</div>
    `;
    el.onclick = () => selectConversation(conv._id);
    conversationsList.appendChild(el);
  });
}

// Load and render messages for a conversation
async function loadMessages(conversationId) {
  const res = await fetch(`/api/facebook/messages/${conversationId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const messages = await res.json();
  renderMessages(messages);
}

function renderMessages(messages) {
  chatArea.innerHTML = `
    <div class="flex-1 overflow-y-auto p-4" id="messagesContainer"></div>
    <div class="border-t p-4 flex gap-2">
      <input id="messageInput" class="flex-1 border rounded px-3 py-2" placeholder="Type a message...">
      <button id="sendButton" class="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
    </div>
  `;
  const messagesContainer = document.getElementById('messagesContainer');
  messages.forEach(msg => {
    const isMine = msg.sender === window.facebookPageId;
    const msgDiv = document.createElement('div');
    msgDiv.className = `mb-2 flex ${isMine ? 'justify-end' : 'justify-start'}`;
    msgDiv.innerHTML = `
      <div class="px-3 py-2 rounded-lg ${isMine ? 'bg-blue-500 text-white' : 'bg-slate-200'} max-w-xs">
        ${msg.content}
      </div>
    `;
    messagesContainer.appendChild(msgDiv);
  });

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Attach send handler
  document.getElementById('sendButton').onclick = sendMessageHandler;
  document.getElementById('messageInput').onkeydown = (e) => {
    if (e.key === 'Enter') sendMessageHandler();
  };
}

function selectConversation(conversationId) {
  currentConversationId = conversationId;
  facebookSocket.emit('joinFacebookConversationRoom', conversationId);
  loadMessages(conversationId);
}

// Real-time new message
facebookSocket.on('new_message', (message) => {
  if (message.conversation === currentConversationId) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
      const isMine = message.sender === window.facebookPageId;
      const msgDiv = document.createElement('div');
      msgDiv.className = `mb-2 flex ${isMine ? 'justify-end' : 'justify-start'}`;
      msgDiv.innerHTML = `
        <div class="px-3 py-2 rounded-lg ${isMine ? 'bg-blue-500 text-white' : 'bg-slate-200'} max-w-xs">
          ${message.content}
        </div>
      `;
      messagesContainer.appendChild(msgDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
});

// Send message handler
async function sendMessageHandler() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !currentConversationId) return;
  await fetch('/api/facebook/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ conversationId: currentConversationId, content })
  });
  input.value = '';
}

// On page load
window.addEventListener('DOMContentLoaded', async () => {
  // You need to set window.facebookPageId to your page's ID (from backend or config)
  // For demo, you can hardcode or fetch it from the backend
  window.facebookPageId = 'YOUR_PAGE_ID'; // <-- Set this!
  await loadConversations();
});
