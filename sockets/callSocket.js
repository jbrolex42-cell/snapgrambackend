const Call = require("../models/Call");

const {
  isParticipant,
  calculateDuration,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
} = require("../controllers/callController");

function normalizeId(value) {
  if (!value) {
    return null;
  }

  return String(value);
}

function getSocketUserId(socket) {
  return normalizeId(
    socket?.userId ||
      socket?.user?._id ||
      socket?.user?.id
  );
}

function getUserRoom(userId) {
  return `user:${String(userId)}`;
}

function emitToUser(io, userId, event, payload) {
  if (!userId) {
    return;
  }

  io.to(getUserRoom(userId)).emit(
    event,
    payload
  );
}

async function getAuthorizedCall(
  callId,
  userId
) {
  if (!callId || !userId) {
    return null;
  }

  const call = await Call.findById(callId);

  if (!call) {
    return null;
  }

  if (!isParticipant(call, userId)) {
    return null;
  }

  return call;
}

function getOtherParticipant(
  call,
  userId
) {
  if (!call) {
    return null;
  }

  const currentId = normalizeId(userId);

  if (
    normalizeId(call.caller) === currentId
  ) {
    return normalizeId(call.receiver);
  }

  if (
    normalizeId(call.receiver) === currentId
  ) {
    return normalizeId(call.caller);
  }

  if (Array.isArray(call.participants)) {
    return (
      call.participants
        .map(normalizeId)
        .find(
          (id) => id !== currentId
        ) || null
    );
  }

  return null;
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id || user.id),
    fullName:
      user.fullName ||
      user.username ||
      "Snapgram User",
    username:
      user.username || "",
    avatar:
      user.avatar || "",
    isVerified:
      Boolean(user.isVerified),
  };
}

async function populateCall(call) {
  if (!call) {
    return call;
  }

  await call.populate(
    "caller",
    "username fullName avatar isVerified"
  );

  await call.populate(
    "receiver",
    "username fullName avatar isVerified"
  );

  await call.populate(
    "participants",
    "username fullName avatar isVerified"
  );

  return call;
}

function serializeCall(call) {
  if (!call) {
    return null;
  }

  return {
    id: String(call._id),
    callId: String(call._id),

    type: call.type,
    status: call.status,

    caller: publicUser(call.caller),
    receiver: publicUser(call.receiver),

    participants: Array.isArray(
      call.participants
    )
      ? call.participants.map(publicUser)
      : [],

    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
    duration: call.duration || 0,

    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
  };
}

async function transitionCall(
  call,
  status,
  userId
) {
  const currentUserId = normalizeId(userId);

  if (!call) {
    throw new Error("Call not found");
  }

  if (!isParticipant(call, currentUserId)) {
    throw new Error("Not authorized");
  }

  if (TERMINAL_STATUSES.includes(call.status)) {
    if (call.status === status) {
      return call;
    }

    throw new Error(
      "Call has already ended"
    );
  }

  const current = call.status;

  if (status === "accepted") {
    if (
      current !== "calling" &&
      current !== "ringing"
    ) {
      throw new Error(
        `Cannot accept call from ${current}`
      );
    }

    if (
      normalizeId(call.receiver) !==
      currentUserId
    ) {
      throw new Error(
        "Only the receiver can accept the call"
      );
    }

    const now = new Date();

    call.status = "accepted";
    call.answeredAt =
      call.answeredAt || now;

    await call.save();

    return call;
  }

  if (status === "rejected") {
    if (
      current !== "calling" &&
      current !== "ringing"
    ) {
      throw new Error(
        `Cannot reject call from ${current}`
      );
    }

    if (
      normalizeId(call.receiver) !==
      currentUserId
    ) {
      throw new Error(
        "Only the receiver can reject the call"
      );
    }

    call.status = "rejected";
    call.endedAt = new Date();
    call.duration = 0;

    await call.save();

    return call;
  }

  if (status === "cancelled") {
    if (
      current !== "calling" &&
      current !== "ringing"
    ) {
      throw new Error(
        `Cannot cancel call from ${current}`
      );
    }

    if (
      normalizeId(call.caller) !==
      currentUserId
    ) {
      throw new Error(
        "Only the caller can cancel the call"
      );
    }

    call.status = "cancelled";
    call.endedAt = new Date();
    call.duration = 0;

    await call.save();

    return call;
  }

  if (status === "missed") {
    if (
      current !== "calling" &&
      current !== "ringing"
    ) {
      throw new Error(
        `Cannot mark call missed from ${current}`
      );
    }

    call.status = "missed";
    call.endedAt = new Date();
    call.duration = 0;

    await call.save();

    return call;
  }

  if (status === "ended") {
    if (current !== "accepted") {
      throw new Error(
        `Cannot end call from ${current}`
      );
    }

    const endedAt = new Date();

    call.status = "ended";
    call.endedAt = endedAt;

    call.duration = calculateDuration(
      call.answeredAt,
      endedAt
    );

    await call.save();

    return call;
  }

  if (status === "ringing") {
    if (
      current !== "calling"
    ) {
      throw new Error(
        `Cannot mark call ringing from ${current}`
      );
    }

    call.status = "ringing";

    await call.save();

    return call;
  }

  throw new Error(
    `Unsupported call transition: ${current} -> ${status}`
  );
}

function getIncomingPayload(call) {
  return {
    callId: String(call._id),
    type: call.type,
    status: call.status,
    caller: publicUser(call.caller),
    receiver: publicUser(call.receiver),
  };
}

function emitTransition(
  io,
  call,
  previousStatus
) {
  const payload = serializeCall(call);

  const callerId = normalizeId(
    call.caller?._id || call.caller
  );

  const receiverId = normalizeId(
    call.receiver?._id || call.receiver
  );

  if (
    previousStatus === "calling" &&
    call.status === "ringing"
  ) {
    emitToUser(
      io,
      receiverId,
      "call:incoming",
      getIncomingPayload(call)
    );

    return;
  }

  if (call.status === "accepted") {
    emitToUser(
      io,
      callerId,
      "call:accepted",
      payload
    );

    return;
  }

  if (call.status === "rejected") {
    emitToUser(
      io,
      callerId,
      "call:rejected",
      payload
    );

    return;
  }

  if (call.status === "cancelled") {
    emitToUser(
      io,
      receiverId,
      "call:cancelled",
      payload
    );

    return;
  }

  if (call.status === "missed") {
    emitToUser(
      io,
      callerId,
      "call:missed",
      payload
    );

    return;
  }

  if (call.status === "ended") {
    emitToUser(
      io,
      callerId,
      "call:ended",
      payload
    );

    emitToUser(
      io,
      receiverId,
      "call:ended",
      payload
    );
  }
}

function registerCallSocket(io, socket) {
  socket.on(
    "call:initiate",
    async (payload = {}) => {
      try {
        const userId =
          getSocketUserId(socket);

        const callId =
          normalizeId(payload.callId);

        if (!userId || !callId) {
          return;
        }

        let call =
          await getAuthorizedCall(
            callId,
            userId
          );

        if (!call) {
          return;
        }

        if (
          normalizeId(call.caller) !==
          userId
        ) {
          return;
        }

        if (
          !ACTIVE_STATUSES.includes(
            call.status
          )
        ) {
          return;
        }

        const receiverId =
          normalizeId(call.receiver);

        call.status = "ringing";

        await call.save();

        await populateCall(call);

        emitToUser(
          io,
          receiverId,
          "call:incoming",
          getIncomingPayload(call)
        );
      } catch (error) {
        console.error(
          "[SOCKET CALL] initiate:",
          error
        );
      }
    }
  );

  socket.on(
    "call:accept",
    async (payload = {}) => {
      try {
        const userId =
          getSocketUserId(socket);

        const call =
          await getAuthorizedCall(
            normalizeId(payload.callId),
            userId
          );

        if (!call) {
          return;
        }

        const previousStatus =
          call.status;

        const updated =
          await transitionCall(
            call,
            "accepted",
            userId
          );

        await populateCall(updated);

        emitTransition(
          io,
          updated,
          previousStatus
        );

        const callerId =
          normalizeId(
            updated.caller
          );

        emitToUser(
          io,
          callerId,
          "call:ready",
          {
            callId: String(
              updated._id
            ),
          }
        );
      } catch (error) {
        console.error(
          "[SOCKET CALL] accept:",
          error
        );
      }
    }
  );

  socket.on(
    "call:reject",
    async (payload = {}) => {
      try {
        const userId =
          getSocketUserId(socket);

        const call =
          await getAuthorizedCall(
            normalizeId(payload.callId),
            userId
          );

        if (!call) {
          return;
        }

        const previousStatus =
          call.status;

        const updated =
          await transitionCall(
            call,
            "rejected",
            userId
          );

        await populateCall(updated);

        emitTransition(
          io,
          updated,
          previousStatus
        );
      } catch (error) {
        console.error(
          "[SOCKET CALL] reject:",
          error
        );
      }
    }
  );

  socket.on(
    "call:cancel",
    async (payload = {}) => {
      try {
        const userId =
          getSocketUserId(socket);

        const call =
          await getAuthorizedCall(
            normalizeId(payload.callId),
            userId
          );

        if (!call) {
          return;
        }

        const previousStatus =
          call.status;

        const updated =
          await transitionCall(
            call,
            "cancelled",
            userId
          );

        await populateCall(updated);

        emitTransition(
          io,
          updated,
          previousStatus
        );
      } catch (error) {
        console.error(
          "[SOCKET CALL] cancel:",
          error
        );
      }
    }
  );

  socket.on(
    "call:missed",
    async (payload = {}) => {
      try {
        const userId =
          getSocketUserId(socket);

        const call =
          await getAuthorizedCall(
            normalizeId(payload.callId),
            userId
          );

        if (!call) {
          return;
        }

        const previousStatus =
          call.status;

        const updated =
          await transitionCall(
            call,
            "missed",
            userId
          );

        await populateCall(updated);

        emitTransition(
          io,
          updated,
          previousStatus
        );
      } catch (error) {
        console.error(
          "[SOCKET CALL] missed:",
          error
        );
      }
    }
  );

  socket.on(
    "call:end",
    async (payload = {}) => {
      try {
        const userId =
          getSocketUserId(socket);

        const call =
          await getAuthorizedCall(
            normalizeId(payload.callId),
            userId
          );

        if (!call) {
          return;
        }

        const previousStatus =
          call.status;

        const updated =
          await transitionCall(
            call,
            "ended",
            userId
          );

        await populateCall(updated);

        emitTransition(
          io,
          updated,
          previousStatus
        );
      } catch (error) {
        console.error(
          "[SOCKET CALL] end:",
          error
        );
      }
    }
  );

  socket.on(
    "call:ready",
    async (payload = {}) => {
      try {
        const userId =
          getSocketUserId(socket);

        const call =
          await getAuthorizedCall(
            normalizeId(payload.callId),
            userId
          );

        if (!call) {
          return;
        }

        if (call.status !== "accepted") {
          return;
        }

        const targetId =
          getOtherParticipant(
            call,
            userId
          );

        if (!targetId) {
          return;
        }

        emitToUser(
          io,
          targetId,
          "call:ready",
          {
            callId: String(
              call._id
            ),
          }
        );
      } catch (error) {
        console.error(
          "[SOCKET CALL] ready:",
          error
        );
      }
    }
  );

  socket.on(
    "webrtc:offer",
    async (payload = {}) => {
      await forwardWebRTCSignal(
        io,
        socket,
        "webrtc:offer",
        payload
      );
    }
  );

  socket.on(
    "webrtc:answer",
    async (payload = {}) => {
      await forwardWebRTCSignal(
        io,
        socket,
        "webrtc:answer",
        payload
      );
    }
  );

  socket.on(
    "webrtc:ice-candidate",
    async (payload = {}) => {
      await forwardWebRTCSignal(
        io,
        socket,
        "webrtc:ice-candidate",
        payload
      );
    }
  );
}

async function forwardWebRTCSignal(
  io,
  socket,
  event,
  payload
) {
  try {
    const userId =
      getSocketUserId(socket);

    const callId =
      normalizeId(payload.callId);

    if (!userId || !callId) {
      return;
    }

    const call =
      await getAuthorizedCall(
        callId,
        userId
      );

    if (!call) {
      return;
    }

    if (call.status !== "accepted") {
      return;
    }

    const targetUserId =
      getOtherParticipant(
        call,
        userId
      );

    if (!targetUserId) {
      return;
    }

    const signal =
      payload.offer ||
      payload.answer ||
      payload.candidate;

    if (!signal) {
      return;
    }

    emitToUser(
      io,
      targetUserId,
      event,
      {
        callId,

        ...(event === "webrtc:offer"
          ? {
              offer: signal,
            }
          : {}),

        ...(event === "webrtc:answer"
          ? {
              answer: signal,
            }
          : {}),

        ...(event ===
        "webrtc:ice-candidate"
          ? {
              candidate: signal,
            }
          : {}),
      }
    );
  } catch (error) {
    console.error(
      `[SOCKET CALL] ${event}:`,
      error
    );
  }
}

module.exports = {
  registerCallSocket,
};