const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const registerChatSocket = require('./chatSocket');
const registerCallSocket = require('./callSocket');

let io = null;

/**
 * Initialize Socket.io Server instance
 */
function initSocket(server, clientUrl) {
  io = new Server(server, {
    cors: {
      origin: clientUrl,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Token verification middleware before establishing connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error. Token required.'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error. Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} (User: ${socket.user.id})`);

    // Join a private room corresponding to their User ID for targeted 1-to-1 events
    socket.join(socket.user.id);

    // Join room event (for generic dynamic channels)
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
    });

    // Leave room event
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
    });


    registerChatSocket(io, socket);
    registerCallSocket(io, socket);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id} (User: ${socket.user.id})`);
    });
  });

  return io;
}

/**
 * Retrieve active IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
}

/**
 * Emit event globally to all connected clients
 */
function emitGlobal(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Emit event to a specific room (such as a recipient's user room)
 */
function emitToRoom(room, event, data) {
  if (io) {
    io.to(room).emit(event, data);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitGlobal,
  emitToRoom
};
