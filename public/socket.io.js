// ============================================================================
// SOCKET.IO CLIENT HANDLER
// ============================================================================

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.eventHandlers = new Map();
    }

    // Initialize socket connection
    initialize(token) {
        if (this.socket) {
            this.disconnect();
        }

        try {
            // Initialize Socket.IO connection
            this.socket = io({
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
                timeout: 20000,
                forceNew: true
            });

            this.setupEventListeners();
            return this.socket;
        } catch (error) {
            console.error('Failed to initialize socket:', error);
            throw error;
        }
    }

    // Setup core socket event listeners
    setupEventListeners() {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('socket:connected', { socketId: this.socket.id });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.isConnected = false;
            this.emit('socket:disconnected', { reason });
            
            // Auto-reconnect logic
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, don't reconnect
                return;
            }
            
            this.handleReconnection();
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.emit('socket:error', { error: error.message });
            this.handleReconnection();
        });

        // User authentication events
        this.socket.on('authenticated', (data) => {
            console.log('Socket authenticated:', data);
            this.emit('user:authenticated', data);
        });

        this.socket.on('authentication_error', (error) => {
            console.error('Socket authentication error:', error);
            this.emit('user:auth_error', error);
        });

        // User status events
        this.socket.on('user:online', (data) => {
            this.emit('user:status_changed', { ...data, isOnline: true });
        });

        this.socket.on('user:offline', (data) => {
            this.emit('user:status_changed', { ...data, isOnline: false });
        });

        this.socket.on('users:list', (users) => {
            this.emit('users:updated', users);
        });

        // Message events
        this.socket.on('message:new', (message) => {
            this.emit('message:received', message);
        });

        this.socket.on('message:delivered', (data) => {
            this.emit('message:status_updated', { ...data, status: 'delivered' });
        });

        this.socket.on('message:read', (data) => {
            this.emit('message:status_updated', { ...data, status: 'read' });
        });

        // Typing events
        this.socket.on('user:typing', (data) => {
            this.emit('typing:started', data);
        });

        this.socket.on('user:stopped_typing', (data) => {
            this.emit('typing:stopped', data);
        });

        // Room events
        this.socket.on('room:joined', (data) => {
            this.emit('room:joined', data);
        });

        this.socket.on('room:left', (data) => {
            this.emit('room:left', data);
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.emit('socket:error', error);
        });

        // Reconnection events
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Socket reconnected after', attemptNumber, 'attempts');
            this.emit('socket:reconnected', { attempts: attemptNumber });
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('Socket reconnection error:', error);
            this.emit('socket:reconnect_error', error);
        });
    }

    // Handle reconnection logic
    handleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.emit('socket:reconnect_failed');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.isConnected && this.socket) {
                this.socket.connect();
            }
        }, delay);
    }

    // Send message
    sendMessage(receiverId, content, messageType = 'text') {
        if (!this.isConnected || !this.socket) {
            throw new Error('Socket not connected');
        }

        const messageData = {
            receiverId,
            content,
            type: messageType,
            timestamp: new Date().toISOString()
        };

        this.socket.emit('message:send', messageData);
        return messageData;
    }

    // Send typing indicator
    startTyping(receiverId) {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('typing:start', { receiverId });
    }

    stopTyping(receiverId) {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('typing:stop', { receiverId });
    }

    // Join/leave rooms
    joinRoom(roomId) {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('room:join', { roomId });
    }

    leaveRoom(roomId) {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('room:leave', { roomId });
    }

    // Mark message as read
    markMessageAsRead(messageId) {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('message:read', { messageId });
    }

    // Get online users
    getOnlineUsers() {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('users:get_online');
    }

    // Update user status
    updateStatus(status) {
        if (!this.isConnected || !this.socket) return;
        
        this.socket.emit('user:status_update', { status });
    }

    // Generic emit method
    send(event, data) {
        if (!this.isConnected || !this.socket) {
            throw new Error('Socket not connected');
        }
        
        this.socket.emit(event, data);
    }

    // Event listener management
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }
    }

    // Emit custom events
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // Disconnect socket
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.eventHandlers.clear();
    }

    // Get connection status
    getStatus() {
        return {
            isConnected: this.isConnected,
            socketId: this.socket?.id || null,
            reconnectAttempts: this.reconnectAttempts
        };
    }
}

// ============================================================================
// GLOBAL SOCKET INSTANCE
// ============================================================================
const socketManager = new SocketManager();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function initializeSocket(token) {
    try {
        return socketManager.initialize(token);
    } catch (error) {
        console.error('Failed to initialize socket:', error);
        throw error;
    }
}

function getSocket() {
    return socketManager.socket;
}

function getSocketManager() {
    return socketManager;
}

function disconnectSocket() {
    socketManager.disconnect();
}

function isSocketConnected() {
    return socketManager.isConnected;
}

// ============================================================================
// MESSAGE HELPERS
// ============================================================================
function sendChatMessage(receiverId, content) {
    try {
        return socketManager.sendMessage(receiverId, content);
    } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
    }
}

function sendTypingIndicator(receiverId, isTyping) {
    try {
        if (isTyping) {
            socketManager.startTyping(receiverId);
        } else {
            socketManager.stopTyping(receiverId);
        }
    } catch (error) {
        console.error('Failed to send typing indicator:', error);
    }
}

// ============================================================================
// EVENT SUBSCRIPTION HELPERS
// ============================================================================
function onSocketEvent(event, handler) {
    socketManager.on(event, handler);
}

function offSocketEvent(event, handler) {
    socketManager.off(event, handler);
}

// Common event subscriptions
function onMessageReceived(handler) {
    socketManager.on('message:received', handler);
}

function onUserStatusChanged(handler) {
    socketManager.on('user:status_changed', handler);
}

function onTypingStarted(handler) {
    socketManager.on('typing:started', handler);
}

function onTypingStopped(handler) {
    socketManager.on('typing:stopped', handler);
}

function onSocketConnected(handler) {
    socketManager.on('socket:connected', handler);
}

function onSocketDisconnected(handler) {
    socketManager.on('socket:disconnected', handler);
}

function onSocketError(handler) {
    socketManager.on('socket:error', handler);
}

// ============================================================================
// CONNECTION MONITORING
// ============================================================================
function monitorConnection() {
    setInterval(() => {
        if (socketManager.socket && !socketManager.isConnected) {
            console.warn('Socket connection lost, attempting to reconnect...');
            socketManager.handleReconnection();
        }
    }, 30000); // Check every 30 seconds
}

// ============================================================================
// EXPORTS (for module systems)
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SocketManager,
        socketManager,
        initializeSocket,
        getSocket,
        getSocketManager,
        disconnectSocket,
        isSocketConnected,
        sendChatMessage,
        sendTypingIndicator,
        onSocketEvent,
        offSocketEvent,
        onMessageReceived,
        onUserStatusChanged,
        onTypingStarted,
        onTypingStopped,
        onSocketConnected,
        onSocketDisconnected,
        onSocketError,
        monitorConnection
    };
}

// ============================================================================
// BROWSER GLOBAL EXPORTS
// ============================================================================
if (typeof window !== 'undefined') {
    window.SocketManager = SocketManager;
    window.socketManager = socketManager;
    window.initializeSocket = initializeSocket;
    window.getSocket = getSocket;
    window.getSocketManager = getSocketManager;
    window.disconnectSocket = disconnectSocket;
    window.isSocketConnected = isSocketConnected;
    window.sendChatMessage = sendChatMessage;
    window.sendTypingIndicator = sendTypingIndicator;
    window.onSocketEvent = onSocketEvent;
    window.offSocketEvent = offSocketEvent;
    window.onMessageReceived = onMessageReceived;
    window.onUserStatusChanged = onUserStatusChanged;
    window.onTypingStarted = onTypingStarted;
    window.onTypingStopped = onTypingStopped;
    window.onSocketConnected = onSocketConnected;
    window.onSocketDisconnected = onSocketDisconnected;
    window.onSocketError = onSocketError;
    window.monitorConnection = monitorConnection;
}

// ============================================================================
// AUTO-INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Start connection monitoring
    monitorConnection();
    
    // Log socket.io.js loaded
    console.log('Socket.IO client handler loaded successfully');
});