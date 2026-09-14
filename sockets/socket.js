const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const registerCallSocket = require("./callSocket");
const registerLiveSocket = require("./liveSocket");

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },

    transports: ["websocket", "polling"],
  });

  io.connectedUsers = new Map();

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake?.auth?.token ||
        socket.handshake?.headers?.authorization
          ?.replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(
          new Error("Authentication token required")
        );
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const userId =
        decoded?.id ||
        decoded?._id ||
        decoded?.userId;

      if (!userId) {
        return next(
          new Error("Invalid authentication token")
        );
      }

      socket.userId = String(userId);

      next();
    } catch (error) {
      console.error(
        "SOCKET AUTH ERROR:",
        error.message
      );

      next(
        new Error("Socket authentication failed")
      );
    }
  });

  io.on("connection", (socket) => {
    const userId = String(
      socket.userId || ""
    );

    console.log(
      `Socket connected: ${socket.id} | User: ${userId}`
    );

    if (userId) {
      io.connectedUsers.set(
        userId,
        socket.id
      );
    }

    socket.io = io;

    socket.emit("socket:connected", {
      socketId: socket.id,
      userId,
    });

    if (userId) {
      socket.broadcast.emit(
        "user:status",
        {
          userId,
          online: true,
          status: "online",
        }
      );
    }

    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on(
      "conversation:join",
      ({ conversationId }) => {
        try {
          if (!conversationId) {
            return;
          }

          const room =
            `conversation:${conversationId}`;

          socket.join(room);

          socket.emit(
            "conversation:joined",
            {
              conversationId:
                String(conversationId),
              room,
            }
          );

          console.log(
            `Conversation joined: ${userId} -> ${conversationId}`
          );
        } catch (error) {
          console.error(
            "CONVERSATION JOIN ERROR:",
            error
          );
        }
      }
    );

    socket.on(
      "conversation:leave",
      ({ conversationId }) => {
        try {
          if (!conversationId) {
            return;
          }

          const room =
            `conversation:${conversationId}`;

          socket.leave(room);

          socket.emit(
            "conversation:left",
            {
              conversationId:
                String(conversationId),
            }
          );
        } catch (error) {
          console.error(
            "CONVERSATION LEAVE ERROR:",
            error
          );
        }
      }
    );

    socket.on(
      "typing:start",
      ({
        conversationId,
        receiverId,
      }) => {
        try {
          if (
            !conversationId ||
            !receiverId
          ) {
            return;
          }

          const receiverSocketId =
            io.connectedUsers.get(
              String(receiverId)
            );

          if (!receiverSocketId) {
            return;
          }

          io.to(receiverSocketId).emit(
            "typing:start",
            {
              conversationId:
                String(conversationId),
              userId,
            }
          );
        } catch (error) {
          console.error(
            "TYPING START ERROR:",
            error
          );
        }
      }
    );

    socket.on(
      "typing:stop",
      ({
        conversationId,
        receiverId,
      }) => {
        try {
          if (
            !conversationId ||
            !receiverId
          ) {
            return;
          }

          const receiverSocketId =
            io.connectedUsers.get(
              String(receiverId)
            );

          if (!receiverSocketId) {
            return;
          }

          io.to(receiverSocketId).emit(
            "typing:stop",
            {
              conversationId:
                String(conversationId),
              userId,
            }
          );
        } catch (error) {
          console.error(
            "TYPING STOP ERROR:",
            error
          );
        }
      }
    );

    socket.on(
      "message:seen",
      ({
        conversationId,
        messageId,
        senderId,
      }) => {
        try {
          if (
            !conversationId ||
            !senderId
          ) {
            return;
          }

          const senderSocketId =
            io.connectedUsers.get(
              String(senderId)
            );

          if (!senderSocketId) {
            return;
          }

          io.to(senderSocketId).emit(
            "message:seen",
            {
              conversationId:
                String(conversationId),
              messageId:
                messageId
                  ? String(messageId)
                  : null,
              seenBy: userId,
            }
          );
        } catch (error) {
          console.error(
            "MESSAGE SEEN ERROR:",
            error
          );
        }
      }
    );

    registerCallSocket(
      io,
      socket
    );

    registerLiveSocket(
      io,
      socket
    );

    socket.on(
      "user:join",
      ({ userId: requestedUserId }) => {
        try {
          const targetUserId =
            requestedUserId ||
            socket.userId;

          if (!targetUserId) {
            return;
          }

          socket.join(
            `user:${String(
              targetUserId
            )}`
          );
        } catch (error) {
          console.error(
            "USER JOIN ERROR:",
            error
          );
        }
      }
    );

    socket.on(
      "disconnect",
      (reason) => {
        try {
          
          if (userId) {
            const currentSocketId =
              io.connectedUsers.get(
                userId
              );

            if (
              currentSocketId ===
              socket.id
            ) {
              io.connectedUsers.delete(
                userId
              );

              socket.broadcast.emit(
                "user:status",
                {
                  userId,
                  online: false,
                  status: "offline",
                }
              );
            }
          }

          console.log(
            `Socket disconnected: ${socket.id} | User: ${userId} | Reason: ${reason}`
          );
        } catch (error) {
          console.error(
            "SOCKET DISCONNECT ERROR:",
            error
          );
        }
      }
    );
  });

  console.log(
    "Socket.IO initialized successfully"
  );

  return io;
}

module.exports = {
  initializeSocket,
};