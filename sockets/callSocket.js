const Call = require("../models/Call");

function registerCallSocket(io, socket) {
  socket.on(
    "call:initiate",
    async ({ callId, receiverId, type, caller }) => {
      try {
        if (!callId || !receiverId) {
          return;
        }

        const receiverSocketId = io.connectedUsers?.get(
          String(receiverId)
        );

        if (!receiverSocketId) {
          socket.emit("call:unavailable", {
            callId,
            reason: "User is offline",
          });

          return;
        }

        await Call.findByIdAndUpdate(callId, {
          status: "ringing",
        });

        io.to(receiverSocketId).emit("call:incoming", {
          callId,
          caller,
          type,
        });
      } catch (error) {
        console.error("CALL INITIATE ERROR:", error);
      }
    }
  );

  socket.on(
    "call:accept",
    async ({ callId, callerId }) => {
      try {
        if (!callId || !callerId) {
          return;
        }

        const callerSocketId = io.connectedUsers?.get(
          String(callerId)
        );

        await Call.findByIdAndUpdate(callId, {
          status: "accepted",
          answeredAt: new Date(),
        });

        if (!callerSocketId) {
          return;
        }

        io.to(callerSocketId).emit("call:accepted", {
          callId,
        });
      } catch (error) {
        console.error("CALL ACCEPT ERROR:", error);
      }
    }
  );

  socket.on(
    "call:reject",
    async ({ callId, callerId }) => {
      try {
        if (!callId || !callerId) {
          return;
        }

        await Call.findByIdAndUpdate(callId, {
          status: "rejected",
          endedAt: new Date(),
        });

        const callerSocketId = io.connectedUsers?.get(
          String(callerId)
        );

        if (!callerSocketId) {
          return;
        }

        io.to(callerSocketId).emit("call:rejected", {
          callId,
        });
      } catch (error) {
        console.error("CALL REJECT ERROR:", error);
      }
    }
  );

  socket.on(
    "call:end",
    async ({ callId, otherUserId }) => {
      try {
        if (!callId) {
          return;
        }

        const call = await Call.findById(callId);

        if (!call) {
          return;
        }

        const endedAt = new Date();

        call.status = "ended";
        call.endedAt = endedAt;

        if (call.answeredAt) {
          call.duration = Math.max(
            0,
            Math.floor(
              (endedAt.getTime() -
                new Date(call.answeredAt).getTime()) /
                1000
            )
          );
        }

        await call.save();
        if (otherUserId) {
          const otherSocketId = io.connectedUsers?.get(
            String(otherUserId)
          );

          if (otherSocketId) {
            io.to(otherSocketId).emit("call:ended", {
              callId,
            });
          }
        }
      } catch (error) {
        console.error("CALL END ERROR:", error);
      }
    }
  );

  socket.on(
    "call:missed",
    async ({ callId, callerId }) => {
      try {
        if (!callId || !callerId) {
          return;
        }

        await Call.findByIdAndUpdate(callId, {
          status: "missed",
          endedAt: new Date(),
        });

        const callerSocketId = io.connectedUsers?.get(
          String(callerId)
        );

        if (!callerSocketId) {
          return;
        }

        io.to(callerSocketId).emit("call:missed", {
          callId,
        });
      } catch (error) {
        console.error("MISSED CALL ERROR:", error);
      }
    }
  );

  socket.on(
    "webrtc:offer",
    ({ targetUserId, offer }) => {
      try {
        if (!targetUserId || !offer) {
          return;
        }

        const targetSocketId = io.connectedUsers?.get(
          String(targetUserId)
        );

        if (!targetSocketId) {
          return;
        }

        io.to(targetSocketId).emit("webrtc:offer", {
          offer,
          senderId: socket.userId,
        });
      } catch (error) {
        console.error("WEBRTC OFFER ERROR:", error);
      }
    }
  );

  socket.on(
    "webrtc:answer",
    ({ targetUserId, answer }) => {
      try {
        if (!targetUserId || !answer) {
          return;
        }

        const targetSocketId = io.connectedUsers?.get(
          String(targetUserId)
        );

        if (!targetSocketId) {
          return;
        }

        io.to(targetSocketId).emit("webrtc:answer", {
          answer,
          senderId: socket.userId,
        });
      } catch (error) {
        console.error("WEBRTC ANSWER ERROR:", error);
      }
    }
  );

  socket.on(
    "webrtc:ice-candidate",
    ({ targetUserId, candidate }) => {
      try {
        if (!targetUserId || !candidate) {
          return;
        }

        const targetSocketId = io.connectedUsers?.get(
          String(targetUserId)
        );

        if (!targetSocketId) {
          return;
        }

        io.to(targetSocketId).emit(
          "webrtc:ice-candidate",
          {
            candidate,
            senderId: socket.userId,
          }
        );
      } catch (error) {
        console.error(
          "WEBRTC ICE CANDIDATE ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "group-call:join",
    async ({ callId, userId }) => {
      try {
        if (!callId || !userId) {
          return;
        }

        const call = await Call.findById(callId);

        if (!call) {
          return;
        }

        const participantIds = call.participants.map(
          (id) => String(id)
        );

        if (
          !participantIds.includes(
            String(userId)
          )
        ) {
          return;
        }

        socket.join(`call:${callId}`);

        socket
          .to(`call:${callId}`)
          .emit("group-call:user-joined", {
            userId,
          });
      } catch (error) {
        console.error(
          "GROUP CALL JOIN ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "group-call:leave",
    ({ callId, userId }) => {
      try {
        if (!callId) {
          return;
        }

        socket.leave(`call:${callId}`);

        socket
          .to(`call:${callId}`)
          .emit("group-call:user-left", {
            userId,
          });
      } catch (error) {
        console.error(
          "GROUP CALL LEAVE ERROR:",
          error
        );
      }
    }
  );

  function handleIncomingCall(data) {
    console.log(
      "INCOMING CALL:",
      data
    );
  }

  socket.on(
    "disconnect",
    () => {
      console.log(
        "CALL SOCKET DISCONNECTED:",
        socket.id
      );
    }
  );

  console.log(
    ` Call socket registered: ${socket.id}`
  );
}

module.exports = registerCallSocket;