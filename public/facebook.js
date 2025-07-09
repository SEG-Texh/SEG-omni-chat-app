// Facebook Chat Module
const FacebookChat = (() => {
  // Escalation Notification helpers
  window.showFacebookEscalationNotification = function(message) {
    const notif = document.getElementById('facebookEscalationNotification');
    if (notif) {
      notif.textContent = message || 'This conversation has been escalated to a human agent. Please wait for further assistance.';
      notif.classList.remove('hidden');
    }
  }
  window.hideFacebookEscalationNotification = function() {
    const notif = document.getElementById('facebookEscalationNotification');
    if (notif) notif.classList.add('hidden');
  }

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

    // Facebook escalation notification event
    facebookSocket.on('facebook_escalation', (data) => {
      if (!data) return;
      const { conversationId, message } = data;
      if (conversationId === currentConversationId) {
        showFacebookEscalationNotification(message);
      }
    });

    // Facebook escalation notification event
    facebookSocket.on('facebook_escalation', (data) => {
      if (!data) return;
      const { conversationId, message } = data;
      if (conversationId === currentConversationId) {
        showFacebookEscalationNotification(message);
      }
    });

    // Hide escalation notification when switching conversations
    window.addEventListener('facebook_switch_conversation', () => {
      hideFacebookEscalationNotification();
    });

    // --- AGENT: Live chat events ---
    // Handle new live chat request
    facebookSocket.on('new_live_chat_request', (data) => {
      // This is a basic placeholder. You may want to customize UI.
      if (window.showAgentLiveChatRequest) {
        window.showAgentLiveChatRequest(data);
      } else {
        alert('New live chat request! Conversation ID: ' + data.conversationId);
      }
    });
    // Handle result of claim attempt
    facebookSocket.on('claim_result', (data) => {
      if (data.success) {
        alert('You have claimed the session!');
        // Optionally load the conversation UI for this session
      } else {
        alert(data.message || 'Failed to claim session.');
      }
    });
    // Remove request from UI if claimed by another agent
    facebookSocket.on('session_claimed', ({ conversationId }) => {
      // Optionally remove/hide the request from the agent's UI
      if (window.removeAgentLiveChatRequest) {
        window.removeAgentLiveChatRequest(conversationId);
      }
    });
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
      ? conversations.map(conversation => {
          const lastMsg = conversation.lastMessage?.content?.substring(0, 30) || '';
          const date = conversation.updatedAt ? formatDate(conversation.updatedAt) : '';
          return `
            <div class="conversation-item flex items-center gap-3" data-id="${conversation._id}">
              <div class="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold mr-2">👤</div>
                    <div class="flex-1 min-w-0">
                <div class="participant font-medium text-slate-900 truncate">${getParticipantName(conversation)}</div>
                <div class="last-message text-sm text-slate-500 truncate">${lastMsg}</div>
                        </div>
              <div class="conversation-date text-xs text-slate-400 ml-2">${date}</div>
              ${facebookUnreadConversations.has(conversation._id) 
                ? '<span class="unread-badge" style="display:inline-block;background:#ef4444;color:white;border-radius:50%;padding:2px 6px;font-size:10px;margin-left:5px;vertical-align:middle;">●</span>' 
                : ''}
                        </div>
          `;
        }).join('')
      : '<div class="empty-state">No conversations</div>';

    // Add event listeners
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => selectConversation(item.dataset.id));
    });
  };

  const renderMessages = (messages = []) => {
    const { chatArea } = getElements();
    if (!chatArea) return;

    // Sort messages by createdAt ascending (oldest first)
    const filteredMessages = messages
      .filter(msg =>
        (typeof msg.content === 'string' && msg.content.trim() !== '') ||
        (msg.text && msg.text.trim() !== '')
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Find the selected conversation for header display
    const selectedConversation = conversations.find(c => c._id === currentConversationId);
    const participantName = selectedConversation ? getParticipantName(selectedConversation) : "Unknown User";
    chatArea.innerHTML = `
      <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">👤</div>
          <div>
            <div class="font-medium">${participantName}</div>
          </div>
        </div>
        <button id="endFacebookSessionButton" class="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">End Session</button>
      </div>
      <div class="messages-container" id="messagesContainer">
        ${filteredMessages.map(msg => {
          const isMine = msg.sender === window.facebookPageId;
          const date = msg.createdAt ? formatDate(msg.createdAt) : '';
          return `
            <div class="chat-bubble ${isMine ? 'sent' : 'received'}">
              <div class="bubble-content">${
                typeof msg.content === 'string'
                  ? msg.content
                  : (msg.content && typeof msg.content === 'object' && msg.content.text)
                    ? msg.content.text
                    : msg.text || 'No content'
              }</div>
              <div class="bubble-meta">${date}</div>
                    </div>
          `;
        }).join('')}
                    </div>
      <div class="message-input">
        <input type="text" id="messageInput" placeholder="Type a message...">
        <button id="sendButton">Send</button>
      </div>
    `;

    // End Session logic
    const endBtn = document.getElementById("endFacebookSessionButton");
    endBtn.addEventListener("click", async () => {
      if (!currentConversationId) return;
      endBtn.disabled = true;
      endBtn.textContent = "Ending...";
      try {
        const response = await fetch(`/api/facebook/conversation/${currentConversationId}/end`, { method: 'POST' });
        if (response.ok) {
          // Disable input and send button
          document.getElementById("messageInput").disabled = true;
          document.getElementById("sendButton").disabled = true;
          endBtn.textContent = "Session Ended";
        } else {
          endBtn.disabled = false;
          endBtn.textContent = "End Session";
          alert("Failed to end session");
        }
      } catch (err) {
        endBtn.disabled = false;
        endBtn.textContent = "End Session";
        alert("Error ending session");
      }
    });

    // Attach send handlers
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    scrollToBottom();
  };

  // Helper Functions
  // Date formatting: "5 Jul 2025, 11:17"
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  };

  const getParticipantName = (conversation) => {
    const participant = conversation.participants?.find(p => p._id !== window.facebookPageId);
    return participant?.name || `User ${conversation._id.slice(-6)}`;
  };

  const appendMessage = (message) => {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const isMine = message.sender === window.facebookPageId;
    const date = message.createdAt ? formatDate(message.createdAt) : formatDate(new Date());
    const msgElement = document.createElement('div');
    msgElement.className = `chat-bubble ${isMine ? 'sent' : 'received'}`;
    msgElement.innerHTML = `
      <div class="bubble-content">${message.content}</div>
      <div class="bubble-meta">${date}</div>
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
    // Hide escalation notification when switching conversations
    hideFacebookEscalationNotification();
    loadMessages(conversationId);
    clearConversationBadge(conversationId);
    renderConversations(); // Update badges
  };

  facebookSocket.on('facebook_escalation', (data) => {
    if (data.conversationId === currentConversationId) {
      showFacebookEscalationNotification(data.message);
    }
  });

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

  // Attach global logout handler for consistency
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      window.location.href = 'login.html';
    });
  }

  await FacebookChat.init(currentUser);

  // Cleanup when leaving
  window.addEventListener('beforeunload', FacebookChat.cleanup);
});