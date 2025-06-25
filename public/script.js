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
function initializeSocket(token) {
  socket = io('https://chat-app-omni-33e1e5eaa993.herokuapp.com', {
    auth: {
      token: token
    }
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
  });

  socket.on("newMessage", (msg) => {
    console.log("📨 New message:", msg);
    // updateChatUI(msg);
  });

  socket.on("userTyping", (data) => {
    console.log(`${data.name} is typing...`);
  });

  socket.on("userOnline", (data) => {
    console.log(`${data.name} is online`);
  });

  socket.on("userOffline", (data) => {
    console.log(`${data.name} went offline`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Disconnected from socket");
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Connection error:", err.message);
  });
}


// Load dashboard data
// Dashboard Service - Real Data Implementation
const DashboardService = {
  async fetchStats() {
    try {
      // Calculate stats based on your Chat model
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const stats = await Promise.all([
        // Total unique users
        mongoose.model('Chat').distinct('senderId').countDocuments(),
        
        // Messages today
        mongoose.model('Chat').countDocuments({
          timestamp: { $gte: todayStart }
        }),
        
        // Active chats (users with messages in last 24 hours)
        mongoose.model('Chat').distinct('senderId', {
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).countDocuments(),
        
        // Response rate (percentage of incoming messages with replies)
        this.calculateResponseRate()
      ]);
      
      return {
        totalUsers: stats[0],
        messagesToday: stats[1],
        activeChats: stats[2],
        responseRate: stats[3],
        // Calculate changes (you might want to store these in another collection)
        userGrowth: await this.calculateGrowth('users'),
        messageGrowth: await this.calculateGrowth('messages'),
        responseRateChange: await this.calculateGrowth('responseRate')
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return null;
    }
  },

  async calculateResponseRate() {
    // Get all incoming messages
    const incomingCount = await mongoose.model('Chat').countDocuments({
      direction: 'incoming'
    });
    
    if (incomingCount === 0) return 100; // If no incoming messages, consider 100% response
    
    // Get messages that were replied to (have an outgoing message after them)
    const repliedCount = await mongoose.model('Chat').countDocuments({
      direction: 'outgoing',
      'metadata.inReplyTo': { $exists: true }
    });
    
    return (repliedCount / incomingCount) * 100;
  },

  async calculateGrowth(metric) {
    // You should implement proper growth calculation based on historical data
    // This is a simplified version
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let current, previous;
    
    switch(metric) {
      case 'users':
        current = await mongoose.model('Chat').distinct('senderId', {
          timestamp: { $gte: today.setHours(0, 0, 0, 0) }
        }).countDocuments();
        
        previous = await mongoose.model('Chat').distinct('senderId', {
          timestamp: { 
            $gte: yesterday.setHours(0, 0, 0, 0),
            $lt: today.setHours(0, 0, 0, 0)
          }
        }).countDocuments();
        break;
        
      case 'messages':
        current = await mongoose.model('Chat').countDocuments({
          timestamp: { $gte: today.setHours(0, 0, 0, 0) }
        });
        
        previous = await mongoose.model('Chat').countDocuments({
          timestamp: { 
            $gte: yesterday.setHours(0, 0, 0, 0),
            $lt: today.setHours(0, 0, 0, 0)
          }
        });
        break;
        
      case 'responseRate':
        return 0; // Simplified - implement proper calculation
    }
    
    if (previous === 0) return 100; // Avoid division by zero
    return ((current - previous) / previous) * 100;
  },

  async fetchMessageVolume(timeRange = '7d') {
    try {
      let days;
      switch(timeRange) {
        case '7d': days = 7; break;
        case '30d': days = 30; break;
        case '3m': days = 90; break;
        default: days = 7;
      }
      
      const data = await mongoose.model('Chat').aggregate([
        {
          $match: {
            timestamp: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Format for chart
      return data.map(item => ({
        label: new Date(item._id).toLocaleDateString('en-US', { weekday: 'short' }),
        value: item.count,
        percentage: (item.count / Math.max(...data.map(d => d.count), 1)) * 100
      }));
    } catch (error) {
      console.error('Error fetching message volume:', error);
      return null;
    }
  },

  async fetchPlatformDistribution() {
    try {
      const result = await mongoose.model('Chat').aggregate([
        {
          $group: {
            _id: "$platform",
            count: { $sum: 1 }
          }
        }
      ]);
      
      const total = result.reduce((sum, item) => sum + item.count, 0);
      
      return result.map(item => ({
        name: item._id,
        percentage: ((item.count / total) * 100).toFixed(1)
      }));
    } catch (error) {
      console.error('Error fetching platform distribution:', error);
      return null;
    }
  },

  async fetchResponseTimeTrend() {
    try {
      // This would need your actual response time data
      // Using message timestamps as a proxy for this example
      const data = await mongoose.model('Chat').aggregate([
        {
          $match: {
            direction: 'outgoing',
            'metadata.inReplyTo': { $exists: true }
          }
        },
        {
          $lookup: {
            from: 'chats',
            localField: 'metadata.inReplyTo',
            foreignField: '_id',
            as: 'incomingMessage'
          }
        },
        {
          $unwind: '$incomingMessage'
        },
        {
          $project: {
            responseTime: {
              $divide: [
                { $subtract: ["$timestamp", "$incomingMessage.timestamp"] },
                1000 * 60 // Convert to minutes
              ]
            },
            month: { $month: "$timestamp" }
          }
        },
        {
          $group: {
            _id: "$month",
            avgResponseTime: { $avg: "$responseTime" }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
      
      return data.map(item => ({
        label: monthNames[item._id - 1],
        value: 100 - (item.avgResponseTime * 2) // Scale for visualization
      }));
    } catch (error) {
      console.error('Error fetching response time trend:', error);
      return null;
    }
  }
};

// Dashboard UI Updater (same as before, but with improved number formatting)
const DashboardUpdater = {
  async updateStats() {
    const stats = await DashboardService.fetchStats();
    if (!stats) return;

    document.querySelectorAll('.stat-card').forEach(card => {
      const type = card.querySelector('p').textContent.toLowerCase();
      if (type.includes('users') && stats.totalUsers) {
        this.updateStatCard(card, stats.totalUsers, stats.userGrowth);
      } else if (type.includes('messages') && stats.messagesToday) {
        this.updateStatCard(card, stats.messagesToday, stats.messageGrowth);
      } else if (type.includes('rate') && stats.responseRate) {
        this.updateStatCard(card, stats.responseRate, stats.responseRateChange);
      } else if (type.includes('chats') && stats.activeChats) {
        this.updateStatCard(card, stats.activeChats, stats.activeChatsGrowth);
      }
    });
  },

  updateStatCard(card, value, change) {
    const valueEl = card.querySelector('h3');
    const changeEl = card.querySelector('.stat-change');
    
    // Format value based on content
    if (card.textContent.includes('%')) {
      valueEl.textContent = `${value.toFixed(1)}%`;
    } else {
      valueEl.textContent = value.toLocaleString();
    }
    
    // Update change indicator
    if (change !== undefined) {
      changeEl.textContent = `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
      changeEl.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
    }
  },

  // ... rest of the DashboardUpdater implementation remains the same ...
};

// Initialize dashboard
async function loadDashboardData() {
  if (!mongoose.connection.readyState) {
    console.error('Database not connected');
    return;
  }

  try {
    await Promise.all([
      DashboardUpdater.updateStats(),
      DashboardUpdater.updateMessageVolumeChart(),
      DashboardUpdater.updatePlatformDistribution(),
      DashboardUpdater.updateResponseTimeTrend()
    ]);

    DashboardUpdater.initChartFilters();
    setInterval(() => DashboardUpdater.updateStats(), 30000);
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

document.addEventListener('DOMContentLoaded', loadDashboardData);

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
