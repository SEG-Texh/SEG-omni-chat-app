 // Mock user data - in real app, this would come from login session
        const currentUser = {
            name: 'John Doe',
            email: 'john.doe@omnichat.com',
            avatar: 'JD'
        };

        // Mock messages data - in real app, this would come from API
        let unclaimedMessages = [
            {
                id: 1,
                sender: 'Alice Johnson',
                preview: 'Hi, I need help with my account settings. I cannot seem to change my password and...',
                timestamp: '2 minutes ago',
                priority: 'high',
                channel: 'Website Chat'
            },
            {
                id: 2,
                sender: 'Bob Smith',
                preview: 'Hello, I have a question about billing. My latest invoice seems to have an error...',
                timestamp: '5 minutes ago',
                priority: 'normal',
                channel: 'Email'
            },
            {
                id: 3,
                sender: 'Carol Davis',
                preview: 'Good morning! I would like to know more about your premium features...',
                timestamp: '12 minutes ago',
                priority: 'low',
                channel: 'Social Media'
            },
            {
                id: 4,
                sender: 'David Wilson',
                preview: 'Urgent: My service has been down for the past hour. Please help immediately!',
                timestamp: '15 minutes ago',
                priority: 'high',
                channel: 'Phone'
            },
            {
                id: 5,
                sender: 'Emma Brown',
                preview: 'Thank you for the quick response yesterday. I have one more question about...',
                timestamp: '23 minutes ago',
                priority: 'normal',
                channel: 'Website Chat'
            }
        ];

        // Initialize dashboard
        function initDashboard() {
            updateUserInfo();
            updateStats();
            loadMessages();
        }

        function updateUserInfo() {
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userAvatar').textContent = currentUser.avatar;
        }

        function updateStats() {
            document.getElementById('unclaimedCount').textContent = unclaimedMessages.length;
            document.getElementById('activeChats').textContent = Math.floor(Math.random() * 8) + 2;
            document.getElementById('resolvedToday').textContent = Math.floor(Math.random() * 15) + 5;
        }

        function loadMessages() {
            const messagesList = document.getElementById('messagesList');
            
            if (unclaimedMessages.length === 0) {
                messagesList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">💬</div>
                        <h3>No unclaimed messages</h3>
                        <p>All messages have been claimed. Great job!</p>
                    </div>
                `;
                return;
            }

            messagesList.innerHTML = unclaimedMessages.map(message => `
                <div class="message-item" data-message-id="${message.id}">
                    <div class="message-content">
                        <div class="message-sender">${message.sender}</div>
                        <div class="message-preview">${message.preview}</div>
                        <div class="message-meta">
                            <span>${message.timestamp}</span>
                            <span>via ${message.channel}</span>
                            <span class="priority-badge ${message.priority}">${message.priority.toUpperCase()}</span>
                        </div>
                    </div>
                    <button class="accept-btn" onclick="acceptMessage(${message.id})">
                        Accept Chat
                    </button>
                </div>
            `).join('');
        }

        function acceptMessage(messageId) {
            const message = unclaimedMessages.find(m => m.id === messageId);
            if (!message) return;

            // Remove message from unclaimed list
            unclaimedMessages = unclaimedMessages.filter(m => m.id !== messageId);
            
            // Show notification
            showNotification(`Chat accepted with ${message.sender}. Redirecting to chat...`);
            
            // Update UI
            updateStats();
            loadMessages();
            
            // In a real app, this would redirect to the chat interface
            setTimeout(() => {
                alert(`Chat with ${message.sender} would open in a new window/tab in the real application.`);
            }, 1500);
        }

        function refreshMessages() {
            const messagesList = document.getElementById('messagesList');
            messagesList.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    Refreshing messages...
                </div>
            `;

            // Simulate API call delay
            setTimeout(() => {
                // In real app, this would fetch from server
                // For demo, we'll add a new random message
                if (Math.random() > 0.5) {
                    const newMessage = {
                        id: Date.now(),
                        sender: 'New Customer',
                        preview: 'I just signed up and need help getting started with your platform...',
                        timestamp: 'Just now',
                        priority: 'normal',
                        channel: 'Website Chat'
                    };
                    unclaimedMessages.unshift(newMessage);
                }
                
                updateStats();
                loadMessages();
                showNotification('Messages refreshed!');
            }, 1000);
        }

        function showNotification(message) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        function logout() {
            if (confirm('Are you sure you want to logout?')) {
                showNotification('Logging out...');
                setTimeout(() => {
                    // In real app, this would clear session and redirect to login
                    window.location.href = 'index.html';
                }, 1000);
            }
        }

        // Auto-refresh messages every 30 seconds
        setInterval(() => {
            if (Math.random() > 0.7) {
                refreshMessages();
            }
        }, 30000);

        // Initialize dashboard when page loads
        window.addEventListener('load', initDashboard);