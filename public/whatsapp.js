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

document.addEventListener("DOMContentLoaded", () => {
  connectWhatsAppSocket();
  loadWhatsAppConversations();
  // Listen for real-time new messages
  if (whatsappSocket) {
    whatsappSocket.on('new_message', (message) => {
      // If message is for the active conversation, update chat instantly
      if (message.conversation === currentWhatsAppConversationId) {
        displayWhatsAppMessages([message], true); // true = append single message
        // Optionally scroll chat to bottom
        const messagesContainer = document.getElementById('whatsappMessagesContainer');
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
                    <span class="unread-badge" style="display:${unreadConversations.has(conversation._id) ? 'inline-block' : 'none'};background:red;color:white;border-radius:50%;padding:2px 6px;font-size:10px;margin-left:5px;">●</span>
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

// Show WhatsApp chat interface
function showWhatsAppChatInterface(conversation) {
  const chatArea = document.getElementById("whatsappChatArea")
  const participant = conversation.participants[0]

  chatArea.innerHTML = `
        <!-- Chat Header -->
        <div class="p-4 border-b border-slate-200 bg-slate-50">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                    📱
                </div>
                <div>
                    <div class="font-medium">${participant?.name || "Unknown User"}</div>
                    <div class="text-sm text-green-500">Online</div>
                </div>
            </div>
        </div>

        <!-- Messages -->
        <div id="whatsappMessagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4 bg-green-50">
            <!-- Messages will be loaded here -->
        </div>

        <!-- Message Input -->
        <div class="p-4 border-t border-slate-200 bg-white">
            <div class="flex gap-3">
                <input
                    type="text"
                    id="whatsappMessageInput"
                    placeholder="Type a message..."
                    class="flex-1 px-4 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <button
                    id="whatsappSendButton"
                    class="px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                >
                    Send
                </button>
            </div>
        </div>
    `

  // Add event listeners for message input
  const messageInput = document.getElementById("whatsappMessageInput")
  const sendButton = document.getElementById("whatsappSendButton")

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendWhatsAppMessage()
    }
  })

  sendButton.addEventListener("click", sendWhatsAppMessage)
}

// Display WhatsApp messages
function displayWhatsAppMessages(messages = []) {
  const chatArea = document.getElementById("whatsappChatArea");
  if (!chatArea) return;

  // Sort messages by createdAt ascending (oldest first)
  const filteredMessages = messages
    .filter(msg =>
      (typeof msg.content?.text === 'string' && msg.content.text.trim() !== '') ||
      (msg.text && msg.text.trim() !== '')
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  chatArea.innerHTML = `
    <div class="messages-container" id="messagesContainer">
      ${filteredMessages.map(msg => {
        const isMine = msg.direction === "outbound" || msg.sender?._id === currentUser._id || msg.sender?._id === currentUser.id;
        const date = msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false
        }) : '';
        return `
          <div class="chat-bubble ${isMine ? 'sent' : 'received'}">
            <div class="bubble-content">${
              typeof msg.content?.text === 'string'
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

  // Attach send handlers
  document.getElementById('sendButton').addEventListener('click', sendWhatsAppMessage);
  document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendWhatsAppMessage();
  });

  // Scroll to bottom
  const container = document.getElementById('messagesContainer');
  if (container) container.scrollTop = container.scrollHeight;
}

// Send WhatsApp message
async function sendWhatsAppMessage() {
  const messageInput = document.getElementById("whatsappMessageInput")
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
