// Global variables
let currentUser = null
let socket = null

// DOM elements
const loginContainer = document.getElementById("loginContainer")
const appContainer = document.getElementById("appContainer")
const loginForm = document.getElementById("loginForm")
const loginError = document.getElementById("loginError")
const loginSpinner = document.getElementById("loginSpinner")
const loginText = document.getElementById("loginText")

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  // Check if user is already logged in
  const savedUser = localStorage.getItem("omniChatUser")
  if (savedUser) {
    currentUser = JSON.parse(savedUser)
    showApp()
  }

  // Add login form event listener
  loginForm.addEventListener("submit", handleLogin)

  // Initialize dashboard animations
  initializeDashboard()
})

// Handle login
async function handleLogin(e) {
  e.preventDefault()

  const email = document.getElementById("email").value
  const password = document.getElementById("password").value

  // Show loading state
  loginSpinner.style.display = "inline-block"
  loginText.textContent = "Logging in..."
  loginError.textContent = ""

  try {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock authentication - in real app, this would be an API call
    if (email && password) {
      currentUser = {
        id: 1,
        name: "Admin User",
        email: email,
        role: "admin",
        avatar: email.charAt(0).toUpperCase(),
      }

      // Save user to localStorage
      localStorage.setItem("omniChatUser", JSON.stringify(currentUser))

      showApp()
    } else {
      throw new Error("Invalid credentials")
    }
  } catch (error) {
    loginError.textContent = error.message || "Login failed. Please try again."
  } finally {
    // Reset loading state
    loginSpinner.style.display = "none"
    loginText.textContent = "Login"
  }
}

// Show the main application
function showApp() {
  loginContainer.style.display = "none"
  appContainer.style.display = "block"

  // Update user info in header
  document.getElementById("userName").textContent = currentUser.name
  document.getElementById("userAvatar").textContent = currentUser.avatar
  document.getElementById("userRole").textContent = currentUser.role
  document.getElementById("userRole").className = `badge ${currentUser.role}`

  // Initialize socket connection
  initializeSocket()

  // Load dashboard data
  loadDashboardData()
}

// Handle logout
function logout() {
  localStorage.removeItem("omniChatUser")
  currentUser = null

  if (socket) {
    socket.disconnect()
    socket = null
  }

  loginContainer.style.display = "flex"
  appContainer.style.display = "none"

  // Reset form
  loginForm.reset()
  loginError.textContent = ""
}

// Switch between tabs
function switchTab(tabName) {
  // Remove active class from all tabs and buttons
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active")
  })
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active")
  })

  // Add active class to selected tab and button
  document.getElementById(tabName + "Tab").classList.add("active")
  event.target.classList.add("active")

  // Load tab-specific data
  if (tabName === "dashboard") {
    loadDashboardData()
  } else if (tabName === "facebook") {
    loadFacebookChats()
  } else if (tabName === "whatsapp") {
    loadWhatsAppChats()
  }
}

// Initialize socket connection
function initializeSocket() {
  // In a real application, you would connect to your socket server
  // socket = io('your-socket-server-url');

  // Mock socket events for demo
  console.log("Socket connection initialized")
}

// Load dashboard data
function loadDashboardData() {
  // In a real application, this would fetch data from your API
  console.log("Loading dashboard data...")

  // Animate charts
  animateCharts()

  // Update real-time data periodically
  setInterval(updateRealTimeData, 30000) // Update every 30 seconds
}

// Load Facebook chats
function loadFacebookChats() {
  console.log("Loading Facebook chats...")
  // Implementation for loading Facebook chat data
}

// Load WhatsApp chats
function loadWhatsAppChats() {
  console.log("Loading WhatsApp chats...")
  // Implementation for loading WhatsApp chat data
}

// Initialize dashboard animations
function initializeDashboard() {
  // Add hover effects to stat cards
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-4px)"
    })

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)"
    })
  })

  // Add click effects to chart elements
  document.querySelectorAll(".bar").forEach((bar) => {
    bar.addEventListener("click", function () {
      const value = this.getAttribute("data-value")
      console.log(`Bar clicked: ${value}`)
      // You could show a modal with detailed data here
    })
  })
}

// Animate charts
function animateCharts() {
  // Animate bar chart
  document.querySelectorAll(".bar").forEach((bar, index) => {
    setTimeout(() => {
      bar.style.animation = "none"
      bar.offsetHeight // Trigger reflow
      bar.style.animation = "barGrow 0.8s ease-out forwards"
    }, index * 100)
  })

  // Animate pie chart
  const pieChart = document.querySelector(".pie-chart-container")
  if (pieChart) {
    pieChart.style.animation = "pieRotate 1s ease-out"
  }
}

// Update real-time data
function updateRealTimeData() {
  // Simulate real-time updates
  const stats = document.querySelectorAll(".stat-content h3")
  stats.forEach((stat) => {
    const currentValue = Number.parseInt(stat.textContent.replace(/,/g, ""))
    const change = Math.floor(Math.random() * 20) - 10 // Random change between -10 and +10
    const newValue = Math.max(0, currentValue + change)

    // Animate the change
    stat.style.transition = "all 0.3s ease"
    stat.textContent = newValue.toLocaleString()
  })

  console.log("Real-time data updated")
}

// Add CSS animations
const style = document.createElement("style")
style.textContent = `
    @keyframes barGrow {
        from {
            height: 0;
        }
        to {
            height: var(--height);
        }
    }
    
    @keyframes pieRotate {
        from {
            transform: rotate(-90deg);
        }
        to {
            transform: rotate(0deg);
        }
    }
    
    .stat-card {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .chart-card:hover {
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }
`
document.head.appendChild(style)

// Utility functions
function formatNumber(num) {
  return num.toLocaleString()
}

function formatPercentage(num) {
  return `${num.toFixed(1)}%`
}

function getRandomColor() {
  const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Export functions for global access
window.switchTab = switchTab
window.logout = logout
