// Facebook Chat Module
const FacebookChat = (() => {
  // State variables
  let currentConversationId = null;
  let conversations = [];
  let facebookUnreadConversations = new Set();
  let facebookSocket = null;
  let currentUser = {}; // Should be set from your auth system

  // DOM Elements
  const getElements = () => ({
    conversationsList: document.getElementById('facebookConversationsList'),
    chatArea: document.getElementById('facebookChatArea'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    messagesContainer: document.getElementById('messagesContainer')
  });

  // API Request Helper
  const apiRequest = async (endpoint, options = {}) => {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
      }
    };

    try {
      const response = await fetch(endpoint, { ...defaultOptions, ...options });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  };

  // Socket Initialization
  const initSocket = () => {
    if (facebookSocket) {
      facebookSocket.disconnect();
      facebookSocket.removeAllListeners();
    }

    // Use Heroku socket URL for production
    let socketUrl;
    if (window.location.hostname.includes('herokuapp.com')) {
      socketUrl = window.location.protocol === 'https:'
        ? 'wss://omnichatapp-5312a76969fb.herokuapp.com'
        : 'ws://omnichatapp-5312a76969fb.herokuapp.com';
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socketUrl = `${protocol}://${window.location.host}`;
    }
    
    facebookSocket = io(socketUrl, {
      auth: { token: currentUser.token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Socket Event Handlers
    facebookSocket.on('connect', () => {
      console.log('✅ Facebook socket connected');
      facebookSocket.emit('joinFacebookRoom');
    });

    facebookSocket.on('disconnect', () => {
      console.log('⚠️ Facebook socket disconnected');
    });

    facebookSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    facebookSocket.on('newMessage', handleNewMessage);
  };

  // Message Handling
  const handleNewMessage = ({ message, conversationId }) => {
    if (conversationId === currentConversationId) {
      appendMessage(message);
      scrollToBottom();
    } else {
      facebookUnreadConversations.add(conversationId);
      updateConversationBadge(conversationId);
      showNotification('New Facebook message');
    }
  };

  // UI Rendering
  const renderConversations = () => {
    const { conversationsList } = getElements();
    if (!conversationsList) return;

    conversationsList.innerHTML = conversations.length 
      ? conversations.map(conversation => `
          <div class="conversation-item" data-id="${conversation._id}">
            <div class="participant">${getParticipantName(conversation)}</div>
            <div class="last-message">${conversation.lastMessage?.content?.substring(0, 30) || ''}</div>
            ${facebookUnreadConversations.has(conversation._id) 
              ? '<span class="unread-badge"></span>' 
              : ''}
          </div>
        `).join('')
      : '<div class="empty-state">No conversations</div>';

    // Add event listeners
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => selectConversation(item.dataset.id));
    });
  };

  const renderMessages = (messages = []) => {
    const { chatArea } = getElements();
    if (!chatArea) return;

    chatArea.innerHTML = `
      <div class="messages-container" id="messagesContainer">
        ${messages.map(msg => `
          <div class="message ${msg.sender === window.facebookPageId ? 'outgoing' : 'incoming'}">
            <div class="content">${msg.content}</div>
            <div class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>
          </div>
        `).join('')}
      </div>
      <div class="message-input">
        <input type="text" id="messageInput" placeholder="Type a message...">
        <button id="sendButton">Send</button>
      </div>
    `;

    // Attach send handlers
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    scrollToBottom();
  };

  // Helper Functions
  const getParticipantName = (conversation) => {
    const participant = conversation.participants?.find(p => p._id !== window.facebookPageId);
    return participant?.name || `User ${conversation._id.slice(-6)}`;
  };

  const appendMessage = (message) => {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const msgElement = document.createElement('div');
    msgElement.className = `message ${message.sender === window.facebookPageId ? 'outgoing' : 'incoming'}`;
    msgElement.innerHTML = `
      <div class="content">${message.content}</div>
      <div class="timestamp">${new Date().toLocaleTimeString()}</div>
    `;
    container.appendChild(msgElement);
  };

  const scrollToBottom = () => {
    const container = document.getElementById('messagesContainer');
    if (container) container.scrollTop = container.scrollHeight;
  };

  const updateConversationBadge = (conversationId) => {
    const badge = document.querySelector(`.conversation-item[data-id="${conversationId}"] .unread-badge`);
    if (badge) badge.style.display = 'block';
  };

  // Clear unread badge when conversation is read
  const clearConversationBadge = (conversationId) => {
    const badge = document.querySelector(`.conversation-item[data-id="${conversationId}"] .unread-badge`);
    if (badge) badge.style.display = 'none';
    facebookUnreadConversations.delete(conversationId);
  };

  const showNotification = (message) => {
    if (window.Notification) {
      if (Notification.permission === 'granted') {
        new Notification('New Message', { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('New Message', { body: message });
          }
        });
      }
    }
  };


  // Core Functions
  const loadConversations = async () => {
    try {
      conversations = await apiRequest('/api/facebook/conversations');
      renderConversations();
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const messages = await apiRequest(`/api/facebook/messages/${conversationId}`);
      renderMessages(messages);
      currentConversationId = conversationId;
      facebookSocket.emit('joinConversation', conversationId);
      facebookUnreadConversations.delete(conversationId);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentConversationId) return;

    try {
      await apiRequest('/api/facebook/send', {
        method: 'POST',
        body: JSON.stringify({ conversationId: currentConversationId, content })
      });
      
      input.value = '';
      appendMessage({
        content,
        sender: window.facebookPageId,
        timestamp: new Date()
      });
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const selectConversation = (conversationId) => {
    loadMessages(conversationId);
    clearConversationBadge(conversationId);
    renderConversations(); // Update badges
  };

  // Public Interface
  return {
    init: async (user) => {
      currentUser = user;
      window.facebookPageId = 'YOUR_FACEBOOK_PAGE_ID'; // Set your actual page ID
      
      try {
        initSocket();
        await loadConversations();
        console.log('Facebook chat initialized successfully');
      } catch (error) {
        console.error('Facebook chat initialization failed:', error);
      }
    },
    cleanup: () => {
      if (facebookSocket) {
        facebookSocket.disconnect();
        facebookSocket.removeAllListeners();
      }
    }
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  // Dynamically load currentUser from localStorage
  let currentUser = null;
  try {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      // Set facebookPageId from user if available
      if (currentUser.facebookPageId) {
        window.facebookPageId = currentUser.facebookPageId;
      } else if (currentUser.pageId) {
        window.facebookPageId = currentUser.pageId;
      } else if (currentUser.id) {
        window.facebookPageId = currentUser.id;
      }
    }
  } catch (e) {
    console.error('Failed to load currentUser from localStorage:', e);
  }
  if (!currentUser || !currentUser.token) {
    alert('Not authenticated. Please log in again.');
    window.location.href = 'login.html';
    return;
  }

  await FacebookChat.init(currentUser);

  // Cleanup when leaving
  window.addEventListener('beforeunload', FacebookChat.cleanup);
});