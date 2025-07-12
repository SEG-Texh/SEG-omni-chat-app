// WhatsApp admin chat logic
let currentWhatsAppConversationId = null;
let currentWhatsAppConversation = null;
let whatsappSocket = null;

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function isAgentOrSupervisor() {
  return currentUser && (currentUser.role === 'agent' || currentUser.role === 'supervisor' || currentUser.role === 'admin');
}

function showWhatsAppPlaceholder() {
  document.getElementById('whatsappChatPlaceholder').style.display = 'flex';
  document.getElementById('whatsappChatStructured').classList.add('hidden');
}

function showWhatsAppChat(conversation) {
  currentWhatsAppConversationId = conversation._id;
  currentWhatsAppConversation = conversation;
  document.getElementById('whatsappChatPlaceholder').style.display = 'none';
  document.getElementById('whatsappChatStructured').classList.remove('hidden');
  // Header
  document.getElementById('whatsappChatTitle').textContent = conversation.participants?.[0] || 'Contact';
  document.getElementById('whatsappChatSubtitle').textContent = (conversation.status === 'active' && conversation.expiresAt && new Date(conversation.expiresAt) > new Date()) ? 'Active' : 'Inactive';
  // Show/hide input for admin
  const form = document.getElementById('whatsappMessageForm');
  if (isAdmin()) {
    form.classList.remove('hidden');
  } else {
    form.classList.add('hidden');
  }
  // Load messages
  loadWhatsAppMessages(conversation._id);
}

async function loadWhatsAppConversations() {
  const list = document.getElementById('whatsappConversationsList');
  list.innerHTML = '<div class="p-4 text-center text-slate-500">Loading conversations...</div>';
  try {
    const res = await apiRequest('/api/conversation?platform=whatsapp');
    if (!res.ok) throw new Error('Failed to load conversations');
    const conversations = await res.json();
    if (!Array.isArray(conversations) || conversations.length === 0) {
      list.innerHTML = '<div class="p-4 text-center text-slate-500">No conversations found</div>';
      showWhatsAppPlaceholder();
      return;
    }
    list.innerHTML = '';
    conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      item.textContent = conv.participants?.[0] || conv.customerId || 'Contact';
      item.onclick = () => showWhatsAppChat(conv);
      list.appendChild(item);
    });
    // Auto-select first
    showWhatsAppChat(conversations[0]);
  } catch (e) {
    list.innerHTML = '<div class="p-4 text-center text-red-500">Error loading conversations</div>';
    showWhatsAppPlaceholder();
  }
}

async function loadWhatsAppMessages(conversationId) {
  const list = document.getElementById('whatsappMessagesList');
  list.innerHTML = '<div class="p-4 text-center text-slate-500">Loading messages...</div>';
  try {
    const res = await apiRequest(`/api/conversation/${conversationId}/messages?platform=whatsapp`);
    if (!res.ok) throw new Error('Failed to load messages');
    const messages = await res.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      list.innerHTML = '<div class="p-4 text-center text-slate-500">No messages yet</div>';
      return;
    }
    list.innerHTML = '';
    messages.forEach(msg => {
      const isMine = msg.direction === 'outbound' && (msg.sender?._id === currentUser._id || msg.sender?._id === currentUser.id);
      const isBot = msg.sender?.name === 'SEGbot' || msg.sender?.role === 'bot';
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble whatsapp ' + (isMine ? 'sent' : 'received');
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

async function sendWhatsAppMessage(e) {
  e.preventDefault();
  const input = document.getElementById('whatsappMessageInput');
  const text = input.value.trim();
  if (!text || !currentWhatsAppConversationId) return;
  try {
    const res = await apiRequest(`/api/conversation/${currentWhatsAppConversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: { text }, platform: 'whatsapp' })
    });
    if (!res.ok) {
      const err = await res.json();
      showMessage('whatsappMessageStatus', 'error', err.error || 'Failed to send message');
      return;
    }
    input.value = '';
    loadWhatsAppMessages(currentWhatsAppConversationId);
  } catch (e) {
    showMessage('whatsappMessageStatus', 'error', e.message || 'Failed to send message');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Wait for authentication check to complete
  const checkAuthAndInit = () => {
    if (currentUser) {
      // Authentication check completed
      console.log('[WA][Client] Current user:', { id: currentUser.id, name: currentUser.name, role: currentUser.role });
      if (!isAdmin()) {
        document.getElementById('whatsappConversationsList').innerHTML = '<div class="p-4 text-center text-red-500">Only admins can view WhatsApp conversations.</div>';
        showWhatsAppPlaceholder();
        return;
      }
      // setupWhatsAppSocket(); // Removed as per edit hint
      loadWhatsAppConversations();
      // Message form submit
      const form = document.getElementById('whatsappMessageForm');
      if (form) {
        form.addEventListener('submit', sendWhatsAppMessage);
      }
    } else {
      // Authentication check not complete yet, wait a bit and try again
      setTimeout(checkAuthAndInit, 100);
    }
  };
  
  checkAuthAndInit();
});
