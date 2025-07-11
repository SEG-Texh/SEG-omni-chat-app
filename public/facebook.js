// Facebook admin chat logic
let currentFacebookConversationId = null;
let currentFacebookConversation = null;

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function showFacebookPlaceholder() {
  document.getElementById('facebookChatPlaceholder').style.display = 'flex';
  document.getElementById('facebookChatStructured').classList.add('hidden');
}

function showFacebookChat(conversation) {
  currentFacebookConversationId = conversation._id;
  currentFacebookConversation = conversation;
  document.getElementById('facebookChatPlaceholder').style.display = 'none';
  document.getElementById('facebookChatStructured').classList.remove('hidden');
  // Header
  document.getElementById('facebookChatTitle').textContent = conversation.participants?.[0] || 'Contact';
  document.getElementById('facebookChatSubtitle').textContent = (conversation.status === 'active' && conversation.expiresAt && new Date(conversation.expiresAt) > new Date()) ? 'Active' : 'Inactive';
  // Show/hide input for admin
  const form = document.getElementById('facebookMessageForm');
  if (isAdmin()) {
    form.classList.remove('hidden');
  } else {
    form.classList.add('hidden');
  }
  // Load messages
  loadFacebookMessages(conversation._id);
}

async function loadFacebookConversations() {
  const list = document.getElementById('facebookConversationsList');
  list.innerHTML = '<div class="p-4 text-center text-slate-500">Loading conversations...</div>';
  try {
    const res = await apiRequest('/api/conversation?platform=facebook');
    if (!res.ok) throw new Error('Failed to load conversations');
    const conversations = await res.json();
    if (!Array.isArray(conversations) || conversations.length === 0) {
      list.innerHTML = '<div class="p-4 text-center text-slate-500">No conversations found</div>';
      showFacebookPlaceholder();
      return;
    }
    list.innerHTML = '';
    conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      item.textContent = conv.participants?.[0] || conv.customerId || 'Contact';
      item.onclick = () => showFacebookChat(conv);
      list.appendChild(item);
    });
    // Auto-select first
    showFacebookChat(conversations[0]);
  } catch (e) {
    list.innerHTML = '<div class="p-4 text-center text-red-500">Error loading conversations</div>';
    showFacebookPlaceholder();
  }
}

async function loadFacebookMessages(conversationId) {
  const list = document.getElementById('facebookMessagesList');
  list.innerHTML = '<div class="p-4 text-center text-slate-500">Loading messages...</div>';
  try {
    const res = await apiRequest(`/api/conversation/${conversationId}/messages?platform=facebook`);
    if (!res.ok) throw new Error('Failed to load messages');
    const messages = await res.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      list.innerHTML = '<div class="p-4 text-center text-slate-500">No messages yet</div>';
      return;
    }
    list.innerHTML = '';
    messages.forEach(msg => {
      const isMine = msg.direction === 'outbound' && (msg.sender?._id === currentUser._id || msg.sender?._id === currentUser.id);
      const isBot = msg.sender?._id === SEG_BOT_ID || msg.sender === SEG_BOT_ID;
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble facebook ' + (isMine ? 'sent' : 'received');
      bubble.innerHTML = `
        ${isBot ? '<span title="SEGbot" style="margin-right:6px;">🤖 <b>SEGbot</b>:</span>' : ''}
        <div class="bubble-content">${msg.content?.text || msg.text || ''}</div>
        <div class="bubble-meta">${msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}</div>
      `;
      list.appendChild(bubble);
    });
    list.scrollTop = list.scrollHeight;
  } catch (e) {
    list.innerHTML = '<div class="p-4 text-center text-red-500">Error loading messages</div>';
  }
}

async function sendFacebookMessage(e) {
  e.preventDefault();
  const input = document.getElementById('facebookMessageInput');
  const text = input.value.trim();
  if (!text || !currentFacebookConversationId) return;
  try {
    const res = await apiRequest(`/api/conversation/${currentFacebookConversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: { text }, platform: 'facebook' })
    });
    if (!res.ok) {
      const err = await res.json();
      showMessage('facebookMessageStatus', 'error', err.error || 'Failed to send message');
      return;
    }
    input.value = '';
    loadFacebookMessages(currentFacebookConversationId);
  } catch (e) {
    showMessage('facebookMessageStatus', 'error', e.message || 'Failed to send message');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Wait for authentication check to complete
  const checkAuthAndInit = () => {
    if (currentUser) {
      // Authentication check completed
      initializeSocket();
      
      if (!isAdmin()) {
        document.getElementById('facebookConversationsList').innerHTML = '<div class="p-4 text-center text-red-500">Only admins can view Facebook conversations.</div>';
        showFacebookPlaceholder();
        return;
      }
      loadFacebookConversations();
      // Message form submit
      const form = document.getElementById('facebookMessageForm');
      if (form) {
        form.addEventListener('submit', sendFacebookMessage);
      }
    } else {
      // Authentication check not complete yet, wait a bit and try again
      setTimeout(checkAuthAndInit, 100);
    }
  };
  
  checkAuthAndInit();
});

// Initialize socket connection after authentication check
function initializeSocket() {
  if (typeof socket === 'undefined' && currentUser && currentUser.token) {
    // If not using a global socket, create one
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socketUrl = `${protocol}://${window.location.host}`;
    window.socket = io(socketUrl, {
      auth: { token: currentUser.token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
  }
}

(socket || window.socket).on('new_conversation', ({ conversation }) => {
  if (conversation.platform === 'facebook') {
    loadFacebookConversations();
  }
});
