const token = localStorage.getItem("token");
const messagesDiv = document.getElementById("messages");

if (!token) {
  alert("Please log in");
  window.location.href = "login.html";
}

async function loadMessages() {
  try {
    const res = await fetch("/api/message/all", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const messages = await res.json();

    messagesDiv.innerHTML = "";

    messages.forEach((msg) => {
      const div = document.createElement("div");
      div.className = "message";
      div.innerHTML = `
        <p><strong>${msg.source}</strong>: ${msg.content}</p>
        ${
          msg.claimedBy
            ? `<p><em>Claimed by: ${msg.claimedBy.username}</em></p>`
            : `<button onclick="claimMessage('${msg._id}')">Claim</button>`
        }
        <hr />
      `;
      messagesDiv.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading messages:", err);
    alert("Could not load messages");
  }
}

async function claimMessage(id) {
  try {
    const res = await fetch(`/api/message/claim/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    alert(data.message);
    loadMessages();
  } catch (err) {
    console.error("Error claiming message:", err);
    alert("Failed to claim message");
  }
}

// Socket.IO real-time updates (if you're emitting from backend)
const socket = io();
socket.on("newMessage", () => {
  console.log("New message received");
  loadMessages();
});

loadMessages();
