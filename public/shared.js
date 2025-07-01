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
  localStorage.removeItem("currentUser")
  currentUser = null
  window.location.href = "login.html"
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

  try {
    const response = await fetch(url, mergedOptions)

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
