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
  // Show/hide end session button
  const endSessionButton = document.getElementById('facebookEndSessionButton');
  if (isAgentOrSupervisor() && conversation.status === 'active') {
    endSessionButton.classList.remove('hidden');
  } else {
    endSessionButton.classList.add('hidden');
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
        
        showFacebookChat(conv);
      };
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

async function endFacebookSession() {
  if (!currentFacebookConversationId) {
    showMessage('facebookMessageStatus', 'error', 'No active conversation to end');
    return;
  }
  
  if (!confirm('Are you sure you want to end this conversation session? This action cannot be undone.')) {
    return;
  }
  
  try {
    const res = await apiRequest(`/api/conversation/${currentFacebookConversationId}/end`, {
      method: 'POST'
    });
    
    if (!res.ok) {
      const err = await res.json();
      showMessage('facebookMessageStatus', 'error', err.error || 'Failed to end session');
      return;
    }
    
    showMessage('facebookMessageStatus', 'success', 'Session ended successfully');
    
    // Update current conversation status
    if (currentFacebookConversation) {
      currentFacebookConversation.status = 'inactive';
      currentFacebookConversation.endTime = new Date();
    }
    
    // Update UI to reflect inactive status
    document.getElementById('facebookChatSubtitle').textContent = 'Inactive';
    document.getElementById('facebookEndSessionButton').classList.add('hidden');
    
    // Reload conversations list to update status
    loadFacebookConversations();
    
  } catch (e) {
    showMessage('facebookMessageStatus', 'error', e.message || 'Failed to end session');
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
      
      // End session button
      const endSessionButton = document.getElementById('facebookEndSessionButton');
      if (endSessionButton) {
        endSessionButton.addEventListener('click', endFacebookSession);
      }
    } else {
      // Authentication check not complete yet, wait a bit and try again
      setTimeout(checkAuthAndInit, 100);
    }
  };
  
  checkAuthAndInit();
});
