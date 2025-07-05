// Dashboard page specific functionality

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

    // Render both charts
    renderCharts()
  } catch (error) {
    console.error("Error loading dashboard data:", error)
  }
}

// Render charts with Chart.js
function renderCharts() {
  // Bar Chart
  const barCtx = document.getElementById('barChart').getContext('2d');
  if (window.barChartInstance) window.barChartInstance.destroy();
  window.barChartInstance = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      datasets: [{
        label: 'Messages',
        data: [40, 65, 30, 80, 45, 70, 55], // Replace with real data
        backgroundColor: 'rgba(99,102,241,0.8)',
        borderRadius: 10,
        barThickness: 32
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#eee' } }
      }
    }
  });

  // Pie/Doughnut Chart
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  if (window.pieChartInstance) window.pieChartInstance.destroy();
  window.pieChartInstance = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: ['Facebook', 'WhatsApp', 'Other'],
      datasets: [{
        data: [45, 35, 20], // Replace with real data
        backgroundColor: [
          'rgba(59,130,246,0.85)', // blue
          'rgba(16,185,129,0.85)', // green
          'rgba(139,92,246,0.85)'  // purple
        ],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      cutout: '70%', // thick ring
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      }
    }
  });
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
