// WhatsApp page specific functionality
let currentWhatsAppConversationId = null
let currentWhatsAppNumber = null
let currentUser = null // Declare currentUser variable

document.addEventListener("DOMContentLoaded", () => {
  loadWhatsAppConversations()
})

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
      item.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                        📱
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
    const response = await apiRequest(`/api/conversation/${conversationId}/messages`)
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
        <div id="whatsappMessages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-green-50">
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
function displayWhatsAppMessages(messages) {
  const messagesContainer = document.getElementById("whatsappMessages")
  if (!messagesContainer) return

  messagesContainer.innerHTML = ""

  messages.forEach((message) => {
    const isFromCurrentUser = message.sender?._id === currentUser._id || message.sender?._id === currentUser.id
    const messageDiv = document.createElement("div")
    messageDiv.className = `flex ${isFromCurrentUser ? "justify-end" : "justify-start"}`

    messageDiv.innerHTML = `
            <div class="chat-bubble whatsapp ${isFromCurrentUser ? "sent" : "received"}">
                ${message.content?.text || message.text || "No content"}
            </div>
        `

    messagesContainer.appendChild(messageDiv)
  })

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight
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

// Example declarations for currentUser
// These should be replaced with actual imports or declarations
currentUser = {
  token: "your_token_here",
  _id: "your_user_id_here",
  id: "your_user_id_here",
}
