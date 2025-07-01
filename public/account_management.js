// Account Management page specific functionality
let currentUser = null // Declare currentUser variable
let apiRequest = null // Declare apiRequest variable
let showMessage = null // Declare showMessage variable

document.addEventListener("DOMContentLoaded", () => {
  loadAccountsData()
  setupAccountsEventListeners()
})

// Setup event listeners
function setupAccountsEventListeners() {
  const addUserForm = document.getElementById("addUserForm")
  if (addUserForm) {
    addUserForm.addEventListener("submit", handleAddUser)
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
    const response = await apiRequest("/api/users/stats")

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
    const response = await apiRequest("/api/users")

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
    name: document.getElementById("fullName").value,
    email: document.getElementById("userEmail").value,
    username: document.getElementById("username").value,
    password: document.getElementById("userPassword").value,
    role: formData.get("role"),
    status: "active",
  }

  // Validation
  if (!userData.name || !userData.email || !userData.username || !userData.password || !userData.role) {
    showMessage("accountMessage", "error", "Please fill in all required fields and select a role.")
    return
  }

  try {
    const response = await apiRequest("/api/users", {
      method: "POST",
      body: JSON.stringify(userData),
    })

    if (response.ok) {
      showMessage("accountMessage", "success", "User added successfully!")
      document.getElementById("addUserForm").reset()
      loadAccountsData() // Reload data
    } else {
      const error = await response.json()
      showMessage("accountMessage", "error", error.message || "Failed to add user")
    }
  } catch (error) {
    showMessage("accountMessage", "error", "Failed to add user: " + error.message)
  }
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
    const response = await apiRequest(`/api/users/${userId}`, {
      method: "DELETE",
    })

    if (response.ok) {
      showMessage("accountMessage", "success", "User deleted successfully!")
      loadAccountsData() // Reload data
    } else {
      const error = await response.json()
      showMessage("accountMessage", "error", error.message || "Failed to delete user")
    }
  } catch (error) {
    showMessage("accountMessage", "error", "Failed to delete user: " + error.message)
  }
}

// Make functions globally available
window.editUser = editUser
window.deleteUser = deleteUser

// Example implementations for undeclared variables
currentUser = { token: "exampleToken" } // Example currentUser object
apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${currentUser.token}`,
      "Content-Type": "application/json",
    },
    ...options,
  })
  return response
} // Example apiRequest function

showMessage = (elementId, type, message) => {
  const element = document.getElementById(elementId)
  if (element) {
    element.className = `message ${type}`
    element.textContent = message
  }
} // Example showMessage function
