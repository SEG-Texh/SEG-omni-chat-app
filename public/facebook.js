// Facebook page specific functionality
let socket = null
let currentFacebookConversationId = null
let currentFacebookRecipientId = null


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
    reconnectionDelay: 1000,
  })

  // Connection Events
  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id)
    joinFacebookRooms()
  })

  // Facebook Specific Events
  socket.on("new_message", (message) => {
    console.log("📨 New Facebook message:", message)
    if (currentFacebookConversationId === message.conversation) {
      appendFacebookMessage(message)
    }
    updateConversationList(message)
  })

  socket.on("disconnect", () => {
    console.log("🔌 Disconnected from socket")
  })

  socket.on("connect_error", (err) => {
    console.error("❌ Connection error:", err.message)
  })
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

      item.addEventListener("click", () => selectFacebookConversation(conversation, item))
      conversationsList.appendChild(item)
    })
  } catch (error) {
    console.error("Error loading Facebook conversations:", error)
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">Error loading conversations</div>'
  }
}

// Select Facebook conversation
function selectFacebookConversation(conversation, element) {
  currentFacebookConversationId = conversation._id

  // Find the Facebook participant
  const recipient = conversation.participants.find((p) => p._id !== currentUser.id && p._id !== currentUser._id)

  if (recipient) {
    currentFacebookRecipientId =
      recipient.facebookId ||
      (recipient.platformIds && recipient.platformIds.facebook) ||
      recipient.platformSenderId ||
      (conversation.platformConversationId && conversation.platformConversationId.split("_")[1])
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

        <!-- Messages -->
        <div id="facebookMessages" class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- Messages will be loaded here -->
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

// Send Facebook message
async function sendFacebookMessage() {
  const messageInput = document.getElementById("facebookMessageInput")
  const text = messageInput.value.trim()

  if (!text || !currentFacebookConversationId || !currentFacebookRecipientId) {
    return
  }

  try {
    const response = await apiRequest("/api/facebook/messages", {
      method: "POST",
      body: JSON.stringify({
        recipientId: currentFacebookRecipientId,
        text: text,
        conversationId: currentFacebookConversationId,
      }),
    })

    if (response.ok) {
      messageInput.value = ""
      // Reload messages
      loadFacebookMessages(currentFacebookConversationId)
    } else {
      const error = await response.json()
      alert("Failed to send message: " + (error.error || response.status))
    }
  } catch (error) {
    console.error("Error sending Facebook message:", error)
    alert("Failed to send message: " + error.message)
  }
}

// Append Facebook message (for real-time updates)
function appendFacebookMessage(message) {
  const messagesContainer = document.getElementById("facebookMessages")
  if (!messagesContainer) return

  const isFromCurrentUser = message.sender === currentUser._id
  const messageDiv = document.createElement("div")
  messageDiv.className = `flex ${isFromCurrentUser ? "justify-end" : "justify-start"} chat-message`

  messageDiv.innerHTML = `
        <div class="chat-bubble ${isFromCurrentUser ? "sent" : "received"}">
            ${message.content.text}
        </div>
    `

  messagesContainer.appendChild(messageDiv)
  messagesContainer.scrollTop = messagesContainer.scrollHeight
}

// Update conversation list (for real-time updates)
function updateConversationList(message) {
  console.log("Updating conversation list with new message:", message)
}

// Import or declare io and apiRequest here
// Example:
// io = require('socket.io-client');
// apiRequest = require('./apiRequest');
