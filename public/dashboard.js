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
async function renderCharts() {
  // --- BAR CHART (Message Volume) ---
  let barLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let barData = [0, 0, 0, 0, 0, 0, 0];
  try {
    const resp = await fetch('/api/dashboard/message-volume?days=7');
    if (resp.ok) {
      const results = await resp.json();
      // Map results to days of week
      const dayIdx = {};
      // Get today (0 = Sun, 6 = Sat)
      const today = new Date();
      for (let i = 6; i >= 0; --i) {
        const d = new Date();
        d.setDate(today.getDate() - (6 - i));
        const key = d.toISOString().split('T')[0];
        dayIdx[key] = i;
        barLabels[i] = d.toLocaleDateString(undefined, { weekday: 'short' });
      }
      results.forEach(({ date, count }) => {
        if (dayIdx[date] !== undefined) barData[dayIdx[date]] = count;
      });
    }
  } catch (e) {
    // fallback to all zeroes
  }
  const barCtx = document.getElementById('barChart').getContext('2d');
  if (window.barChartInstance) window.barChartInstance.destroy();
  window.barChartInstance = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [{
        label: 'Messages',
        data: barData,
        backgroundColor: 'rgba(99,102,241,0.8)',
        borderRadius: 10,
        barThickness: 32
      }]
    },
    options: {
      plugins: {
        legend: { display: true, position: 'right' },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label || ''}: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#eee' } }
      }
    }
  });

  // --- PIE/DOUGHNUT CHART (Platform Distribution) ---
  // --- PIE/DOUGHNUT CHART (Platform Distribution, live data) ---
  let pieLabels = ['Facebook', 'WhatsApp', 'Other'];
  let pieData = [0, 0, 0];
  // Always map Facebook to blue and WhatsApp to green
  const colorMap = {
    Facebook: 'rgba(59,130,246,0.85)', // blue
    WhatsApp: 'rgba(16,185,129,0.85)', // green
    Other: 'rgba(139,92,246,0.85)',   // purple
  };
  let pieColors = pieLabels.map(label => colorMap[label] || 'rgba(139,92,246,0.85)');
  try {
    const resp = await fetch('/api/dashboard/platform-distribution');
    if (resp.ok) {
      const results = await resp.json();
      pieLabels = Object.keys(results);
      pieData = Object.values(results);
    }
  } catch (e) {
    // fallback to default
  }
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  if (window.pieChartInstance) window.pieChartInstance.destroy();
  window.pieChartInstance = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: pieColors,
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      cutout: '70%', // thick ring
      plugins: {
        legend: { display: true, position: 'bottom' },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed;
              // Show percentage in tooltip
              const total = context.dataset.data.reduce((a,b) => a+b, 0);
              const percent = total ? Math.round(value/total*100) : 0;
              return `${label}: ${value} (${percent}%)`;
            }
          }
        },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 16 },
          formatter: function(value, context) {
            const total = context.chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
            const percent = total ? Math.round(value/total*100) : 0;
            return percent > 0 ? percent + '%' : '';
          }
        }
      }
    },
    plugins: window.ChartDataLabels ? [ChartDataLabels] : []
  });

  // Update platform spans with real percentages
  const total = pieData.reduce((a, b) => a + b, 0);
  const percent = v => total ? Math.round((v / total) * 100) : 0;
  const updateSpan = (id, label, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${label} (${percent(value)}%)`;
  };
  // Map by label (case-insensitive)
  pieLabels.forEach((label, i) => {
    const lower = label.toLowerCase();
    if (lower.includes('facebook')) updateSpan('platform-facebook', 'Facebook', pieData[i]);
    else if (lower.includes('whatsapp')) updateSpan('platform-whatsapp', 'WhatsApp', pieData[i]);
    else if (lower.includes('other')) updateSpan('platform-other', 'Other', pieData[i]);
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
