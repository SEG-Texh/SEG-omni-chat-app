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
  // Show/hide end session button
  const endSessionButton = document.getElementById('whatsappEndSessionButton');
  if (isAdmin() && conversation.status === 'active') {
    endSessionButton.classList.remove('hidden');
  } else {
    endSessionButton.classList.add('hidden');
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
      
      // Create conversation content
      const content = document.createElement('div');
      content.className = 'flex-1';
      content.textContent = conv.participants?.[0] || conv.customerId || 'Contact';
      
      // Create notification badge if there are unread messages
      const unreadCount = conv.unreadCount || 0;
      if (unreadCount > 0) {
        item.classList.add('unread');
        const badge = document.createElement('div');
        badge.className = 'notification-badge';
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
        item.appendChild(badge);
      }
      
      item.appendChild(content);
      item.setAttribute('data-conversation-id', conv._id);
      item.onclick = async () => {
        // Remove unread styling when clicked
        item.classList.remove('unread');
        const badge = item.querySelector('.notification-badge');
        if (badge) badge.remove();
        
        // Mark conversation as read
        if (conv.unreadCount > 0) {
          try {
            await apiRequest(`/api/conversation/${conv._id}/read`, { method: 'POST' });
          } catch (error) {
            console.error('Failed to mark conversation as read:', error);
          }
        }
        
        showWhatsAppChat(conv);
      };
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
      console.log('WhatsApp Message data:', {
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
      console.log('WhatsApp Is mine:', isMine, 'Direction:', msg.direction, 'Sender ID:', msg.sender?._id, 'Current user ID:', currentUser.id);
      
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
    }
    input.value = '';
    loadWhatsAppMessages(currentWhatsAppConversationId);
  } catch (e) {
    showMessage('whatsappMessageStatus', 'error', e.message || 'Failed to send message');
  }
}

async function endWhatsAppSession() {
  if (!currentWhatsAppConversationId) {
    showMessage('whatsappMessageStatus', 'error', 'No active conversation to end');
    return;
  }
  
  if (!confirm('Are you sure you want to end this conversation session? This action cannot be undone.')) {
    return;
  }
  
  try {
    const res = await apiRequest(`/api/conversation/${currentWhatsAppConversationId}/end`, {
      method: 'POST'
    });
    
    if (!res.ok) {
      const err = await res.json();
      showMessage('whatsappMessageStatus', 'error', err.error || 'Failed to end session');
      return;
    }
    
    showMessage('whatsappMessageStatus', 'success', 'Session ended successfully');
    
    // Update current conversation status
    if (currentWhatsAppConversation) {
      currentWhatsAppConversation.status = 'inactive';
      currentWhatsAppConversation.endTime = new Date();
    }
    
    // Update UI to reflect inactive status
    document.getElementById('whatsappChatSubtitle').textContent = 'Inactive';
    document.getElementById('whatsappEndSessionButton').classList.add('hidden');
    
    // Reload conversations list to update status
    loadWhatsAppConversations();
    
  } catch (e) {
    showMessage('whatsappMessageStatus', 'error', e.message || 'Failed to end session');
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
      loadWhatsAppConversations();
      // Message form submit
      const form = document.getElementById('whatsappMessageForm');
      if (form) {
        form.addEventListener('submit', sendWhatsAppMessage);
      }
      
      // End session button
      const endSessionButton = document.getElementById('whatsappEndSessionButton');
      if (endSessionButton) {
        endSessionButton.addEventListener('click', endWhatsAppSession);
      }
    } else {
      // Authentication check not complete yet, wait a bit and try again
      setTimeout(checkAuthAndInit, 100);
    }
  };
  
  checkAuthAndInit();
});
