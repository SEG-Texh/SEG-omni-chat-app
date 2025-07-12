// Facebook admin chat logic
let currentFacebookConversationId = null;
let currentFacebookConversation = null;

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function isAgentOrSupervisor() {
  return currentUser && (currentUser.role === 'agent' || currentUser.role === 'supervisor' || currentUser.role === 'admin');
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
  // Show/hide input for agents, supervisors, and admins
  const form = document.getElementById('facebookMessageForm');
  if (isAgentOrSupervisor()) {
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
    console.log('Loading Facebook conversations...');
    const res = await apiRequest('/api/conversation?platform=facebook');
    console.log('Conversations API response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Conversations API error response:', errorText);
      throw new Error(`Failed to load conversations: ${res.status} ${errorText}`);
    }
    
    const conversations = await res.json();
    console.log('Loaded conversations:', conversations);
    
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
    console.error('Error loading conversations:', e);
    list.innerHTML = `<div class="p-4 text-center text-red-500">Error loading conversations: ${e.message}</div>`;
    showFacebookPlaceholder();
  }
}

async function loadFacebookMessages(conversationId) {
  const list = document.getElementById('facebookMessagesList');
  list.innerHTML = '<div class="p-4 text-center text-slate-500">Loading messages...</div>';
  try {
    console.log('Loading messages for conversation:', conversationId);
    const res = await apiRequest(`/api/conversation/${conversationId}/messages?platform=facebook`);
    console.log('API response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('API error response:', errorText);
      throw new Error(`Failed to load messages: ${res.status} ${errorText}`);
    }
    
    const messages = await res.json();
    console.log('Loaded messages:', messages);
    
    if (!Array.isArray(messages) || messages.length === 0) {
      list.innerHTML = '<div class="p-4 text-center text-slate-500">No messages yet</div>';
      return;
    }
    
    list.innerHTML = '';
    messages.forEach(msg => {
      console.log('Message data:', {
        direction: msg.direction,
        sender: msg.sender,
        currentUser: { id: currentUser.id, _id: currentUser._id },
        content: msg.content
      });
      
      const isMine = msg.direction === 'outbound' && (
        msg.sender?._id === currentUser._id || 
        msg.sender?._id === currentUser.id ||
        msg.sender === currentUser._id ||
        msg.sender === currentUser.id
      );
      console.log('Is mine:', isMine, 'Direction:', msg.direction, 'Sender ID:', msg.sender?._id, 'Current user ID:', currentUser.id);
      
      const isBot = msg.sender?.name === 'SEGbot' || msg.sender?.role === 'bot';
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
    console.error('Error loading messages:', e);
    list.innerHTML = `<div class="p-4 text-center text-red-500">Error loading messages: ${e.message}</div>`;
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
      console.log('[FB][Client] Current user:', { id: currentUser.id, name: currentUser.name, role: currentUser.role });
      
      if (!isAgentOrSupervisor()) {
        document.getElementById('facebookConversationsList').innerHTML = '<div class="p-4 text-center text-red-500">Only agents, supervisors, and admins can view Facebook conversations.</div>';
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
