// Initialize Facebook-specific variables
let currentConversationId = null;
let conversations = [];
let facebookUnreadConversations = new Set();
let facebookSocket = null;
console.log('RENDERING CONVERSATIONS:', conversations);
// API request function
async function apiRequest(endpoint, options = {}) {
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentUser.token}`
    }
  };
  const config = { ...defaultOptions, ...options };
  
  try {
    // Ensure we have a full URL
    const fullUrl = window.location.origin + endpoint;
    console.log('Making API request to:', fullUrl);
    const response = await fetch(fullUrl, config);
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    console.log('API response data:', data);
    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Initialize Facebook page ID
window.facebookPageId = '666543219865098'; // Your Facebook page ID

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

    // Initialize socket with token and correct protocol for Heroku
    let socketUrl;
    if (window.location.protocol === 'https:') {
      socketUrl = 'wss://omnichatapp-5312a76969fb.herokuapp.com';
    } else {
      socketUrl = 'ws://omnichatapp-5312a76969fb.herokuapp.com';
    }
    facebookSocket = io(socketUrl, {
      auth: { token: currentUser.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      allowEIO3: true,
      query: {
        token: currentUser.token
      }
    });

    // Add error handling
    facebookSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    facebookSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    facebookSocket.on('connect_timeout', (timeout) => {
      console.error('Connection timeout:', timeout);
    });

    facebookSocket.on('reconnect_failed', () => {
      console.error('Reconnect failed');
    });

    facebookSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    // Add connection listener
    facebookSocket.on('connect', () => {
      console.log('Facebook socket connected successfully');
      // Join the Facebook room
      facebookSocket.emit('joinFacebookRoom');
    });

    // Add error listener
    facebookSocket.on('connect_error', (err) => {
      console.error('Facebook socket connection error:', err);
    });

    // Listen for real-time new messages
    if (facebookSocket) {
      facebookSocket.on('newMessage', (message) => {
        console.log('Received new Facebook message:', message);
        
        // If message is for the active conversation, update chat instantly
        if (message.conversationId === currentConversationId) {
          renderMessages([message], true); // true = append single message
          const messagesContainer = document.getElementById('messagesContainer');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        } else {
          // Mark as unread
          facebookUnreadConversations.add(message.conversationId);
          updateFacebookConversationBadge(message.conversationId);
          // Show browser notification
          showFacebookNewMessageNotification(message.text || 'New message');
        }
      });
    }

    // Add disconnect listener
    facebookSocket.on('disconnect', () => {
      console.log('Facebook socket disconnected');
    });

    // Add message listener
    facebookSocket.on('newMessage', (data) => {
      const { message, conversationId } = data;
      
      // If message is for the active conversation, update chat instantly
      if (conversationId === currentConversationId) {
        renderMessages([message], true); // true = append single message
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      } else {
        // Mark as unread
        facebookUnreadConversations.add(conversationId);
        updateFacebookConversationBadge(conversationId);
        // Show browser notification
        showFacebookNewMessageNotification(message.text || 'New message');
      }
    });

    // Wait for socket to connect before proceeding
    await new Promise((resolve, reject) => {
      if (!facebookSocket) {
        reject(new Error('Socket initialization failed'));
        return;
      }

      // Set up error handlers first
      facebookSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        reject(error);
      });

      // Wait for successful connection
      facebookSocket.on('connect', () => {
        console.log('Socket connected successfully');
        resolve();
      });

      // Add timeout
      const connectTimeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 5000);
    });

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
    // Clear socket if initialization failed
    facebookSocket = null;
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
  try {
    conversations = await apiRequest('/api/facebook/conversations');
    console.log('Loaded conversations:', conversations);
    renderConversations();
  } catch (error) {
    console.error('Failed to load conversations:', error);
    alert('Failed to load conversations. Please try again.');
  }
}

function renderConversations() {
  const conversationsList = document.getElementById('facebookConversationsList');
  conversationsList.innerHTML = '';
  if (!Array.isArray(conversations) || conversations.length === 0) {
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">No conversations.</div>';
    return;
  }
  conversations.forEach(conv => {
    const lastMsg = conv.lastMessage ? conv.lastMessage.content : '';
    let otherParticipant = "Unknown";
    if (Array.isArray(conv.participants) && conv.participants.length > 0) {
      const found = conv.participants.find(p => {
        const idStr = typeof p === 'object' ? (p._id?.toString?.() || p._id || p) : p;
        return idStr !== window.facebookPageId;
      });
      if (found) {
        if (typeof found === 'object' && found.name) {
          otherParticipant = found.name;
        } else if (typeof found === 'string') {
          otherParticipant = 'Facebook User ' + found;
        } else if (found._id) {
          otherParticipant = 'Facebook User ' + found._id;
        }
      }
    } else if (conv._id) {
      otherParticipant = 'Conversation ' + conv._id.slice(-6);
    }
    const el = document.createElement('div');
    el.className = 'p-4 border-b cursor-pointer hover:bg-slate-100';
    el.setAttribute('data-facebook-conversation-id', conv._id);
    el.innerHTML = `
      <div class="font-semibold">${otherParticipant}</div>
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


// Initialize Facebook after DOM is loaded
window.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!currentUser?.token) {
      throw new Error('No valid token found');
    }
    const conversationsList = document.getElementById('facebookConversationsList');
    const chatArea = document.getElementById('facebookChatArea');
    if (!conversationsList || !chatArea) {
      throw new Error('Required DOM elements not found');
    }
    // Use correct protocol for Heroku
    let socketUrl;
    if (window.location.protocol === 'https:') {
      socketUrl = 'wss://omnichatapp-5312a76969fb.herokuapp.com';
    } else {
      socketUrl = 'ws://omnichatapp-5312a76969fb.herokuapp.com';
    }
    facebookSocket = io(socketUrl, {
      auth: { token: currentUser.token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      allowEIO3: true,
      query: { token: currentUser.token }
    });
    facebookSocket.on('connect', () => {
      console.log('Facebook socket connected successfully');
      facebookSocket.emit('joinFacebookRoom');
    });
    facebookSocket.on('connect_error', err => console.error('Facebook socket connection error:', err));
    facebookSocket.on('disconnect', () => console.log('Facebook socket disconnected'));
    facebookSocket.on('newMessage', data => {
      const { message, conversationId } = data;
      if (conversationId === currentConversationId) {
        renderMessages([message], true);
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } else {
        facebookUnreadConversations.add(conversationId);
        updateFacebookConversationBadge(conversationId);
        showFacebookNewMessageNotification(message.text || 'New message');
      }
    });
    await new Promise((resolve, reject) => {
      if (!facebookSocket) return reject(new Error('Socket initialization failed'));
      facebookSocket.on('connect', resolve);
      facebookSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
    });
    await loadConversations();
    initializeUI();
  } catch (error) {
    console.error('Facebook initialization failed:', error);
    alert('Failed to initialize Facebook chat. Please try again.');
    if (error.message === 'No valid token found') window.location.href = 'login.html';
    facebookSocket = null;
  }
});
