const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const registerCallSocket = require("./callSocket");
const registerLiveSocket = require("./liveSocket");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

function normalizeId(value) {
  if (!value) {
    return null;
  }

  return String(value);
}

function getUserRoom(userId) {
  return `user:${String(userId)}`;
}

function getConversationRoom(
  conversationId
) {
  return `conversation:${String(
    conversationId
  )}`;
}

function isValidConversationId(
  conversationId
) {
  if (!conversationId) {
    return false;
  }

  return /^[a-f\d]{24}$/i.test(
    String(conversationId)
  );
}

async function isConversationMember(
  conversationId,
  userId
) {
  if (
    !conversationId ||
    !userId
  ) {
    return false;
  }

  if (!isValidConversationId(conversationId)) {
    return false;
  }

  const conversation =
    await Conversation.exists({
      _id: conversationId,
      participants: userId,
    });

  return Boolean(conversation);
}

async function getConversation(
  conversationId,
  userId
) {
  if (
    !conversationId ||
    !userId ||
    !isValidConversationId(conversationId)
  ) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
}

function addSocketToUser(
  io,
  userId,
  socketId
) {
  const normalizedUserId =
    normalizeId(userId);

  if (!normalizedUserId) {
    return;
  }

  if (!io.connectedUsers.has(normalizedUserId)) {
    io.connectedUsers.set(
      normalizedUserId,
      new Set()
    );
  }

  io.connectedUsers
    .get(normalizedUserId)
    .add(socketId);
}

function removeSocketFromUser(
  io,
  userId,
  socketId
) {
  const normalizedUserId =
    normalizeId(userId);

  if (!normalizedUserId) {
    return false;
  }

  const sockets =
    io.connectedUsers.get(
      normalizedUserId
    );

  if (!sockets) {
    return false;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    io.connectedUsers.delete(
      normalizedUserId
    );

    return true;
  }

  return false;
}

function isUserOnline(
  io,
  userId
) {
  const sockets =
    io.connectedUsers.get(
      normalizeId(userId)
    );

  return Boolean(
    sockets &&
      sockets.size > 0
  );
}

function emitToUser(
  io,
  userId,
  event,
  payload
) {
  if (!userId) {
    return;
  }

  io.to(
    getUserRoom(userId)
  ).emit(
    event,
    payload
  );
}

function broadcastUserStatus(
  io,
  userId,
  online
) {
  if (!userId) {
    return;
  }

  io.emit(
    "user:status",
    {
      userId: String(userId),
      online: Boolean(online),
      status: online
        ? "online"
        : "offline",
    }
  );
}

function initializeSocket(server) {
  const io = new Server(
    server,
    {
      cors: {
        origin: true,
        credentials: true,
      },

      transports: [
        "websocket",
        "polling",
      ],
    }
  );

  /*
   * userId -> Set(socketId)
   *
   * This supports:
   * - phone
   * - tablet
   * - desktop
   * - reconnecting sockets
   * - multiple active sessions
   */
  io.connectedUsers =
    new Map();

  /*
   * Authenticate every socket
   * before connection handlers run.
   */
  io.use(
    (socket, next) => {
      try {
        const token =
          socket.handshake?.auth?.token ||
          socket.handshake?.headers?.authorization?.replace(
            /^Bearer\s+/i,
            ""
          );

        if (!token) {
          return next(
            new Error(
              "Authentication token required"
            )
          );
        }

        const decoded =
          jwt.verify(
            token,
            process.env.JWT_SECRET
          );

        const userId =
          decoded?.id ||
          decoded?._id ||
          decoded?.userId;

        if (!userId) {
          return next(
            new Error(
              "Invalid authentication token"
            )
          );
        }

        /*
         * NEVER trust a client-provided userId.
         *
         * Everything important should use
         * socket.userId.
         */
        socket.userId =
          String(userId);

        next();
      } catch (error) {
        console.error(
          "SOCKET AUTH ERROR:",
          error?.message || error
        );

        next(
          new Error(
            "Socket authentication failed"
          )
        );
      }
    }
  );

  io.on(
    "connection",
    (socket) => {
      const userId =
        normalizeId(
          socket.userId
        );

      if (!userId) {
        socket.disconnect(true);
        return;
      }

      console.log(
        `Socket connected: ${socket.id} | User: ${userId}`
      );

      /*
       * Store the socket under the
       * authenticated user.
       */
      addSocketToUser(
        io,
        userId,
        socket.id
      );

      /*
       * Every socket automatically
       * joins its own private user room.
       */
      socket.join(
        getUserRoom(userId)
      );

      socket.io = io;

      /*
       * Only announce online when this
       * was the user's first active socket.
       */
      if (
        io.connectedUsers
          .get(userId)
          ?.size === 1
      ) {
        broadcastUserStatus(
          io,
          userId,
          true
        );
      }

      /*
       * Register call events ONCE.
       */
      registerCallSocket(
        io,
        socket
      );

      /*
       * Register live events ONCE.
       */
      registerLiveSocket(
        io,
        socket
      );

      /*
       * --------------------------------------------------
       * CONVERSATION JOIN
       * --------------------------------------------------
       *
       * Client can request a conversation room,
       * but server verifies membership first.
       */
      socket.on(
        "conversation:join",
        async (payload = {}) => {
          try {
            const conversationId =
              normalizeId(
                payload.conversationId
              );

            if (
              !conversationId
            ) {
              return;
            }

            const member =
              await isConversationMember(
                conversationId,
                userId
              );

            if (!member) {
              socket.emit(
                "conversation:error",
                {
                  conversationId,
                  message:
                    "You are not a member of this conversation.",
                }
              );

              return;
            }

            const room =
              getConversationRoom(
                conversationId
              );

            socket.join(room);

            socket.emit(
              "conversation:joined",
              {
                conversationId,
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

      /*
       * --------------------------------------------------
       * CONVERSATION LEAVE
       * --------------------------------------------------
       */
      socket.on(
        "conversation:leave",
        (payload = {}) => {
          try {
            const conversationId =
              normalizeId(
                payload.conversationId
              );

            if (
              !conversationId
            ) {
              return;
            }

            const room =
              getConversationRoom(
                conversationId
              );

            socket.leave(room);

            socket.emit(
              "conversation:left",
              {
                conversationId,
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

      /*
       * --------------------------------------------------
       * TYPING START
       * --------------------------------------------------
       *
       * The client no longer controls
       * the sender identity.
       *
       * Server gets sender from socket.userId.
       */
      socket.on(
        "typing:start",
        async (payload = {}) => {
          try {
            const conversationId =
              normalizeId(
                payload.conversationId
              );

            if (
              !conversationId
            ) {
              return;
            }

            const conversation =
              await getConversation(
                conversationId,
                userId
              );

            if (!conversation) {
              return;
            }

            const receiverId =
              conversation.participants
                .map(normalizeId)
                .find(
                  (id) =>
                    id !== userId
                );

            if (!receiverId) {
              return;
            }

            emitToUser(
              io,
              receiverId,
              "typing:start",
              {
                conversationId,
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

      /*
       * --------------------------------------------------
       * TYPING STOP
       * --------------------------------------------------
       */
      socket.on(
        "typing:stop",
        async (payload = {}) => {
          try {
            const conversationId =
              normalizeId(
                payload.conversationId
              );

            if (
              !conversationId
            ) {
              return;
            }

            const conversation =
              await getConversation(
                conversationId,
                userId
              );

            if (!conversation) {
              return;
            }

            const receiverId =
              conversation.participants
                .map(normalizeId)
                .find(
                  (id) =>
                    id !== userId
                );

            if (!receiverId) {
              return;
            }

            emitToUser(
              io,
              receiverId,
              "typing:stop",
              {
                conversationId,
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

      /*
       * --------------------------------------------------
       * MESSAGE SEEN
       * --------------------------------------------------
       *
       * No senderId is trusted from the client.
       *
       * The server loads the message,
       * verifies conversation membership,
       * then determines the actual sender.
       */
      socket.on(
        "message:seen",
        async (payload = {}) => {
          try {
            const conversationId =
              normalizeId(
                payload.conversationId
              );

            const messageId =
              normalizeId(
                payload.messageId
              );

            if (
              !conversationId ||
              !messageId
            ) {
              return;
            }

            const conversation =
              await getConversation(
                conversationId,
                userId
              );

            if (!conversation) {
              return;
            }

            const message =
              await Message.findOne({
                _id: messageId,
                conversation:
                  conversationId,
              }).select(
                "sender conversation"
              );

            if (!message) {
              return;
            }

            const senderId =
              normalizeId(
                message.sender
              );

            if (
              !senderId ||
              senderId === userId
            ) {
              return;
            }

            /*
             * The actual read state should
             * ultimately be persisted by the
             * message controller/service.
             *
             * For now this socket event only
             * notifies the sender.
             */
            emitToUser(
              io,
              senderId,
              "message:seen",
              {
                conversationId,
                messageId,
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

      /*
       * --------------------------------------------------
       * USER JOIN
       * --------------------------------------------------
       *
       * Kept for compatibility with the
       * existing mobile client.
       *
       * IMPORTANT:
       * It ignores any requestedUserId.
       *
       * A client can only join its OWN
       * authenticated user room.
       */
      socket.on(
        "user:join",
        () => {
          try {
            socket.join(
              getUserRoom(userId)
            );
          } catch (error) {
            console.error(
              "USER JOIN ERROR:",
              error
            );
          }
        }
      );

      /*
       * --------------------------------------------------
       * DISCONNECT
       * --------------------------------------------------
       */
      socket.on(
        "disconnect",
        (reason) => {
          try {
            const becameOffline =
              removeSocketFromUser(
                io,
                userId,
                socket.id
              );

            /*
             * Only broadcast offline when
             * the user has NO remaining sockets.
             */
            if (becameOffline) {
              broadcastUserStatus(
                io,
                userId,
                false
              );
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
    }
  );

  console.log(
    "Socket.IO initialized successfully"
  );

  return io;
}

module.exports = {
  initializeSocket,
};