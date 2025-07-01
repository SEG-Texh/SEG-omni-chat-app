// Facebook page specific functionality
let socket = null
// let currentFacebookConversationId = null // Removed duplicate declaration
let currentFacebookRecipientId = null
let facebookConversations = []
let openFacebookConversationId = null // Track the currently open conversation


document.addEventListener("DOMContentLoaded", () => {
  initializeSocket()
  loadFacebookConversations()
})

// Initialize socket connection
function initializeSocket() {
  if (!currentUser?.token) return

  socket = io("https://chat-app-omni-33e1e5eaa993.herokuapp.com", {
    auth: { token: currentUser.token },
    transports: ["websocket"],
    reconnectionAttempts: 5,
    reconnectionDelay: 100,
  })

  // Connection Events
  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id)
    joinFacebookRooms()
  })
  socket.on('message_notification', (data) => {
    if (data.conversationId !== currentFacebookConversationId) {
      showNewMessageNotification(data.message);
    }
  });

  // Facebook Specific Events
  socket.on("new_message", (message) => {
    updateConversationList(message)
    if (openFacebookConversationId === message.conversation) {
      appendFacebookMessage(message)
      console.log("Appended message to open chat")
    } else {
      highlightConversationInList(message.conversation)
      console.log("Message for another conversation")
    }
  })

  socket.on("disconnect", () => {
    console.log("🔌 Disconnected from socket")
  })

  socket.on("connect_error", (err) => {
    console.error("❌ Connection error:", err.message)
  })

  socket.on('joinFacebookConversationRoom', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`Socket ${socket.id} joined room conversation_${conversationId}`);
  });
}

// Join Facebook rooms
function joinFacebookRooms() {
  if (socket) {
    socket.emit("joinFacebookRoom")
    if (currentUser?.facebookId) {
      socket.emit("joinUserFacebookRooms", currentUser.facebookId)
    }
  }
}

// Load Facebook conversations
async function loadFacebookConversations() {
  if (!currentUser?.token) return

  const conversationsList = document.getElementById("facebookConversationsList")

  try {
    const response = await apiRequest("/api/facebook/conversations")
    facebookConversations = await response.json()

    renderFacebookConversations()
  } catch (error) {
    console.error("Error loading Facebook conversations:", error)
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">Error loading conversations</div>'
  }
}

function renderFacebookConversations() {
  const conversationsList = document.getElementById("facebookConversationsList")
  conversationsList.innerHTML = ""
  if (facebookConversations.length === 0) {
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">No conversations found</div>'
    return
  }
  facebookConversations.forEach((conversation) => {
    const participant = conversation.participants[0]
    const item = document.createElement("div")
    item.className = "conversation-item"
    item.setAttribute('data-conversation-id', conversation._id)
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
          👤
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-slate-900 truncate">
            ${participant?.name || "Unknown User"}
          </div>
          <div class="text-sm text-slate-500 truncate">
            ${conversation.lastMessage || "No messages yet"}
          </div>
        </div>
        <div class="text-xs text-slate-400">
          ${new Date(conversation.updatedAt).toLocaleDateString()}
        </div>
      </div>
    `
    item.addEventListener("click", () => {
      selectFacebookConversation(conversation, item)
      removeHighlightFromConversation(conversation._id)
    })
    conversationsList.appendChild(item)
  })
}

// Select Facebook conversation
function selectFacebookConversation(conversation, element) {
  currentFacebookConversationId = conversation._id
  openFacebookConversationId = conversation._id // Set the open conversation

  // Find the Facebook participant
  const recipient = conversation.participants.find((p) => p._id !== currentUser.id && p._id !== currentUser._id)

  if (recipient) {
    currentFacebookRecipientId =
      recipient.facebookId ||
      (recipient.platformIds && recipient.platformIds.facebook) ||
      recipient.platformSenderId ||
      (conversation.platformConversationId && conversation.platformConversationId.split("_")[1])
  }

  // Join the conversation room for real-time updates
  if (socket && currentFacebookConversationId) {
    socket.emit("joinFacebookConversationRoom", currentFacebookConversationId)
  }

  // Update active conversation styling
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.remove("active")
  })
  element.classList.add("active")

  // Load messages and show chat interface
  loadFacebookMessages(conversation._id)
  showFacebookChatInterface(conversation)
}

// Load Facebook messages
async function loadFacebookMessages(conversationId) {
  if (!currentUser?.token) return

  try {
    const response = await apiRequest(`/api/facebook/conversations/${conversationId}/messages`)
    const messages = await response.json()
    displayFacebookMessages(messages)
  } catch (error) {
    console.error("Error loading Facebook messages:", error)
  }
}

// Show Facebook chat interface
function showFacebookChatInterface(conversation) {
  const chatArea = document.getElementById("facebookChatArea")
  const participant = conversation.participants[0]

  chatArea.innerHTML = `
        <!-- Chat Header -->
        <div class="p-4 border-b border-slate-200 bg-slate-50">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                    👤
                </div>
                <div>
                    <div class="font-medium">${participant?.name || "Unknown User"}</div>
                    <div class="text-sm text-green-500">Online</div>
                </div>
            </div>
        </div>

<!-- Messages Container -->
<div class="flex-1 overflow-hidden flex flex-col">
  <div id="facebookMessages" class="flex-1 overflow-y-auto p-4 space-y-4"></div>
</div>

        <!-- Message Input -->
        <div class="p-4 border-t border-slate-200">
            <div class="flex gap-3">
                <input
                    type="text"
                    id="facebookMessageInput"
                    placeholder="Type a message..."
                    class="flex-1 px-4 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                    id="facebookSendButton"
                    class="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                    Send
                </button>
            </div>
        </div>
    `

  // Add event listeners for message input
  const messageInput = document.getElementById("facebookMessageInput")
  const sendButton = document.getElementById("facebookSendButton")

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendFacebookMessage()
    }
  })

  sendButton.addEventListener("click", sendFacebookMessage)
}

// Display Facebook messages
function displayFacebookMessages(messages) {
  const messagesContainer = document.getElementById("facebookMessages")
  if (!messagesContainer) return

  messagesContainer.innerHTML = ""

  messages.forEach((message) => {
    const isFromCurrentUser = message.sender?._id === currentUser._id || message.sender?._id === currentUser.id
    const messageDiv = document.createElement("div")
    messageDiv.className = `flex ${isFromCurrentUser ? "justify-end" : "justify-start"}`
    messageDiv.innerHTML = `
      <div class="chat-bubble ${isFromCurrentUser ? "sent" : "received"}">
        ${message.content?.text || message.text || "No content"}
      </div>
    `
    messagesContainer.appendChild(messageDiv)
  })

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight
}

function highlightConversationInList(conversationId) {
  const item = document.querySelector(`[data-conversation-id='${conversationId}']`);
  if (item) {
    item.classList.add('has-new-message');
    // Optionally, add a badge element
    let badge = item.querySelector('.new-message-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'new-message-badge';
      badge.textContent = '●';
      badge.style.color = '#e11d48';
      badge.style.marginLeft = '8px';
      item.querySelector('.flex-1').appendChild(badge);
    }
  }
}

function removeHighlightFromConversation(conversationId) {
  const item = document.querySelector(`[data-conversation-id='${conversationId}']`);
  if (item) {
    item.classList.remove('has-new-message');
    const badge = item.querySelector('.new-message-badge');
    if (badge) badge.remove();
  }
}