// Shared variables and functions across all pages
let currentUser = null

// Check authentication on page load
document.addEventListener("DOMContentLoaded", () => {
  checkAuthentication()
  setupSharedEventListeners()
})

// Check if user is authenticated
function checkAuthentication() {
  const savedUser = localStorage.getItem("currentUser")

  if (!savedUser) {
    // Redirect to login if not authenticated
    if (window.location.pathname !== "/login.html" && !window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html"
      return
    }
  } else {
    currentUser = JSON.parse(savedUser)
    currentUser._id = currentUser.id
    updateUserInfo()

    // Redirect to dashboard if on login page and authenticated
    if (window.location.pathname.endsWith("login.html")) {
      window.location.href = "dashboard.html"
      return
    }
  }
}

// Update user info in header
function updateUserInfo() {
  if (!currentUser) return

  const userNameEl = document.getElementById("userName")
  const userAvatarEl = document.getElementById("userAvatar")
  const userRoleEl = document.getElementById("userRole")

  if (userNameEl) userNameEl.textContent = currentUser.name
  if (userAvatarEl) userAvatarEl.textContent = currentUser.name?.[0] || "U"
  if (userRoleEl) userRoleEl.textContent = currentUser.role
}

// Setup shared event listeners
function setupSharedEventListeners() {
  // Logout button
  const logoutButton = document.getElementById("logoutButton")
  if (logoutButton) {
    logoutButton.addEventListener("click", logout)
  }
}

// Logout function
function logout() {
  localStorage.removeItem("currentUser");
  currentUser = null;
  window.location.href = "login.html";
}

// API helper function
async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(currentUser?.token && { Authorization: `Bearer ${currentUser.token}` }),
    },
  }

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  }

  console.log('API Request:', url);
  console.log('Request headers:', mergedOptions.headers);
  console.log('Current user:', currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : 'null');

  try {
    const response = await fetch(url, mergedOptions)

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.status === 401) {
      alert('Session expired or unauthorized. Please log in again.');
      // Optionally, only logout if on a protected page
      logout();
      return null;
    }

    return response
  } catch (error) {
    console.error("API request failed:", error)
    throw error
  }
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

// Global escalation notification (top right corner)
function showEscalationNotification({ conversationId, customerId, platform, message, onAccept, onDecline }) {
  console.log('[showEscalationNotification] Called with:', { conversationId, customerId, platform, message });
  
  let container = document.getElementById('escalationNotificationContainer');
  if (!container) {
    console.log('[showEscalationNotification] Creating notification container');
    container = document.createElement('div');
    container.id = 'escalationNotificationContainer';
    container.style.position = 'fixed';
    container.style.top = '24px';
    container.style.right = '24px';
    container.style.zIndex = 9999;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    document.body.appendChild(container);
  }

  // Remove any existing notification for this conversation
  const existing = document.getElementById('escalationNotification_' + conversationId);
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'escalationNotification_' + conversationId;
  notif.style.background = '#fff';
  notif.style.border = '1px solid #6366f1';
  notif.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
  notif.style.borderRadius = '12px';
  notif.style.padding = '20px 24px';
  notif.style.minWidth = '320px';
  notif.style.maxWidth = '380px';
  notif.style.fontFamily = 'inherit';
  notif.innerHTML = `
    <div style="font-weight:600;font-size:1.1rem;color:#3730a3;margin-bottom:4px;">Live Chat Escalation</div>
    <div style="margin-bottom:12px;color:#334155;">A customer <b>wants to chat with a live agent</b>.<br><span style='font-size:0.95em;color:#6366f1;'>Platform: ${platform}</span></div>
    <div style="margin-bottom:10px;font-size:0.97em;color:#64748b;">Message: <span style='color:#0f172a;'>${message}</span></div>
    <div style="display:flex;gap:12px;justify-content:flex-end;">
      <button id="acceptEscalationBtn_${conversationId}" style="background:#6366f1;color:#fff;border:none;padding:7px 18px;border-radius:8px;font-weight:500;cursor:pointer;">Accept</button>
      <button id="declineEscalationBtn_${conversationId}" style="background:#e0e7ff;color:#3730a3;border:none;padding:7px 18px;border-radius:8px;font-weight:500;cursor:pointer;">Decline</button>
    </div>
  `;
  container.appendChild(notif);
  console.log('[showEscalationNotification] Notification created and added to DOM');

  document.getElementById('acceptEscalationBtn_' + conversationId).onclick = function() {
    console.log('[showEscalationNotification] Accept button clicked');
    if (onAccept) onAccept();
    notif.remove();
  };
  document.getElementById('declineEscalationBtn_' + conversationId).onclick = function() {
    console.log('[showEscalationNotification] Decline button clicked');
    if (onDecline) onDecline();
    notif.remove();
  };
}
window.showEscalationNotification = showEscalationNotification;

// Show message function
function showMessage(elementId, type, text, duration = 3000) {
  const messageElement = document.getElementById(elementId)
  if (!messageElement) return

  messageElement.className = `p-4 rounded-lg mb-6 ${
    type === "success"
      ? "bg-green-50 text-green-700 border border-green-200"
      : "bg-red-50 text-red-700 border border-red-200"
  }`

  messageElement.textContent = text
  messageElement.classList.remove("hidden")

  if (duration > 0) {
    setTimeout(() => {
      messageElement.classList.add("hidden")
    }, duration)
  }
}

let globalSocket = null;

function isAgentOrSupervisor() {
  return currentUser && (currentUser.role === 'agent' || currentUser.role === 'supervisor' || currentUser.role === 'admin');
}

function initializeGlobalSocket() {
  if (!currentUser || !currentUser.token || !isAgentOrSupervisor()) {
    console.log('[GlobalSocket] Not initializing: user not authenticated or not agent/supervisor/admin');
    return;
  }
  if (window.globalSocket && window.globalSocket.connected) {
    console.log('[GlobalSocket] Already connected');
    return;
  }
  if (!window.io) {
    console.error('[GlobalSocket] socket.io client not loaded');
    return;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socketUrl = `${protocol}://${window.location.host}`;
  console.log('[GlobalSocket] Connecting to', socketUrl);
  window.globalSocket = io(socketUrl, {
    auth: { userId: currentUser.id, token: currentUser.token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  window.globalSocket.on('connect', () => {
    console.log('[GlobalSocket] Connected');
  });
  window.globalSocket.on('disconnect', () => {
    console.log('[GlobalSocket] Disconnected');
  });
  window.globalSocket.on('connect_error', (err) => {
    console.error('[GlobalSocket] Connection error:', err);
  });
  window.globalSocket.on('escalation_request', (data) => {
    console.log('[GlobalSocket] Received escalation request:', data);
    console.log('[GlobalSocket] Current user:', currentUser);
    console.log('[GlobalSocket] isAgentOrSupervisor():', isAgentOrSupervisor());
    console.log('[GlobalSocket] showEscalationNotification function exists:', !!window.showEscalationNotification);
    
    if (!window.showEscalationNotification) {
      console.error('[GlobalSocket] showEscalationNotification function not found');
      return;
    }
    if (!isAgentOrSupervisor()) {
      console.log('[GlobalSocket] User is not agent/supervisor/admin, ignoring escalation');
      return;
    }
    console.log('[GlobalSocket] Showing escalation notification');
    window.showEscalationNotification({
      ...data,
      onAccept: () => window.globalSocket.emit('accept_escalation', { conversationId: data.conversationId }),
      onDecline: () => window.globalSocket.emit('decline_escalation', { conversationId: data.conversationId })
    });
  });
  window.globalSocket.on('session_claimed', ({ conversationId }) => {
    const notif = document.getElementById('escalationNotification_' + conversationId);
    if (notif) notif.remove();
  });
}
window.initializeGlobalSocket = initializeGlobalSocket;

// After authentication, initialize global socket
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) initializeGlobalSocket();
  });
} else {
  if (currentUser) initializeGlobalSocket();
}
