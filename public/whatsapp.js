// WhatsApp page specific functionality
let currentWhatsAppConversationId = null
let currentWhatsAppNumber = null

// --- Socket.io setup ---
let whatsappSocket = null;
let unreadConversations = new Set();

function connectWhatsAppSocket() {
  if (!whatsappSocket) {
    whatsappSocket = io({
  auth: { token: currentUser?.token },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});
  }
}

function showWhatsAppChatInterface(conversation) {
  // Hide the placeholder and show the structured chat area
  const placeholder = document.getElementById('whatsappChatPlaceholder');
  if (placeholder) placeholder.style.display = 'none';
  const chatStructured = document.getElementById('whatsappChatStructured');
  if (chatStructured) {
    chatStructured.classList.remove('hidden');
    chatStructured.style.display = 'flex';
  }
  // Update chat header with conversation info
  const chatTitle = document.getElementById('chatTitle');
  if (chatTitle) {
    // Use the participant's name or fallback
    chatTitle.textContent = conversation.participants?.[0]?.name || 'Contact';
  }
  const chatSubtitle = document.getElementById('chatSubtitle');
  if (chatSubtitle) {
    chatSubtitle.textContent = 'Online'; // You may update this with real status if available
  }
  // Load and display messages for this conversation
  loadWhatsAppMessages(conversation._id);
}

// Also ensure that when no conversation is selected, the placeholder is shown and chat area hidden
function showWhatsAppPlaceholder() {
  const placeholder = document.getElementById('whatsappChatPlaceholder');
  if (placeholder) placeholder.style.display = 'flex';
  const chatStructured = document.getElementById('whatsappChatStructured');
  if (chatStructured) {
    chatStructured.classList.add('hidden');
    chatStructured.style.display = 'none';
  }
}

// Move this block into showWhatsAppChatInterface
function showWhatsAppChatInterface(conversation) {
  // Hide the placeholder and show the structured chat area
  const placeholder = document.getElementById('whatsappChatPlaceholder');
  if (placeholder) placeholder.style.display = 'none';
  const chatStructured = document.getElementById('whatsappChatStructured');
  if (chatStructured) {
    chatStructured.classList.remove('hidden');
    chatStructured.style.display = 'flex';
  }
  // Update chat header with conversation info
  const chatTitle = document.getElementById('chatTitle');
  if (chatTitle) {
    // Use the participant's name or fallback
    chatTitle.textContent = conversation.participants?.[0]?.name || 'Contact';
  }
  const chatSubtitle = document.getElementById('chatSubtitle');
  if (chatSubtitle) {
    chatSubtitle.textContent = 'Online'; // You may update this with real status if available
  }
  // Load and display messages for this conversation
  loadWhatsAppMessages(conversation._id);

  // Add End Session button if not present
  let chatHeader = chatStructured?.querySelector('.px-6.py-4.border-b');
  if (!chatHeader) chatHeader = document.getElementById('chatHeader');
  if (chatHeader && !document.getElementById('endSessionBtn')) {
    const endBtn = document.createElement('button');
    endBtn.id = 'endSessionBtn';
    endBtn.textContent = 'End Session';
    endBtn.className = 'ml-auto bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition';
    endBtn.style.marginLeft = 'auto';
    endBtn.onclick = async function() {
      if (!conversation._id) return;
      endBtn.disabled = true;
      endBtn.textContent = 'Ending...';
      try {
        const res = await fetch(`/api/whatsapp/conversation/${conversation._id}/end`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (res.ok) {
          endBtn.textContent = 'Session Ended';
          endBtn.className += ' opacity-60';
          showMessage('whatsappMessageStatus', 'success', 'Session ended.');
        } else {
          endBtn.textContent = 'End Session';
          endBtn.disabled = false;
          showMessage('whatsappMessageStatus', 'error', 'Failed to end session.');
        }
      } catch (e) {
        endBtn.textContent = 'End Session';
        endBtn.disabled = false;
        showMessage('whatsappMessageStatus', 'error', 'Network error.');
      }
    };
    chatHeader.appendChild(endBtn);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  connectWhatsAppSocket();
  loadWhatsAppConversations();

  // Listen for escalation requests (show escalation notification for WhatsApp agents)
  if (whatsappSocket) {
    whatsappSocket.on('escalation_request', (data) => {
      if (window.showEscalationNotification) {
        window.showEscalationNotification({
          ...data,
          onAccept: () => whatsappSocket.emit('accept_escalation', { conversationId: data.conversationId }),
          onDecline: () => whatsappSocket.emit('decline_escalation', { conversationId: data.conversationId })
        });
      } else {
        alert('New escalation request! Conversation ID: ' + data.conversationId);
      }
    });

    // Listen for real-time new messages
    whatsappSocket.on('new_message', (message) => {

    // --- AGENT: Live chat events ---
    // Handle new live chat request
    whatsappSocket.on('new_live_chat_request', (data) => {
      if (window.showAgentLiveChatRequest) {
        window.showAgentLiveChatRequest(data);
      } else {
        alert('New WhatsApp live chat request! Conversation ID: ' + data.conversationId);
      }
    });
    // Handle result of claim attempt
    whatsappSocket.on('claim_result', (data) => {
      if (data.success) {
        alert('You have claimed the WhatsApp session!');
        loadWhatsAppConversations(data.conversation?._id); // Refresh list and auto-select the claimed conversation
      } else {
        alert(data.message || 'Failed to claim WhatsApp session.');
      }
    });
    // Remove request from UI if claimed by another agent
    whatsappSocket.on('session_claimed', ({ conversationId }) => {
      if (window.removeAgentLiveChatRequest) {
        window.removeAgentLiveChatRequest(conversationId);
      }
    });

      // If message is for the active conversation, update chat instantly
      if (message.conversation === currentWhatsAppConversationId) {
        // Append the new message to the existing list in the UI
        let allMessages = window.currentWhatsAppMessages || [];
        allMessages = [...allMessages, message];
        window.currentWhatsAppMessages = allMessages;
        displayWhatsAppMessages(allMessages);
        // Optionally scroll chat to bottom
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      } else {
        // Mark as unread
        unreadConversations.add(message.conversation);
        updateWhatsAppConversationBadge(message.conversation);
        // Show browser notification
        showNewMessageNotification('WhatsApp', message.content?.text || 'New message');
        // Play sound
        if (notificationSound) notificationSound.play().catch(()=>{});
      }
    });
  }
});

function updateWhatsAppConversationBadge(conversationId) {
  const el = document.querySelector(`[data-conversation-id="${conversationId}"] .unread-badge`);
  if (el) el.style.display = 'inline-block';
}

function clearWhatsAppConversationBadge(conversationId) {
  unreadConversations.delete(conversationId);
  const el = document.querySelector(`[data-conversation-id="${conversationId}"] .unread-badge`);
  if (el) el.style.display = 'none';
}

function showNewMessageNotification(platform, text) {
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(`${platform} New Message`, { body: text });
  } else if (window.Notification && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}


// Load WhatsApp conversations
async function loadWhatsAppConversations(selectedConversationId = null) {
  if (!currentUser?.token) return

  const conversationsList = document.getElementById("whatsappConversationsList")

  try {
    const response = await apiRequest("/api/conversation?platform=whatsapp")
    const conversations = await response.json()

    conversationsList.innerHTML = ""

    if (conversations.length === 0) {
      conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">No conversations found</div>'
      return
    }

    conversations.forEach((conversation) => {
      const participant = conversation.participants[0]
      const item = document.createElement("div")
      item.className = "conversation-item"
      item.setAttribute('data-conversation-id', conversation._id);
      item.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                        👤
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-slate-900 truncate">
                            ${participant?.name || "Unknown User"}
                        </div>
                        <div class="text-sm text-slate-500 truncate">
                            ${conversation.lastMessage?.content?.text || "No messages yet"}
                        </div>
                    </div>
                    <div class="text-xs text-slate-400">
                        ${new Date(conversation.updatedAt).toLocaleDateString()}
                    </div>
                    <span class="unread-badge" style="display:${unreadConversations.has(conversation._id) ? 'inline-block' : 'none'};background:#ef4444;color:white;border-radius:50%;padding:2px 6px;font-size:10px;margin-left:5px;vertical-align:middle;">●</span>
                </div>
            `

      item.addEventListener("click", () => selectWhatsAppConversation(conversation, item))
      conversationsList.appendChild(item)
      // If this conversation should be auto-selected
      if (selectedConversationId && conversation._id === selectedConversationId) {
        setTimeout(() => selectWhatsAppConversation(conversation, item), 0);
      }
    })
  } catch (error) {
    console.error("Error loading WhatsApp conversations:", error)
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">Error loading conversations</div>'
  }
}

// Select WhatsApp conversation
function selectWhatsAppConversation(conversation, element = null) {
  // If element is not provided, find it in the DOM
  if (!element) {
    element = document.querySelector(`[data-conversation-id="${conversation._id}"]`);
  }
  currentWhatsAppConversationId = conversation._id
  currentWhatsAppNumber = conversation.participants?.[0]?.platformIds?.whatsapp || conversation.platformConversationId
  window.lastSelectedWhatsAppConversation = conversation; // Track last selected

  // Join socket room for this conversation
  if (whatsappSocket) {
    whatsappSocket.emit('joinWhatsAppConversationRoom', conversation._id);
  }

  // Clear unread badge
  clearWhatsAppConversationBadge(conversation._id);

  // Update active conversation styling
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.remove("active")
  })
  if (element) element.classList.add("active")

  // Load messages and show chat interface
  showWhatsAppChatInterface(conversation);
}

// Load WhatsApp messages
async function loadWhatsAppMessages(conversationId) {
  console.log('loadWhatsAppMessages called with:', conversationId);
  if (!currentUser?.token) return

  try {
    const response = await apiRequest(`/api/conversation/${conversationId}/messages?platform=whatsapp`)
    const messages = await response.json()
    displayWhatsAppMessages(messages)
  } catch (error) {
    console.error("Error loading WhatsApp messages:", error)
  }
}


// Display WhatsApp messages
function displayWhatsAppMessages(messages = []) {
  console.log('displayWhatsAppMessages called with:', messages);
  const messagesContainer = document.getElementById("messagesList");
  if (!messagesContainer) return;

  // Sort messages by createdAt ascending (oldest first)
  const filteredMessages = messages
    .filter(msg =>
      (typeof msg.content === 'string' && msg.content.trim() !== '') ||
      (typeof msg.content?.text === 'string' && msg.content.text.trim() !== '') ||
      (msg.text && msg.text.trim() !== '')
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  messagesContainer.innerHTML = filteredMessages.map(msg => {
    // Robust sent/received detection
    const isMine =
      msg.direction === "outbound" ||
      msg.fromMe === true ||
      (msg.sender && (msg.sender._id === currentUser._id || msg.sender.id === currentUser.id));
    const date = msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }) : '';
    return `
      <div class="chat-bubble whatsapp ${isMine ? 'sent' : 'received'}">
        <div class="bubble-content">${
          typeof msg.content === 'string'
            ? msg.content
            : (typeof msg.content?.text === 'string'
                ? msg.content.text
                : msg.text || 'No content')
        }</div>
        <div class="bubble-meta">${date}</div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send WhatsApp message
async function sendWhatsAppMessage() {
  const messageInput = document.getElementById("messageInput")
  if (!messageInput) return;
  const text = messageInput.value.trim()

  if (!text || !currentWhatsAppConversationId) {
    return
  }

  try {
    const response = await apiRequest(`/api/conversation/${currentWhatsAppConversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: { text: text },
        platform: "whatsapp"
      }),
    })

    if (response.ok) {
      messageInput.value = ""
      // Only reload messages, do not reload conversation list or reset chat UI
      loadWhatsAppMessages(currentWhatsAppConversationId)
      // Ensure chat interface remains visible and active
      if (currentWhatsAppConversationId) {
        const conversation = window.lastSelectedWhatsAppConversation;
        if (conversation) showWhatsAppChatInterface(conversation);
      }
    } else {
      if (response.status === 403) {
        showMessage('whatsappMessageStatus', 'error', 'You do not have permission to send messages. Only admins can send messages.');
        // Do NOT close the chat interface or revert to placeholder
        return;
      }
      const error = await response.json()
      alert("Failed to send message: " + (error.error || response.status))
    }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    alert("Failed to send message: " + error.message)
  }
}
