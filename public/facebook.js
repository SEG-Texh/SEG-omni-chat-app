// Initialize Facebook-specific variables
let currentConversationId = null;
let conversations = [];
let facebookUnreadConversations = new Set();
let facebookSocket = null;

// Initialize Facebook after DOM is loaded
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Ensure we have a valid token
    if (!currentUser?.token) {
      throw new Error('No valid token found');
    }

    // DOM Elements
    const conversationsList = document.getElementById('facebookConversationsList');
    const chatArea = document.getElementById('facebookChatArea');
    if (!conversationsList || !chatArea) {
      throw new Error('Required DOM elements not found');
    }

    // Initialize socket with token
    facebookSocket = io({ auth: { token: currentUser.token } });
    
    // Wait for socket to connect
    await new Promise((resolve, reject) => {
      if (!facebookSocket) {
        reject(new Error('Socket initialization failed'));
        return;
      }

      const connectTimeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 5000);

      facebookSocket.on('connect', () => {
        clearTimeout(connectTimeout);
        resolve();
      });

      facebookSocket.on('connect_error', (error) => {
        clearTimeout(connectTimeout);
        reject(error);
      });
    });

    // Set up message event listeners after successful connection
    if (facebookSocket) {
      facebookSocket.on('new_message', (message) => {
        // If message is for the active conversation, update chat instantly
        if (message.conversation === currentConversationId) {
          renderMessages([message], true); // true = append single message
          // Optionally scroll chat to bottom
          const messagesContainer = document.getElementById('messagesContainer');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        } else {
          // Mark as unread
          facebookUnreadConversations.add(message.conversation);
          updateFacebookConversationBadge(message.conversation);
          // Show browser notification
          showFacebookNewMessageNotification(message.content || 'New message');
        }
      });
    }

    // Load conversations after successful connection
    await loadConversations();

    // Initialize UI elements
    initializeUI();

  } catch (error) {
    console.error('Facebook initialization failed:', error);
    alert('Failed to initialize Facebook chat. Please try again.');
    // Optionally redirect to login if auth failed
    if (error.message === 'No valid token found') {
      window.location.href = 'login.html';
    }
  }
});

// Initialize UI elements
function initializeUI() {
  // DOM Elements
  const conversationsList = document.getElementById('facebookConversationsList');
  const chatArea = document.getElementById('facebookChatArea');

  if (!conversationsList || !chatArea) {
    console.error('Required DOM elements not found');
    return;
  }

  // Initialize conversation list
  conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">Loading conversations...</div>';

  // Initialize chat area
  chatArea.innerHTML = `
    <div class="flex-1 flex flex-col">
      <div class="flex-1 flex items-center justify-center text-slate-500">
        <div class="text-center">
          <div class="text-4xl mb-4">💬</div>
          <div class="text-lg">Select a conversation to start chatting</div>
        </div>
      </div>
    </div>
  `;
}

// DOM elements
const conversationsList = document.getElementById('facebookConversationsList');
const chatArea = document.getElementById('facebookChatArea');

function updateFacebookConversationBadge(conversationId) {
  const el = document.querySelector(`[data-facebook-conversation-id="${conversationId}"] .unread-badge`);
  if (el) el.style.display = 'inline-block';
}

function clearFacebookConversationBadge(conversationId) {
  facebookUnreadConversations.delete(conversationId);
  const el = document.querySelector(`[data-facebook-conversation-id="${conversationId}"] .unread-badge`);
  if (el) el.style.display = 'none';
}

function showFacebookNewMessageNotification(text) {
  if (window.Notification && Notification.permission === 'granted') {
    new Notification('Facebook New Message', { body: text });
  } else if (window.Notification && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}


// Load and render conversations
async function loadConversations() {
  const res = await apiRequest('/api/facebook/conversations');
  if (!res.ok) {
    alert('Failed to load conversations.');
    return;
  }
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
    el.setAttribute('data-facebook-conversation-id', conv._id);
    el.innerHTML = `
      <div class="font-semibold">${conv.participants.find(id => id !== window.facebookPageId)}</div>
      <div class="text-sm text-slate-500 truncate">${lastMsg}</div>
      <span class="unread-badge" style="display:${facebookUnreadConversations.has(conv._id) ? 'inline-block' : 'none'};background:red;color:white;border-radius:50%;padding:2px 6px;font-size:10px;margin-left:5px;">●</span>
    `;
    el.onclick = () => selectConversation(conv._id);
    conversationsList.appendChild(el);
  });
}

// Load and render messages for a conversation
async function loadMessages(conversationId) {
  const res = await apiRequest(`/api/facebook/messages/${conversationId}`);
  if (!res.ok) {
    alert('Failed to load messages.');
    return;
  }
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
  clearFacebookConversationBadge(conversationId);
  loadMessages(conversationId);
}

// Real-time new message
facebookSocket.on('new_message', (message) => {
  // If message is for the active conversation, update chat instantly
  if (message.conversation === currentConversationId) {
    renderMessages([message], true); // true = append single message
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } else {
    // Mark as unread
    facebookUnreadConversations.add(message.conversation);
    updateFacebookConversationBadge(message.conversation);
    // Show browser notification
    showFacebookNewMessageNotification(message.content || 'New message');
    // Play sound
    if (facebookNotificationSound) facebookNotificationSound.play().catch(()=>{});
  }
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
  const res = await apiRequest('/api/facebook/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ conversationId: currentConversationId, content })
  });
  if (!res.ok) {
    alert('Failed to send message.');
    return;
  }
  input.value = '';
}

// Initialize Facebook page
async function initializeFacebookPage() {
  // Set Facebook page ID (you'll need to replace this with your actual page ID)
  window.facebookPageId = 'YOUR_PAGE_ID'; // <-- Replace with your actual Facebook page ID
  
  // Initialize the page
  await initializeFacebook();
}

// Initialize page after authentication
window.addEventListener('DOMContentLoaded', () => {
  initializeFacebookPage();
});
