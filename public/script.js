// Global variables
let currentUser = null;
let socket = null;
let currentFacebookConversationId = null;
let currentFacebookRecipientId = null;
let currentWhatsAppConversationId = null;
let currentWhatsAppNumber = null;

// DOM elements
const loginContainer = document.getElementById("loginContainer");
const appContainer = document.getElementById("appContainer");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginSpinner = document.getElementById("loginSpinner");
const loginText = document.getElementById("loginText");

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  // Check if user is already logged in
  const savedUser = localStorage.getItem("currentUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showApp();
  }

  // Add login form event listener
  loginForm.addEventListener("submit", handleLogin);

  // Initialize dashboard animations
  initializeDashboard();
});

// Handle login
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Show loading state
  loginSpinner.style.display = "inline-block";
  loginText.textContent = "Logging in...";
  loginError.textContent = "";

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Invalid credentials");
    }

    const data = await response.json();
    currentUser = { ...data.user, token: data.token };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));

    showApp();
  } catch (error) {
    loginError.textContent = error.message || "Login failed. Please try again.";
  } finally {
    // Reset loading state
    loginSpinner.style.display = "none";
    loginText.textContent = "Login";
  }
}

// Show the main application
function showApp() {
  loginContainer.style.display = "none";
  appContainer.style.display = "block";

  // Update user info in header
  document.getElementById("userName").textContent = currentUser.name;
  document.getElementById("userAvatar").textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById("userRole").textContent = currentUser.role;
  document.getElementById("userRole").className = `badge ${currentUser.role}`;

  // Initialize socket connection
  initializeSocket(currentUser.token);

  // Load initial tab data
  const initialTab = window.location.hash.replace('#', '') || 'dashboard';
  switchTab(initialTab, null, false);
}

// Handle logout
function logout() {
  localStorage.removeItem("currentUser");
  currentUser = null;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  loginContainer.style.display = "flex";
  appContainer.style.display = "none";

  // Reset form
  loginForm.reset();
  loginError.textContent = "";
}

// Switch between tabs
function switchTab(tabName, event, updateHash = true) {
  // Update URL hash
  if (updateHash) {
    window.location.hash = tabName;
  }

  // Remove active class from all tabs and buttons
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Add active class to selected tab and button
  const targetTab = document.getElementById(`${tabName}Tab`);
  if (targetTab) {
    targetTab.classList.add("active");
  }

  if (event && event.target) {
    event.target.classList.add("active");
  }

  // Load tab-specific data
  if (tabName === "dashboard") {
    loadDashboardData();
  } else if (tabName === "facebook") {
    loadFacebookConversations();
  } else if (tabName === "whatsapp") {
    loadWhatsAppConversations();
  } else if (tabName === "accounts") {
    loadAccountsData();
  }
}

// Initialize socket connection
function initializeSocket(token) {
  socket = io({
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
    joinFacebookRooms();
  });

  // Facebook events
  socket.on("facebook_new_message", (message) => {
    if (currentFacebookConversationId === message.conversationId) {
      appendFacebookMessage(message);
    }
    updateConversationList(message);
  });

  socket.on("facebook_conversation_update", (conversation) => {
    refreshConversationList();
  });

  socket.on("facebook_user_status", ({ userId, isOnline }) => {
    updateUserStatus(userId, isOnline);
  });

  // WhatsApp events
  socket.on("whatsapp_new_message", (message) => {
    if (currentWhatsAppConversationId === message.conversationId) {
      appendWhatsAppMessage(message);
    }
    updateWhatsAppConversationList(message);
  });

  // Error handling
  socket.on("connect_error", (err) => {
    console.error("❌ Connection error:", err.message);
    if (err.message.includes("invalid token")) {
      logout();
    }
  });
}

// Facebook-specific functions
function joinFacebookRooms() {
  socket.emit("join_facebook_rooms");
  if (currentUser?.facebookId) {
    socket.emit("join_user_facebook_rooms", currentUser.facebookId);
  }
}

async function loadFacebookConversations() {
  try {
    const response = await fetch('/api/facebook/conversations', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });

    if (!response.ok) throw new Error('Failed to load conversations');

    const conversations = await response.json();
    renderFacebookConversationList(conversations);
  } catch (error) {
    console.error("Error loading Facebook conversations:", error);
    document.getElementById("facebookChatList").innerHTML = `
      <div class="error-message">Failed to load conversations. Please try again.</div>
    `;
  }
}

function renderFacebookConversationList(conversations) {
  const chatList = document.getElementById("facebookChatList");
  chatList.innerHTML = "";

  if (!conversations || conversations.length === 0) {
    chatList.innerHTML = '<div class="empty-state">No conversations found</div>';
    return;
  }

  conversations.forEach(conv => {
    const participant = conv.participants.find(p => p._id !== currentUser._id) || {};
    const lastMessage = conv.lastMessage?.content?.text || "No messages yet";
    const lastMessageTime = conv.lastMessage?.createdAt ? formatTime(conv.lastMessage.createdAt) : "";

    const conversationItem = document.createElement("div");
    conversationItem.className = `chat-item ${currentFacebookConversationId === conv._id ? 'active' : ''}`;
    conversationItem.innerHTML = `
      <div class="chat-avatar">${participant.name?.charAt(0).toUpperCase() || '👤'}</div>
      <div class="chat-info">
        <div class="chat-name">${participant.name || 'Unknown User'}</div>
        <div class="chat-preview">${lastMessage}</div>
      </div>
      <div class="chat-time">${lastMessageTime}</div>
    `;
    conversationItem.addEventListener("click", () => loadFacebookMessages(conv._id));
    chatList.appendChild(conversationItem);
  });
}

async function loadFacebookMessages(conversationId) {
  try {
    currentFacebookConversationId = conversationId;
    
    // Highlight selected conversation
    document.querySelectorAll('#facebookChatList .chat-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`#facebookChatList .chat-item[data-id="${conversationId}"]`)?.classList.add('active');

    const response = await fetch(`/api/facebook/conversations/${conversationId}/messages`, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });

    if (!response.ok) throw new Error('Failed to load messages');

    const data = await response.json();
    renderFacebookMessages(data.messages, data.conversation);
  } catch (error) {
    console.error("Error loading Facebook messages:", error);
    document.getElementById("facebookChatMessages").innerHTML = `
      <div class="error-message">Failed to load messages. Please try again.</div>
    `;
  }
}

function renderFacebookMessages(messages, conversation) {
  const chatMessages = document.getElementById("facebookChatMessages");
  chatMessages.innerHTML = "";

  if (!messages || messages.length === 0) {
    chatMessages.innerHTML = '<div class="empty-state">No messages in this conversation</div>';
    return;
  }

  messages.forEach(message => {
    const isCurrentUser = message.sender._id === currentUser._id;
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${isCurrentUser ? 'from-me' : 'from-them'}`;
    messageDiv.innerHTML = `
      <div class="bubble">
        <strong>${isCurrentUser ? 'You' : message.sender.name}:</strong> ${message.content.text}
        <div class="message-time">${formatTime(message.createdAt)}</div>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
  });

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendFacebookMessage(message) {
  const chatMessages = document.getElementById("facebookChatMessages");
  const isCurrentUser = message.sender._id === currentUser._id;
  
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${isCurrentUser ? 'from-me' : 'from-them'}`;
  messageDiv.innerHTML = `
    <div class="bubble">
      <strong>${isCurrentUser ? 'You' : message.sender.name}:</strong> ${message.content.text}
      <div class="message-time">${formatTime(message.createdAt)}</div>
    </div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// WhatsApp-specific functions
async function loadWhatsAppConversations() {
  try {
    const response = await fetch('/api/whatsapp/conversations', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });

    if (!response.ok) throw new Error('Failed to load conversations');

    const conversations = await response.json();
    renderWhatsAppConversationList(conversations);
  } catch (error) {
    console.error("Error loading WhatsApp conversations:", error);
    document.getElementById("whatsappChatList").innerHTML = `
      <div class="error-message">Failed to load conversations. Please try again.</div>
    `;
  }
}

function renderWhatsAppConversationList(conversations) {
  const chatList = document.getElementById("whatsappChatList");
  chatList.innerHTML = "";

  if (!conversations || conversations.length === 0) {
    chatList.innerHTML = '<div class="empty-state">No conversations found</div>';
    return;
  }

  conversations.forEach(conv => {
    const participant = conv.participants.find(p => p._id !== currentUser._id) || {};
    const lastMessage = conv.lastMessage?.content?.text || "No messages yet";
    const lastMessageTime = conv.lastMessage?.createdAt ? formatTime(conv.lastMessage.createdAt) : "";

    const conversationItem = document.createElement("div");
    conversationItem.className = `chat-item ${currentWhatsAppConversationId === conv._id ? 'active' : ''}`;
    conversationItem.innerHTML = `
      <div class="chat-avatar">${participant.name?.charAt(0).toUpperCase() || '👤'}</div>
      <div class="chat-info">
        <div class="chat-name">${participant.name || participant.phoneNumber || 'Unknown User'}</div>
        <div class="chat-preview">${lastMessage}</div>
      </div>
      <div class="chat-time">${lastMessageTime}</div>
    `;
    conversationItem.addEventListener("click", () => loadWhatsAppMessages(conv._id));
    chatList.appendChild(conversationItem);
  });
}

async function loadWhatsAppMessages(conversationId) {
  try {
    currentWhatsAppConversationId = conversationId;
    
    // Highlight selected conversation
    document.querySelectorAll('#whatsappChatList .chat-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`#whatsappChatList .chat-item[data-id="${conversationId}"]`)?.classList.add('active');

    const response = await fetch(`/api/whatsapp/conversations/${conversationId}/messages`, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });

    if (!response.ok) throw new Error('Failed to load messages');

    const data = await response.json();
    renderWhatsAppMessages(data.messages, data.conversation);
  } catch (error) {
    console.error("Error loading WhatsApp messages:", error);
    document.getElementById("whatsappChatMessages").innerHTML = `
      <div class="error-message">Failed to load messages. Please try again.</div>
    `;
  }
}

function renderWhatsAppMessages(messages, conversation) {
  const chatMessages = document.getElementById("whatsappChatMessages");
  chatMessages.innerHTML = "";

  if (!messages || messages.length === 0) {
    chatMessages.innerHTML = '<div class="empty-state">No messages in this conversation</div>';
    return;
  }

  messages.forEach(message => {
    const isCurrentUser = message.sender._id === currentUser._id;
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${isCurrentUser ? 'from-me' : 'from-them'}`;
    messageDiv.innerHTML = `
      <div class="bubble">
        <strong>${isCurrentUser ? 'You' : message.sender.name || message.sender.phoneNumber}:</strong> ${message.content.text}
        <div class="message-time">${formatTime(message.createdAt)}</div>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
  });

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendWhatsAppMessage(message) {
  const chatMessages = document.getElementById("whatsappChatMessages");
  const isCurrentUser = message.sender._id === currentUser._id;
  
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${isCurrentUser ? 'from-me' : 'from-them'}`;
  messageDiv.innerHTML = `
    <div class="bubble">
      <strong>${isCurrentUser ? 'You' : message.sender.name || message.sender.phoneNumber}:</strong> ${message.content.text}
      <div class="message-time">${formatTime(message.createdAt)}</div>
    </div>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Dashboard functions
async function loadDashboardData() {
  try {
    // Fetch all dashboard data in parallel
    const [stats, messageVolume, platformDistribution, responseRateTrend] = await Promise.all([
      fetchDashboardStats(),
      fetchMessageVolume(),
      fetchPlatformDistribution(),
      fetchResponseRateTrend()
    ]);

    // Update stats cards
    updateStatCard('totalUsers', stats.totalUsers);
    updateStatCard('messagesToday', stats.messagesToday);
    updateStatCard('responseRate', `${stats.responseRate}%`);
    updateStatCard('activeChats', stats.activeChats);

    // Update charts
    updateBarChart(messageVolume);
    updatePieChart(platformDistribution);
    updateLineChart(responseRateTrend);

    // Set up periodic refresh
    setInterval(loadDashboardData, 30000);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  }
}

async function fetchDashboardStats() {
  const response = await fetch('/api/dashboard/stats', {
    headers: { 'Authorization': `Bearer ${currentUser.token}` }
  });
  if (!response.ok) throw new Error('Failed to load dashboard stats');
  return response.json();
}

async function fetchMessageVolume() {
  const response = await fetch('/api/dashboard/message-volume?days=7', {
    headers: { 'Authorization': `Bearer ${currentUser.token}` }
  });
  if (!response.ok) throw new Error('Failed to load message volume');
  return response.json();
}

async function fetchPlatformDistribution() {
  const response = await fetch('/api/dashboard/platform-distribution', {
    headers: { 'Authorization': `Bearer ${currentUser.token}` }
  });
  if (!response.ok) throw new Error('Failed to load platform distribution');
  return response.json();
}

async function fetchResponseRateTrend() {
  const response = await fetch('/api/dashboard/response-rate-trend', {
    headers: { 'Authorization': `Bearer ${currentUser.token}` }
  });
  if (!response.ok) throw new Error('Failed to load response rate trend');
  return response.json();
}

function updateStatCard(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function updateBarChart(data) {
  const container = document.getElementById('barChartContainer');
  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state">No data available</div>';
    return;
  }

  const maxValue = Math.max(...data.map(item => item.count));
  
  data.forEach(item => {
    const heightPercentage = (item.count / maxValue) * 100;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.setProperty('--height', `${heightPercentage}%`);
    bar.dataset.value = item.count;
    
    const label = document.createElement('span');
    label.className = 'bar-label';
    label.textContent = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' });
    
    bar.appendChild(label);
    container.appendChild(bar);
  });
}

function updatePieChart(data) {
  const container = document.getElementById('pieChartContainer');
  const legend = document.getElementById('pieLegend');
  container.innerHTML = '';
  legend.innerHTML = '';

  if (!data || Object.keys(data).length === 0) {
    container.innerHTML = '<div class="empty-state">No data available</div>';
    return;
  }

  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  let cumulativePercentage = 0;

  // Create pie slices using conic-gradient
  const gradientParts = Object.entries(data).map(([platform, count]) => {
    const percentage = (count / total) * 100;
    const start = cumulativePercentage;
    cumulativePercentage += percentage;
    const end = cumulativePercentage;
    
    // Add legend item
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
      <span class="legend-color ${platform}"></span>
      <span>${platform.charAt(0).toUpperCase() + platform.slice(1)} (${percentage.toFixed(1)}%)</span>
    `;
    legend.appendChild(legendItem);
    
    return `${getPlatformColor(platform)} ${start}% ${end}%`;
  }).join(', ');

  container.style.background = `conic-gradient(${gradientParts})`;
}

function getPlatformColor(platform) {
  switch (platform) {
    case 'facebook': return 'var(--facebook-color)';
    case 'whatsapp': return 'var(--whatsapp-color)';
    default: return 'var(--secondary-color)';
  }
}

function updateLineChart(data) {
  const svg = document.querySelector('.line-chart-svg');
  const labelsContainer = document.querySelector('.line-chart-labels');
  svg.innerHTML = '';
  labelsContainer.innerHTML = '';

  if (!data || data.length < 2) {
    svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#6b7280">Not enough data</text>';
    return;
  }

  // Set up SVG dimensions
  const width = 400;
  const height = 200;
  const padding = 20;

  // Calculate scales
  const xScale = (width - 2 * padding) / (data.length - 1);
  const maxY = Math.max(...data.map(item => item.responseRate));
  const yScale = (height - 2 * padding) / maxY;

  // Create path data
  let pathData = '';
  data.forEach((item, index) => {
    const x = padding + index * xScale;
    const y = height - padding - (item.responseRate * yScale);
    pathData += `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  });

  // Create area data (same as path but closes at bottom)
  let areaData = pathData + ` L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  // Add gradient definition
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradient.id = 'lineGradient';
  gradient.setAttribute('x1', '0%');
  gradient.setAttribute('y1', '0%');
  gradient.setAttribute('x2', '0%');
  gradient.setAttribute('y2', '100%');
  
  gradient.innerHTML = `
    <stop offset="0%" stop-color="var(--success-color)" stop-opacity="0.3"/>
    <stop offset="100%" stop-color="var(--success-color)" stop-opacity="0"/>
  `;
  defs.appendChild(gradient);
  svg.appendChild(defs);

  // Add area
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', areaData);
  area.setAttribute('fill', 'url(#lineGradient)');
  svg.appendChild(area);

  // Add line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', pathData);
  line.setAttribute('stroke', 'var(--success-color)');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('fill', 'none');
  svg.appendChild(line);

  // Add points
  data.forEach((item, index) => {
    const x = padding + index * xScale;
    const y = height - padding - (item.responseRate * yScale);
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', 'var(--success-color)');
    
    // Add tooltip
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${item.responseRate}%`;
    circle.appendChild(title);
    
    svg.appendChild(circle);
  });

  // Add labels
  data.forEach(item => {
    const label = document.createElement('span');
    label.textContent = new Date(item.date).toLocaleDateString('en-US', { month: 'short' });
    labelsContainer.appendChild(label);
  });
}

// Account management functions
async function loadAccountsData() {
  try {
    const [users, stats] = await Promise.all([
      fetchUsers(),
      fetchUserStats()
    ]);

    renderUserTable(users);
    updateUserStats(stats);
  } catch (error) {
    console.error("Error loading account data:", error);
  }
}

async function fetchUsers() {
  const response = await fetch('/api/users', {
    headers: { 'Authorization': `Bearer ${currentUser.token}` }
  });
  if (!response.ok) throw new Error('Failed to load users');
  return response.json();
}

async function fetchUserStats() {
  const response = await fetch('/api/users/stats', {
    headers: { 'Authorization': `Bearer ${currentUser.token}` }
  });
  if (!response.ok) throw new Error('Failed to load user stats');
  return response.json();
}

function renderUserTable(users) {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found</td></tr>';
    return;
  }

  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.username || '-'}</td>
      <td><span class="user-role-badge ${user.role}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></td>
      <td><span class="user-status ${user.status || 'active'}">${(user.status || 'active').charAt(0).toUpperCase() + (user.status || 'active').slice(1)}</span></td>
      <td class="user-actions">
        <button class="btn-edit" onclick="editUser('${user._id}')">Edit</button>
        <button class="btn-delete" onclick="confirmDeleteUser('${user._id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function updateUserStats(stats) {
  updateStatCard('statTotalUsers', stats.totalUsers);
  updateStatCard('statActiveUsers', stats.activeUsers);
  updateStatCard('statInactiveUsers', stats.inactiveUsers);
  updateStatCard('statAdmins', stats.admins);
  updateStatCard('statSupervisors', stats.supervisors);
  updateStatCard('statUsers', stats.users);
}

async function confirmDeleteUser(userId) {
  if (confirm('Are you sure you want to delete this user?')) {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });

      if (!response.ok) throw new Error('Failed to delete user');

      showMessage('successMessage', 'User deleted successfully');
      loadAccountsData(); // Refresh the list
    } catch (error) {
      showMessage('errorMessage', error.message || 'Failed to delete user');
    }
  }
}

function showMessage(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
    element.style.display = 'block';
    setTimeout(() => element.style.display = 'none', 3000);
  }
}

// Initialize dashboard animations
function initializeDashboard() {
  // Add hover effects to stat cards
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("mouseenter", () => card.style.transform = "translateY(-4px)");
    card.addEventListener("mouseleave", () => card.style.transform = "translateY(0)");
  });
}

// Utility functions
function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Event listeners for message sending
document.getElementById('facebookSendButton')?.addEventListener('click', sendFacebookMessage);
document.getElementById('whatsappSendButton')?.addEventListener('click', sendWhatsAppMessage);

async function sendFacebookMessage() {
  const input = document.getElementById('facebookMessageInput');
  const message = input.value.trim();
  
  if (!message || !currentFacebookConversationId) return;

  try {
    const response = await fetch('/api/facebook/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({
        conversationId: currentFacebookConversationId,
        text: message
      })
    });

    if (!response.ok) throw new Error('Failed to send message');

    input.value = '';
  } catch (error) {
    console.error("Error sending Facebook message:", error);
    showMessage('errorMessage', 'Failed to send message');
  }
}

async function sendWhatsAppMessage() {
  const input = document.getElementById('whatsappMessageInput');
  const message = input.value.trim();
  
  if (!message || !currentWhatsAppConversationId) return;

  try {
    const response = await fetch('/api/whatsapp/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({
        conversationId: currentWhatsAppConversationId,
        text: message
      })
    });

    if (!response.ok) throw new Error('Failed to send message');

    input.value = '';
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    showMessage('errorMessage', 'Failed to send message');
  }
}

// Make functions available globally
window.switchTab = switchTab;
window.logout = logout;
window.editUser = editUser;
window.confirmDeleteUser = confirmDeleteUser;

// Helper function for editing users (placeholder)
function editUser(userId) {
  alert(`Edit user ${userId} functionality coming soon!`);
}