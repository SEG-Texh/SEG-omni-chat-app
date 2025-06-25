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
// Load dashboard data with real data from MongoDB
async function loadDashboardData() {
  try {
    console.log("Loading dashboard data...");
    
    // Fetch all data in parallel
    const [
      totalUsers,
      messagesToday,
      activeChats,
      platformDistribution,
      messageVolume,
      responseTimes
    ] = await Promise.all([
      getTotalUsers(),
      getMessagesToday(),
      getActiveChats(),
      getPlatformDistribution(),
      getMessageVolume(),
      getResponseTimes()
    ]);
    
    // Update stats cards
    updateStatCard('.stat-card:nth-child(1) h3', totalUsers);
    updateStatCard('.stat-card:nth-child(2) h3', messagesToday);
    updateStatCard('.stat-card:nth-child(4) h3', activeChats);
    
    // Update charts with real data
    updateBarChart(messageVolume);
    updatePieChart(platformDistribution);
    updateLineChart(responseTimes);
    
    // Animate charts
    animateCharts();
    
    // Update real-time data periodically
    setInterval(updateRealTimeData, 30000);
    
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    // You might want to show an error message to the user here
  }
}

// Helper function to update stat cards
function updateStatCard(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

// Data fetching functions
async function getTotalUsers() {
  try {
    const response = await fetch('/api/users/count');
    const data = await response.json();
    return data.count;
  } catch (error) {
    console.error("Error fetching total users:", error);
    return "N/A";
  }
}

async function getMessagesToday() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const response = await fetch(`/api/chats/count?startDate=${today.toISOString()}`);
    const data = await response.json();
    return data.count;
  } catch (error) {
    console.error("Error fetching messages today:", error);
    return "N/A";
  }
}

async function getActiveChats() {
  try {
    // Active chats could be defined as chats with messages in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const response = await fetch(`/api/chats/active?since=${fifteenMinutesAgo.toISOString()}`);
    const data = await response.json();
    return data.count;
  } catch (error) {
    console.error("Error fetching active chats:", error);
    return "N/A";
  }
}

async function getPlatformDistribution() {
  try {
    const response = await fetch('/api/chats/platform-distribution');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching platform distribution:", error);
    return {
      facebook: 0,
      whatsapp: 0,
      email: 0,
      sms: 0
    };
  }
}

async function getMessageVolume() {
  try {
    const response = await fetch('/api/chats/message-volume?days=7');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching message volume:", error);
    return [];
  }
}

async function getResponseTimes() {
  try {
    const response = await fetch('/api/chats/response-times?months=7');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching response times:", error);
    return [];
  }
}

// Chart updating functions
function updateBarChart(data) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartContainer = document.querySelector('.bar-chart-container');
  
  if (!chartContainer) return;
  
  // Clear existing bars
  chartContainer.innerHTML = '';
  
  // Create new bars based on data
  data.forEach((dayData, index) => {
    const dayName = days[new Date(dayData.date).getDay()];
    const maxValue = Math.max(...data.map(d => d.count));
    const heightPercentage = (dayData.count / maxValue) * 100;
    
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.setProperty('--height', `${heightPercentage}%`);
    bar.dataset.value = dayData.count;
    
    const label = document.createElement('span');
    label.className = 'bar-label';
    label.textContent = dayName;
    
    bar.appendChild(label);
    chartContainer.appendChild(bar);
  });
}

function updatePieChart(data) {
  const pieContainer = document.querySelector('.pie-chart-container');
  const legendContainer = document.querySelector('.pie-legend');
  
  if (!pieContainer || !legendContainer) return;
  
  // Clear existing slices and legend
  pieContainer.innerHTML = '';
  legendContainer.innerHTML = '';
  
  // Calculate total for percentages
  const total = Object.values(data).reduce((sum, value) => sum + value, 0);
  
  // Create new slices
  Object.entries(data).forEach(([platform, count]) => {
    if (count > 0) {
      const percentage = (count / total) * 100;
      
      // Add pie slice
      const slice = document.createElement('div');
      slice.className = `pie-slice ${platform}`;
      slice.style.setProperty('--percentage', percentage);
      pieContainer.appendChild(slice);
      
      // Add legend item
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      
      const color = document.createElement('span');
      color.className = `legend-color ${platform}`;
      
      const text = document.createElement('span');
      text.textContent = `${platform.charAt(0).toUpperCase() + platform.slice(1)} (${percentage.toFixed(1)}%)`;
      
      legendItem.appendChild(color);
      legendItem.appendChild(text);
      legendContainer.appendChild(legendItem);
    }
  });
}

function updateLineChart(data) {
  const svg = document.querySelector('.line-chart-svg');
  const labelsContainer = document.querySelector('.line-chart-labels');
  
  if (!svg || !labelsContainer) return;
  
  // Clear existing content
  svg.innerHTML = '';
  labelsContainer.innerHTML = '';
  
  // Calculate dimensions and scaling
  const width = 400;
  const height = 200;
  const padding = 20;
  
  const maxValue = Math.max(...data.map(d => d.avgResponseTime));
  const xScale = (width - 2 * padding) / (data.length - 1);
  const yScale = (height - 2 * padding) / maxValue;
  
  // Create path for line
  let pathD = '';
  let areaD = '';
  
  data.forEach((point, index) => {
    const x = padding + index * xScale;
    const y = height - padding - (point.avgResponseTime * yScale);
    
    if (index === 0) {
      pathD += `M ${x} ${y}`;
      areaD += `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
      areaD += ` L ${x} ${y}`;
    }
  });
  
  // Close the area path
  areaD += ` L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  
  // Add gradient definition
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradient.setAttribute('id', 'lineGradient');
  gradient.setAttribute('x1', '0%');
  gradient.setAttribute('y1', '0%');
  gradient.setAttribute('x2', '0%');
  gradient.setAttribute('y2', '100%');
  
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('style', 'stop-color:#4f46e5;stop-opacity:0.3');
  
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('style', 'stop-color:#4f46e5;stop-opacity:0');
  
  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  defs.appendChild(gradient);
  svg.appendChild(defs);
  
  // Add area
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', areaD);
  area.setAttribute('fill', 'url(#lineGradient)');
  svg.appendChild(area);
  
  // Add line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', pathD);
  line.setAttribute('stroke', '#4f46e5');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('fill', 'none');
  svg.appendChild(line);
  
  // Add points
  data.forEach((point, index) => {
    const x = padding + index * xScale;
    const y = height - padding - (point.avgResponseTime * yScale);
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#4f46e5');
    svg.appendChild(circle);
  });
  
  // Add labels
  data.forEach((point, index) => {
    const month = new Date(point.month).toLocaleString('default', { month: 'short' });
    const label = document.createElement('span');
    label.textContent = month;
    labelsContainer.appendChild(label);
  });
}

// Update real-time data
async function updateRealTimeData() {
  try {
    const [messagesToday, activeChats] = await Promise.all([
      getMessagesToday(),
      getActiveChats()
    ]);
    
    updateStatCard('.stat-card:nth-child(2) h3', messagesToday);
    updateStatCard('.stat-card:nth-child(4) h3', activeChats);
    
  } catch (error) {
    console.error("Error updating real-time data:", error);
  }
}

// Animate charts (placeholder - implement your animation logic)
function animateCharts() {
  // Implement your chart animation logic here
  console.log("Animating charts...");
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
