// Dashboard page specific functionality
const currentUser = {} // Declare currentUser variable
const apiRequest = async (url) => {
  // Dummy implementation of apiRequest
  return fetch(url)
} // Declare apiRequest function

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData()
  initializeDashboard()
})

// Load dashboard data
async function loadDashboardData() {
  if (!currentUser?.token) return

  try {
    // Load stats
    const [totalUsersRes, messagesTodayRes, responseRateRes, activeChatsRes] = await Promise.all([
      apiRequest("/api/dashboard/users/count"),
      apiRequest("/api/dashboard/count?startDate=" + new Date().toISOString().split("T")[0]),
      apiRequest("/api/dashboard/response-rate"),
      apiRequest("/api/dashboard/active-chats"),
    ])

    const totalUsers = await totalUsersRes.json()
    const messagesToday = await messagesTodayRes.json()
    const responseRate = await responseRateRes.json()
    const activeChats = await activeChatsRes.json()

    // Update stats
    document.getElementById("totalUsers").textContent = totalUsers.count || 0
    document.getElementById("messagesToday").textContent = messagesToday.count || 0
    document.getElementById("responseRate").textContent = (responseRate.responseRate || 0) + "%"
    document.getElementById("activeChats").textContent = activeChats.activeChats || 0

    // Update bar chart
    updateBarChart()
  } catch (error) {
    console.error("Error loading dashboard data:", error)
  }
}

// Update bar chart
function updateBarChart() {
  const barChart = document.getElementById("barChart")
  const heights = [40, 65, 30, 80, 45, 70, 55]

  barChart.innerHTML = ""

  heights.forEach((height, index) => {
    const bar = document.createElement("div")
    bar.className = "flex-1 bg-indigo-500 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
    bar.style.height = `${height}%`
    barChart.appendChild(bar)
  })
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
