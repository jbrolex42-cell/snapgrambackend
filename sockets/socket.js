const { Server } = require("socket.io");

const User = require("../models/User");

const registerCallSocket = require("./callSocket");
const registerLiveSocket = require("./liveSocket");

const connectedUsers = new Map();

let ioInstance = null;

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  ioInstance = io;

  io.connectedUsers = connectedUsers;

  io.on("connection", (socket) => {
    console.log(
      "Snapgram user connected:",
      socket.id
    );

    registerCallSocket(io, socket);

    registerLiveSocket(io, socket);

    socket.on(
      "user:online",
      async (userId) => {
        if (!userId) {
          return;
        }

        const id = String(userId);

        const previousSocketId =
          connectedUsers.get(id);

        connectedUsers.set(
          id,
          socket.id
        );

        socket.userId = id;

        try {
          await User.findByIdAndUpdate(
            id,
            {
              isOnline: true,
              lastSeen: null,
            }
          );
        } catch (error) {
          console.error(
            "ONLINE STATUS ERROR:",
            error
          );
        }

        io.emit(
          "user:status",
          {
            userId: id,
            online: true,
            lastSeen: null,
          }
        );

        if (
          previousSocketId &&
          previousSocketId !== socket.id
        ) {
          console.log(
            `Replacing previous socket for user ${id}: ${previousSocketId}`
          );
        }
      }
    );

    socket.on(
      "conversation:join",
      (conversationId) => {
        if (!conversationId) {
          return;
        }

        socket.join(
          `conversation:${conversationId}`
        );
      }
    );

    socket.on(
      "conversation:leave",
      (conversationId) => {
        if (!conversationId) {
          return;
        }

        socket.leave(
          `conversation:${conversationId}`
        );
      }
    );

    socket.on(
      "message:send",
      (message) => {
        if (!message?.conversation) {
          return;
        }

        io.to(
          `conversation:${message.conversation}`
        ).emit(
          "message:new",
          message
        );
      }
    );

    socket.on(
      "message:typing",
      ({
        conversationId,
        userId,
        username,
      }) => {
        if (!conversationId) {
          return;
        }

        socket
          .to(
            `conversation:${conversationId}`
          )
          .emit(
            "message:typing",
            {
              userId,
              username,
            }
          );
      }
    );

    socket.on(
      "message:stopTyping",
      ({
        conversationId,
        userId,
      }) => {
        if (!conversationId) {
          return;
        }

        socket
          .to(
            `conversation:${conversationId}`
          )
          .emit(
            "message:stopTyping",
            {
              userId,
            }
          );
      }
    );

    socket.on(
      "message:seen",
      ({
        conversationId,
        messageId,
        userId,
      }) => {
        if (!conversationId) {
          return;
        }

        socket
          .to(
            `conversation:${conversationId}`
          )
          .emit(
            "message:seen",
            {
              messageId,
              userId,
            }
          );
      }
    );

    socket.on(
      "message:reaction",
      ({
        conversationId,
        messageId,
        reactions,
      }) => {
        if (!conversationId) {
          return;
        }

        socket
          .to(
            `conversation:${conversationId}`
          )
          .emit(
            "message:reaction",
            {
              messageId,
              reactions,
            }
          );
      }
    );

    socket.on(
      "message:unsent",
      ({
        conversationId,
        messageId,
      }) => {
        if (!conversationId) {
          return;
        }

        socket
          .to(
            `conversation:${conversationId}`
          )
          .emit(
            "message:unsent",
            {
              messageId,
            }
          );
      }
    );

    socket.on(
      "message:deleted",
      ({
        conversationId,
        messageId,
      }) => {
        if (!conversationId) {
          return;
        }

        socket
          .to(
            `conversation:${conversationId}`
          )
          .emit(
            "message:deleted",
            {
              messageId,
            }
          );
      }
    );

    socket.on(
      "disconnect",
      async () => {
        const userId = socket.userId;

        if (!userId) {
          console.log(
            "Snapgram user disconnected:",
            socket.id
          );

          return;
        }

        if (
          connectedUsers.get(userId) ===
          socket.id
        ) {
          connectedUsers.delete(userId);

          const lastSeen =
            new Date();

          try {
            await User.findByIdAndUpdate(
              userId,
              {
                isOnline: false,
                lastSeen,
              }
            );
          } catch (error) {
            console.error(
              "OFFLINE STATUS ERROR:",
              error
            );
          }

          io.emit(
            "user:status",
            {
              userId,
              online: false,
              lastSeen,
            }
          );

          console.log(
            "User offline:",
            userId
          );
        }

        console.log(
          "Snapgram user disconnected:",
          socket.id
        );
      }
    );
  });

  return io;
}

function getSocket() {
  return ioInstance;
}

function getUserSocket(userId) {
  return connectedUsers.get(
    String(userId)
  );
}

module.exports = {
  initializeSocket,
  getSocket,
  getUserSocket,
};