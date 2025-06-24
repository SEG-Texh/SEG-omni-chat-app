// config/socket.js
let io;

module.exports = {
  init: (server) => {
    if (!io) {
      io = require('socket.io')(server, {
        cors: {
          origin: process.env.CLIENT_URL || '*',
          methods: ['GET', 'POST'],
          credentials: true
        }
      });
    }
    return io;
  },
  getIO: () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
  }
};
