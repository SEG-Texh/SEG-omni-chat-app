// Global variables
// let currentUser = null
let socket = null
let currentFacebookConversationId = null
let currentFacebookRecipientId = null
let currentWhatsAppConversationId = null
let currentWhatsAppNumber = null

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  // Check if user is already logged in
  const savedUser = localStorage.getItem("currentUser")
  if (savedUser) {
    currentUser = JSON.parse(savedUser)
    currentUser._id = currentUser.id
    showApp()
  }

  // Add event listeners
  setupEventListeners()

  // Initialize dashboard animations
  initializeDashboard()
})

// Setup event listeners
function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById("loginForm")
  if (loginForm) loginForm.addEventListener("submit", handleLogin)

  // Logout button
  const logoutButton = document.getElementById("logoutButton")
  if (logoutButton) logoutButton.addEventListener("click", logout)

  // Tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tabName = e.currentTarget.getAttribute("data-tab")
      switchTab(tabName, e)
    })
  })

  // Add user form
  const addUserForm = document.getElementById("addUserForm")
  if (addUserForm) addUserForm.addEventListener("submit", handleAddUser)
}

// Handle login
async function handleLogin(e) {
  e.preventDefault()

  const email = document.getElementById("email").value
  const password = document.getElementById("password").value

  // Show loading state
  const loginButton = document.getElementById("loginButton")
  const loginText = document.getElementById("loginText")
  const loginSpinner = document.getElementById("loginSpinner")
  const loginError = document.getElementById("loginError")

  loginButton.disabled = true
  loginText.textContent = "Logging in..."
  loginSpinner.classList.remove("hidden")
  loginError.classList.add("hidden")

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      throw new Error("Invalid credentials")
    }

    const data = await response.json()
    currentUser = { ...data.user, token: data.token, _id: data.user.id }

    // Save to localStorage
    localStorage.setItem("currentUser", JSON.stringify(currentUser))

    showApp()
  } catch (error) {
    loginError.textContent = error.message || "Login failed. Please try again."
    loginError.classList.remove("hidden")
  } finally {
    // Reset loading state
    loginButton.disabled = false
    loginText.textContent = "Login"
    loginSpinner.classList.add("hidden")
  }
}

// Show the main application
function showApp() {
  const loginContainer = document.getElementById("loginContainer")
  const appContainer = document.getElementById("appContainer")
  if (loginContainer) loginContainer.classList.add("hidden")
  if (appContainer) appContainer.classList.remove("hidden")

  // Update user info in header
  if (document.getElementById("userName")) document.getElementById("userName").textContent = currentUser.name
  if (document.getElementById("userAvatar")) document.getElementById("userAvatar").textContent = currentUser.name?.[0] || "U"
  if (document.getElementById("userRole")) document.getElementById("userRole").textContent = currentUser.role

  // Initialize socket connection
  initializeSocket(currentUser.token)

  // Load dashboard data
  loadDashboardData()
}

// Handle logout
function logout() {
  localStorage.removeItem("currentUser")
  currentUser = null

  if (socket) {
    socket.disconnect()
    socket = null
  }

  const loginContainer = document.getElementById("loginContainer")
  const appContainer = document.getElementById("appContainer")
  if (loginContainer) loginContainer.classList.remove("hidden")
  if (appContainer) appContainer.classList.add("hidden")

  // Reset form
  if (document.getElementById("loginForm")) document.getElementById("loginForm").reset()
  if (document.getElementById("loginError")) document.getElementById("loginError").classList.add("hidden")
}

// Switch tabs
function switchTab(tabName, event) {
  // Remove active class from all tabs and buttons
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active")
  })
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active")
  })

  // Add active class to selected tab and button
  const targetTab = document.getElementById(tabName + "Tab")
  if (targetTab) {
    targetTab.classList.add("active")
  }

  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active")
  }

  // Load tab-specific data
  switch (tabName) {
    case "dashboard":
      loadDashboardData()
      break
    case "facebook":
      loadFacebookConversations()
      break
    case "whatsapp":
      loadWhatsAppConversations()
      break
    case "accounts":
      loadAccountsData()
      break
  }
}

// Initialize socket connection
function initializeSocket(token) {
  socket = io("https://chat-app-omni-33e1e5eaa993.herokuapp.com", {
    auth: { token: token },
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

// Facebook-specific functions
function joinFacebookRooms() {
  if (socket) {
    socket.emit("joinFacebookRoom")
    if (currentUser?.facebookId) {
      socket.emit("joinUserFacebookRooms", currentUser.facebookId)
    }
  }
}

// Load dashboard data
async function loadDashboardData() {
  if (!currentUser?.token) return

  try {
    // Load stats
    const [totalUsersRes, messagesTodayRes, responseRateRes, activeChatsRes] = await Promise.all([
      fetch("/api/dashboard/users/count", {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      }),
      fetch("/api/dashboard/count?startDate=" + new Date().toISOString().split("T")[0], {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      }),
      fetch("/api/dashboard/response-rate", {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      }),
      fetch("/api/dashboard/active-chats", {
        headers: { Authorization: `Bearer ${currentUser.token}` },
      }),
    ])

    const totalUsers = await totalUsersRes.json()
    const messagesToday = await messagesTodayRes.json()
    const responseRate = await responseRateRes.json()
    const activeChats = await activeChatsRes.json()

    // Update stats
    if (document.getElementById("totalUsers")) document.getElementById("totalUsers").textContent = totalUsers.count || 0
    if (document.getElementById("messagesToday")) document.getElementById("messagesToday").textContent = messagesToday.count || 0
    if (document.getElementById("responseRate")) document.getElementById("responseRate").textContent = (responseRate.responseRate || 0) + "%"
    if (document.getElementById("activeChats")) document.getElementById("activeChats").textContent = activeChats.activeChats || 0

    // Update bar chart
    updateBarChart()
  } catch (error) {
    console.error("Error loading dashboard data:", error)
  }
}

// Update bar chart
function updateBarChart() {
  const barChart = document.getElementById("barChart")
  if (!barChart) return
  const heights = [40, 65, 30, 80, 45, 70, 55]
  barChart.innerHTML = ""
  heights.forEach((height, index) => {
    const bar = document.createElement("div")
    bar.className = "flex-1 bg-indigo-500 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
    bar.style.height = `${height}%`
    barChart.appendChild(bar)
  })
}

// Load Facebook conversations
async function loadFacebookConversations() {
  if (!currentUser?.token) return

  const conversationsList = document.getElementById("facebookConversationsList")

  try {
    const response = await fetch("/api/facebook/conversations", {
      headers: { Authorization: `Bearer ${currentUser.token}` },
    })

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

      item.addEventListener("click", () => selectFacebookConversation(conversation))
      conversationsList.appendChild(item)
    })
  } catch (error) {
    console.error("Error loading Facebook conversations:", error)
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">Error loading conversations</div>'
  }
}

// Select Facebook conversation
function selectFacebookConversation(conversation) {
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
  event.currentTarget.classList.add("active")

  // Load messages and show chat interface
  loadFacebookMessages(conversation._id)
  showFacebookChatInterface(conversation)
}

// Load Facebook messages
async function loadFacebookMessages(conversationId) {
  if (!currentUser?.token) return

  try {
    const response = await fetch(`/api/facebook/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${currentUser.token}` },
    })

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
    const response = await fetch("/api/facebook/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`,
      },
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

// Load WhatsApp conversations
async function loadWhatsAppConversations() {
  if (!currentUser?.token) return

  const conversationsList = document.getElementById("whatsappConversationsList")

  try {
    const response = await fetch("/api/conversation?platform=whatsapp", {
      headers: { Authorization: `Bearer ${currentUser.token}` },
    })

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

      item.addEventListener("click", () => selectWhatsAppConversation(conversation))
      conversationsList.appendChild(item)
    })
  } catch (error) {
    console.error("Error loading WhatsApp conversations:", error)
    conversationsList.innerHTML = '<div class="p-4 text-center text-slate-500">Error loading conversations</div>'
  }
}

// Select WhatsApp conversation
function selectWhatsAppConversation(conversation) {
  currentWhatsAppConversationId = conversation._id
  currentWhatsAppNumber = conversation.participants?.[0]?.platformIds?.whatsapp || conversation.platformConversationId

  // Update active conversation styling
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.remove("active")
  })
  event.currentTarget.classList.add("active")

  // Load messages and show chat interface
  loadWhatsAppMessages(conversation._id)
  showWhatsAppChatInterface(conversation)
}

// Load WhatsApp messages
async function loadWhatsAppMessages(conversationId) {
  if (!currentUser?.token) return

  try {
    const response = await fetch(`/api/conversation/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${currentUser.token}` },
    })

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
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`,
      },
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

// Load accounts data
async function loadAccountsData() {
  if (!currentUser?.token) return

  try {
    await Promise.all([loadUserStatistics(), loadUsersTable()])
  } catch (error) {
    console.error("Error loading accounts data:", error)
  }
}

// Load user statistics
async function loadUserStatistics() {
  if (!currentUser?.token) return

  try {
    const response = await fetch("/api/users/stats", {
      headers: { Authorization: `Bearer ${currentUser.token}` },
    })

    if (!response.ok) {
      throw new Error("Failed to load user statistics")
    }

    const stats = await response.json()

    // Update statistics
    document.getElementById("statTotalUsers").textContent = stats.totalUsers || 0
    document.getElementById("statActiveUsers").textContent = stats.activeUsers || 0
    document.getElementById("statInactiveUsers").textContent = stats.inactiveUsers || 0
    document.getElementById("statAdmins").textContent = stats.admins || 0
    document.getElementById("statSupervisors").textContent = stats.supervisors || 0
    document.getElementById("statUsers").textContent = stats.users || 0
  } catch (error) {
    console.error("Error loading user statistics:", error)
  }
}

// Load users table
async function loadUsersTable() {
  if (!currentUser?.token) return

  const tbody = document.getElementById("usersTableBody")

  try {
    const response = await fetch("/api/users", {
      headers: { Authorization: `Bearer ${currentUser.token}` },
    })

    if (!response.ok) {
      throw new Error("Failed to load users")
    }

    const users = await response.json()

    tbody.innerHTML = ""

    if (users.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-slate-500">No users found</td>
                </tr>
            `
      return
    }

    users.forEach((user) => {
      const row = document.createElement("tr")
      row.className = "hover:bg-slate-50"
      row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">${user.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${user.email}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${user.username || "--"}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="role-badge ${user.role}">${user.role}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge ${user.status || "active"}">${user.status || "active"}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button class="btn-edit" onclick="editUser('${user._id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteUser('${user._id}')">Delete</button>
                </td>
            `
      tbody.appendChild(row)
    })
  } catch (error) {
    console.error("Error loading users table:", error)
    tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-slate-500">Error loading users</td>
            </tr>
        `
  }
}

// Handle add user form submission
async function handleAddUser(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const userData = {
    name: formData.get("fullName") || document.getElementById("fullName").value,
    email: formData.get("userEmail") || document.getElementById("userEmail").value,
    username: formData.get("username") || document.getElementById("username").value,
    password: formData.get("userPassword") || document.getElementById("userPassword").value,
    role: formData.get("role"),
    status: "active",
  }

  // Validation
  if (!userData.name || !userData.email || !userData.username || !userData.password || !userData.role) {
    showAccountMessage("error", "Please fill in all required fields and select a role.")
    return
  }

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.token}`,
      },
      body: JSON.stringify(userData),
    })

    if (response.ok) {
      showAccountMessage("success", "User added successfully!")
      document.getElementById("addUserForm").reset()
      loadAccountsData() // Reload data
    } else {
      const error = await response.json()
      showAccountMessage("error", error.message || "Failed to add user")
    }
  } catch (error) {
    showAccountMessage("error", "Failed to add user: " + error.message)
  }
}

// Show account message
function showAccountMessage(type, text) {
  const messageElement = document.getElementById("accountMessage")

  messageElement.className = `p-4 rounded-lg mb-6 ${
    type === "success"
      ? "bg-green-50 text-green-700 border border-green-200"
      : "bg-red-50 text-red-700 border border-red-200"
  }`

  messageElement.textContent = text
  messageElement.classList.remove("hidden")

  // Auto hide after 3 seconds
  setTimeout(() => {
    messageElement.classList.add("hidden")
  }, 3000)
}

// Edit user function
function editUser(userId) {
  alert("Edit user functionality coming soon!")
}

// Delete user function
async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) {
    return
  }

  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${currentUser.token}` },
    })

    if (response.ok) {
      showAccountMessage("success", "User deleted successfully!")
      loadAccountsData() // Reload data
    } else {
      const error = await response.json()
      showAccountMessage("error", error.message || "Failed to delete user")
    }
  } catch (error) {
    showAccountMessage("error", "Failed to delete user: " + error.message)
  }
}

// Initialize dashboard animations
function initializeDashboard() {
  // Add hover effects to stat cards
  document.querySelectorAll(".hover-lift").forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-4px)"
      this.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.1)"
    })

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)"
      this.style.boxShadow = ""
    })
  })
}

// Utility functions
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatNumber(num) {
  return num.toLocaleString()
}

function formatPercentage(num) {
  return `${num.toFixed(1)}%`
}

// Append Facebook message (for real-time updates)
function appendFacebookMessage(message) {
  const messagesContainer = document.getElementById("facebookMessages")
  if (!messagesContainer) return

  const isFromCurrentUser = message.sender?._id === currentUser._id || message.sender?._id === currentUser.id
  const messageDiv = document.createElement("div")
  messageDiv.className = `flex ${isFromCurrentUser ? "justify-end" : "justify-start"}`
  messageDiv.innerHTML = `
    <div class="chat-bubble ${isFromCurrentUser ? "sent" : "received"}">
      ${message.content?.text || message.text || "No content"}
    </div>
  `
  messagesContainer.appendChild(messageDiv)
  messagesContainer.scrollTop = messagesContainer.scrollHeight
}

// Update conversation list (for real-time updates)
function updateConversationList(message) {
  // This would update the conversation list with new message preview
  // Implementation depends on your specific UI structure
  console.log("Updating conversation list with new message:", message)
}

// Export functions for global access (if needed)
window.switchTab = switchTab
window.logout = logout
window.editUser = editUser
window.deleteUser = deleteUser
