const Call = require("../models/Call");

function registerCallSocket(io, socket) {

  function getUserSocket(userId) {
    if (!userId) {
      return null;
    }

    return (
      io.connectedUsers?.get(
        String(userId)
      ) || null
    );
  }

  function emitToUser(
    userId,
    event,
    payload = {}
  ) {
    const socketId =
      getUserSocket(userId);

    if (!socketId) {
      return false;
    }

    io.to(socketId).emit(
      event,
      payload
    );

    return true;
  }

  async function updateCallStatus(
    callId,
    status,
    extra = {}
  ) {
    if (!callId) {
      return null;
    }

    try {
      return await Call.findByIdAndUpdate(
        callId,
        {
          status,
          ...extra,
        },
        {
          new: true,
        }
      );
    } catch (error) {
      console.error(
        "[CALL] DATABASE UPDATE ERROR:",
        error
      );

      return null;
    }
  }

  socket.on(
    "call:initiate",
    async ({
      callId,
      receiverId,
      type,
      caller,
    } = {}) => {
      try {
        if (
          !callId ||
          !receiverId
        ) {
          console.warn(
            "[CALL] Invalid call:initiate payload"
          );

          return;
        }

        const receiverSocketId =
          getUserSocket(
            receiverId
          );

        if (!receiverSocketId) {
          await updateCallStatus(
            callId,
            "missed",
            {
              endedAt:
                new Date(),
            }
          );

          socket.emit(
            "call:unavailable",
            {
              callId:
                String(callId),

              receiverId:
                String(receiverId),

              reason:
                "User is offline",
            }
          );

          return;
        }

        await updateCallStatus(
          callId,
          "ringing"
        );

        console.log(
          "[CALL] INCOMING:",
          {
            callId,
            callerId:
              socket.userId,
            receiverId,
            type:
              type || "voice",
          }
        );

        io.to(
          receiverSocketId
        ).emit(
          "call:incoming",
          {
            callId:
              String(callId),

            caller:
              caller || null,

            callerId:
              String(
                socket.userId || ""
              ),

            type:
              type || "voice",
          }
        );
      } catch (error) {
        console.error(
          "[CALL] INITIATE ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "call:accept",
    async ({
      callId,
      callerId,
    } = {}) => {
      try {
        if (
          !callId ||
          !callerId
        ) {
          return;
        }

        const call =
          await Call.findById(
            callId
          );

        if (!call) {
          console.warn(
            "[CALL] ACCEPT: call not found:",
            callId
          );

          return;
        }

        const now =
          new Date();

        call.status =
          "accepted";

        call.answeredAt =
          now;

        await call.save();

        const callerSocketId =
          getUserSocket(
            callerId
          );

        console.log(
          "[CALL] ACCEPTED:",
          {
            callId,
            callerId,
            receiverId:
              socket.userId,
          }
        );

        if (
          callerSocketId
        ) {
          io.to(
            callerSocketId
          ).emit(
            "call:accepted",
            {
              callId:
                String(callId),

              receiverId:
                String(
                  socket.userId || ""
                ),
            }
          );
        }
      } catch (error) {
        console.error(
          "[CALL] ACCEPT ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "call:ready",
    async ({
      callId,
      targetUserId,
    } = {}) => {
      try {
        if (
          !callId ||
          !targetUserId
        ) {
          return;
        }

        const call =
          await Call.findById(
            callId
          );

        if (!call) {
          console.warn(
            "[CALL] READY: call not found:",
            callId
          );

          return;
        }

        if (
          call.status !==
          "accepted"
        ) {
          console.warn(
            "[CALL] READY ignored because call status is:",
            call.status
          );

          return;
        }

        console.log(
          "[CALL] WEBRTC READY:",
          {
            callId,
            from:
              socket.userId,
            to:
              targetUserId,
          }
        );

        emitToUser(
          targetUserId,
          "call:ready",
          {
            callId:
              String(callId),

            senderId:
              String(
                socket.userId || ""
              ),
          }
        );
      } catch (error) {
        console.error(
          "[CALL] READY ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "call:reject",
    async ({
      callId,
      callerId,
    } = {}) => {
      try {
        if (
          !callId ||
          !callerId
        ) {
          return;
        }

        await updateCallStatus(
          callId,
          "rejected",
          {
            endedAt:
              new Date(),
          }
        );

        console.log(
          "[CALL] REJECTED:",
          {
            callId,
            callerId,
            rejectedBy:
              socket.userId,
          }
        );

        emitToUser(
          callerId,
          "call:rejected",
          {
            callId:
              String(callId),

            userId:
              String(
                socket.userId || ""
              ),
          }
        );
      } catch (error) {
        console.error(
          "[CALL] REJECT ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "call:cancel",
    async ({
      callId,
      otherUserId,
    } = {}) => {
      try {
        if (!callId) {
          return;
        }

        const call =
          await Call.findById(
            callId
          );

        if (!call) {
          return;
        }

        if (
          [
            "ended",
            "rejected",
            "missed",
          ].includes(
            call.status
          )
        ) {
          return;
        }

        await updateCallStatus(
          callId,
          "cancelled",
          {
            endedAt:
              new Date(),
          }
        );

        console.log(
          "[CALL] CANCELLED:",
          {
            callId,
            callerId:
              socket.userId,
            otherUserId,
          }
        );

        if (
          otherUserId
        ) {
          emitToUser(
            otherUserId,
            "call:cancelled",
            {
              callId:
                String(callId),

              userId:
                String(
                  socket.userId || ""
                ),
            }
          );
        }
      } catch (error) {
        console.error(
          "[CALL] CANCEL ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "call:end",
    async ({
      callId,
      otherUserId,
    } = {}) => {
      try {
        if (!callId) {
          return;
        }

        const call =
          await Call.findById(
            callId
          );

        if (!call) {
          return;
        }

        if (
          call.status ===
          "ended"
        ) {
          return;
        }

        const endedAt =
          new Date();

        call.status =
          "ended";

        call.endedAt =
          endedAt;

        if (
          call.answeredAt
        ) {
          call.duration =
            Math.max(
              0,
              Math.floor(
                (
                  endedAt.getTime() -
                  new Date(
                    call.answeredAt
                  ).getTime()
                ) / 1000
              )
            );
        }

        await call.save();

        console.log(
          "[CALL] ENDED:",
          {
            callId,
            endedBy:
              socket.userId,
            otherUserId,
            duration:
              call.duration,
          }
        );

        if (
          otherUserId
        ) {
          emitToUser(
            otherUserId,
            "call:ended",
            {
              callId:
                String(callId),

              userId:
                String(
                  socket.userId || ""
                ),
            }
          );
        }
      } catch (error) {
        console.error(
          "[CALL] END ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "call:missed",
    async ({
      callId,
      callerId,
    } = {}) => {
      try {
        if (
          !callId ||
          !callerId
        ) {
          return;
        }

        await updateCallStatus(
          callId,
          "missed",
          {
            endedAt:
              new Date(),
          }
        );

        console.log(
          "[CALL] MISSED:",
          {
            callId,
            callerId,
          }
        );

        emitToUser(
          callerId,
          "call:missed",
          {
            callId:
              String(callId),

            userId:
              String(
                socket.userId || ""
              ),
          }
        );
      } catch (error) {
        console.error(
          "[CALL] MISSED ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "webrtc:offer",
    ({
      callId,
      targetUserId,
      offer,
    } = {}) => {
      try {
        if (
          !callId ||
          !targetUserId ||
          !offer
        ) {
          return;
        }

        const targetSocketId =
          getUserSocket(
            targetUserId
          );

        if (!targetSocketId) {
          console.warn(
            "[WEBRTC] OFFER target offline:",
            targetUserId
          );

          return;
        }

        console.log(
          "[WEBRTC] OFFER:",
          {
            callId,
            from:
              socket.userId,
            to:
              targetUserId,
          }
        );

        io.to(
          targetSocketId
        ).emit(
          "webrtc:offer",
          {
            callId:
              String(callId),

            offer,

            senderId:
              String(
                socket.userId || ""
              ),
          }
        );
      } catch (error) {
        console.error(
          "[WEBRTC] OFFER ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "webrtc:answer",
    ({
      callId,
      targetUserId,
      answer,
    } = {}) => {
      try {
        if (
          !callId ||
          !targetUserId ||
          !answer
        ) {
          return;
        }

        const targetSocketId =
          getUserSocket(
            targetUserId
          );

        if (!targetSocketId) {
          console.warn(
            "[WEBRTC] ANSWER target offline:",
            targetUserId
          );

          return;
        }

        console.log(
          "[WEBRTC] ANSWER:",
          {
            callId,
            from:
              socket.userId,
            to:
              targetUserId,
          }
        );

        io.to(
          targetSocketId
        ).emit(
          "webrtc:answer",
          {
            callId:
              String(callId),

            answer,

            senderId:
              String(
                socket.userId || ""
              ),
          }
        );
      } catch (error) {
        console.error(
          "[WEBRTC] ANSWER ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "webrtc:ice-candidate",
    ({
      callId,
      targetUserId,
      candidate,
    } = {}) => {
      try {
        if (
          !callId ||
          !targetUserId ||
          !candidate
        ) {
          return;
        }

        const targetSocketId =
          getUserSocket(
            targetUserId
          );

        if (!targetSocketId) {
          return;
        }

        io.to(
          targetSocketId
        ).emit(
          "webrtc:ice-candidate",
          {
            callId:
              String(callId),

            candidate,

            senderId:
              String(
                socket.userId || ""
              ),
          }
        );
      } catch (error) {
        console.error(
          "[WEBRTC] ICE ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "group-call:join",
    async ({
      callId,
      userId,
    } = {}) => {
      try {
        if (
          !callId ||
          !userId
        ) {
          return;
        }

        const call =
          await Call.findById(
            callId
          );

        if (!call) {
          return;
        }

        const participantIds =
          Array.isArray(
            call.participants
          )
            ? call.participants.map(
                (id) =>
                  String(id)
              )
            : [];

        if (
          !participantIds.includes(
            String(userId)
          )
        ) {
          return;
        }

        socket.join(
          `call:${callId}`
        );

        socket
          .to(`call:${callId}`)
          .emit(
            "group-call:user-joined",
            {
              userId:
                String(userId),
            }
          );
      } catch (error) {
        console.error(
          "[GROUP CALL] JOIN ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "group-call:leave",
    ({
      callId,
      userId,
    } = {}) => {
      try {
        if (!callId) {
          return;
        }

        socket.leave(
          `call:${callId}`
        );

        socket
          .to(`call:${callId}`)
          .emit(
            "group-call:user-left",
            {
              userId:
                userId
                  ? String(userId)
                  : String(
                      socket.userId ||
                        ""
                    ),
            }
          );
      } catch (error) {
        console.error(
          "[GROUP CALL] LEAVE ERROR:",
          error
        );
      }
    }
  );

  socket.on(
    "disconnect",
    (reason) => {
      console.log(
        "[CALL SOCKET] DISCONNECTED:",
        {
          socketId:
            socket.id,

          userId:
            socket.userId,

          reason,
        }
      );
    }
  );

  console.log(
    `[CALL SOCKET] REGISTERED: ${socket.id}`
  );
}

module.exports =
  registerCallSocket;