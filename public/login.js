// Login page specific functionality
document.addEventListener("DOMContentLoaded", () => {
  // Check if already logged in
  const savedUser = localStorage.getItem("currentUser")
  if (savedUser) {
    window.location.href = "dashboard.html"
    return
  }

  // Setup login form
  const loginForm = document.getElementById("loginForm")
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin)
  }
})

// Handle login
async function handleLogin(e) {
  e.preventDefault()

  const email = document.getElementById("email").value
  const password = document.getElementById("password").value

  // Show loading state
  const loginButton = document.getElementById("loginButton")
  const loginText = document.getElementById("loginText")
  const loginSpinner = document.getElementById("loginSpinner")
  const loginError = document.getElementById("loginError")

  loginButton.disabled = true
  loginText.textContent = "Logging in..."
  loginSpinner.classList.remove("hidden")
  loginError.classList.add("hidden")

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      throw new Error("Invalid credentials")
    }

    const data = await response.json()
    const user = { ...data.user, token: data.token, _id: data.user.id }

    // Save to localStorage
    localStorage.setItem("currentUser", JSON.stringify(user))

    // Redirect to dashboard
    window.location.href = "dashboard.html"
  } catch (error) {
    loginError.textContent = error.message || "Login failed. Please try again."
    loginError.classList.remove("hidden")
  } finally {
    // Reset loading state
    loginButton.disabled = false
    loginText.textContent = "Login"
    loginSpinner.classList.add("hidden")
  }
}
