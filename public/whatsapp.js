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
  // Example implementation: show the chat UI for the selected conversation
  document.getElementById('whatsappChatContainer').style.display = 'block';
  // You might want to update UI elements with conversation details here
}
document.addEventListener("DOMContentLoaded", () => {
  connectWhatsAppSocket();
  loadWhatsAppConversations();
  // Listen for real-time new messages
  if (whatsappSocket) {
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
        // Optionally load the conversation UI for this session
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
async function loadWhatsAppConversations() {
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
    })
  } catch (error) {
    console.error("Error loading WhatsApp conversations:", error)
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">Error loading conversations</div>'
  }
}

// Select WhatsApp conversation
function selectWhatsAppConversation(conversation, element) {
  currentWhatsAppConversationId = conversation._id
  currentWhatsAppNumber = conversation.participants?.[0]?.platformIds?.whatsapp || conversation.platformConversationId

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
  element.classList.add("active")

  // Load messages and show chat interface
  loadWhatsAppMessages(conversation._id)
  showWhatsAppChatInterface(conversation)
}

// Load WhatsApp messages
async function loadWhatsAppMessages(conversationId) {
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
  const messagesContainer = document.getElementById("whatsappMessagesContainer");
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
  const messageInput = document.getElementById("whatsappMessageInput")
  if (!messageInput) return;
  const text = messageInput.value.trim()

  if (!text || !currentWhatsAppConversationId) {
    return
  }

  try {
    const response = await apiRequest("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: currentWhatsAppConversationId,
        content: { text: text },
        platform: "whatsapp",
        to: currentWhatsAppNumber,
      }),
    })

    if (response.ok) {
      messageInput.value = ""
      // Reload messages
      loadWhatsAppMessages(currentWhatsAppConversationId)
    } else {
      const error = await response.json()
      alert("Failed to send message: " + (error.error || response.status))
    }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    alert("Failed to send message: " + error.message)
  }
}
