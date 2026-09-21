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

  if (
    typeof value === "object" &&
    value._id
  ) {
    return String(value._id);
  }

  return String(value);
}

function getSocketUserId(socket) {
  return (
    normalizeId(socket?.userId) ||
    normalizeId(socket?.user?._id) ||
    normalizeId(socket?.user?.id)
  );
}

function userRoom(userId) {
  return `user:${String(userId)}`;
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

  io.to(userRoom(userId)).emit(
    event,
    payload
  );
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: normalizeId(
      user._id || user.id
    ),
    fullName: user.fullName || "",
    username: user.username || "",
    avatar: user.avatar || null,
    isVerified: Boolean(
      user.isVerified
    ),
  };
}

function serializeCall(call) {
  if (!call) {
    return null;
  }

  return {
    id: normalizeId(call._id),

    caller: publicUser(
      call.caller
    ),

    receiver: publicUser(
      call.receiver
    ),

    participants:
      Array.isArray(
        call.participants
      )
        ? call.participants.map(
            publicUser
          )
        : [],

    type: call.type,
    status: call.status,

    createdAt: call.createdAt,
    updatedAt: call.updatedAt,

    startedAt: call.startedAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,

    duration: Number(
      call.duration || 0
    ),
  };
}

async function populateCall(call) {
  if (!call) {
    return null;
  }

  await call.populate([
    {
      path: "caller",
      select:
        "username fullName avatar isVerified",
    },
    {
      path: "receiver",
      select:
        "username fullName avatar isVerified",
    },
    {
      path: "participants",
      select:
        "username fullName avatar isVerified",
    },
  ]);

  return call;
}

async function getAuthorizedCall(
  socket,
  callId
) {
  const userId =
    getSocketUserId(socket);

  if (!userId || !callId) {
    throw new Error(
      "Invalid call request."
    );
  }

  const call =
    await Call.findById(callId);

  if (!call) {
    throw new Error(
      "Call not found."
    );
  }

  if (
    !isParticipant(
      call,
      userId
    )
  ) {
    throw new Error(
      "You are not a participant in this call."
    );
  }

  return call;
}

function getCallerId(call) {
  return normalizeId(
    call?.caller
  );
}

function getReceiverId(call) {
  return normalizeId(
    call?.receiver
  );
}

function isCaller(
  call,
  userId
) {
  return (
    getCallerId(call) ===
    String(userId)
  );
}

function isReceiver(
  call,
  userId
) {
  return (
    getReceiverId(call) ===
    String(userId)
  );
}

function getOtherParticipant(
  call,
  userId
) {
  const currentUserId =
    String(userId);

  const callerId =
    getCallerId(call);

  const receiverId =
    getReceiverId(call);

  if (
    callerId &&
    callerId !== currentUserId
  ) {
    return callerId;
  }

  if (
    receiverId &&
    receiverId !== currentUserId
  ) {
    return receiverId;
  }

  if (
    Array.isArray(
      call?.participants
    )
  ) {
    for (
      const participant of
        call.participants
    ) {
      const participantId =
        normalizeId(
          participant
        );

      if (
        participantId &&
        participantId !==
          currentUserId
      ) {
        return participantId;
      }
    }
  }

  return null;
}

function emitError(
  socket,
  message
) {
  socket.emit(
    "call:error",
    {
      message:
        message ||
        "Call request failed.",
    }
  );
}

async function transitionCall(
  call,
  nextStatus,
  actorId
) {
  const currentStatus =
    call.status;

  if (
    TERMINAL_STATUSES.includes(
      currentStatus
    )
  ) {
    if (
      currentStatus ===
      nextStatus
    ) {
      return call;
    }

    throw new Error(
      `Call is already ${currentStatus}.`
    );
  }

  const actor =
    String(actorId);

  switch (nextStatus) {
    case "ringing": {
      if (
        !isCaller(
          call,
          actor
        )
      ) {
        throw new Error(
          "Only the caller can start ringing."
        );
      }

      if (
        currentStatus !==
        "calling"
      ) {
        throw new Error(
          "Call is no longer waiting to ring."
        );
      }

      call.status =
        "ringing";

      break;
    }

    case "accepted": {
      if (
        !isReceiver(
          call,
          actor
        )
      ) {
        throw new Error(
          "Only the receiver can accept the call."
        );
      }

      if (
        ![
          "calling",
          "ringing",
        ].includes(
          currentStatus
        )
      ) {
        throw new Error(
          "This call can no longer be accepted."
        );
      }

      const now =
        new Date();

      call.status =
        "accepted";

      call.answeredAt =
        call.answeredAt ||
        now;

      call.startedAt =
        call.startedAt ||
        now;

      break;
    }

    case "rejected": {
      if (
        !isReceiver(
          call,
          actor
        )
      ) {
        throw new Error(
          "Only the receiver can reject the call."
        );
      }

      if (
        ![
          "calling",
          "ringing",
        ].includes(
          currentStatus
        )
      ) {
        throw new Error(
          "This call can no longer be rejected."
        );
      }

      call.status =
        "rejected";

      call.endedAt =
        new Date();

      call.duration =
        calculateDuration(
          call
        );

      break;
    }

    case "cancelled": {
      if (
        !isCaller(
          call,
          actor
        )
      ) {
        throw new Error(
          "Only the caller can cancel the call."
        );
      }

      if (
        ![
          "calling",
          "ringing",
        ].includes(
          currentStatus
        )
      ) {
        throw new Error(
          "This call can no longer be cancelled."
        );
      }

      call.status =
        "cancelled";

      call.endedAt =
        new Date();

      call.duration =
        calculateDuration(
          call
        );

      break;
    }

    case "missed": {
      if (
        !isReceiver(
          call,
          actor
        )
      ) {
        throw new Error(
          "Only the receiver can mark a call as missed."
        );
      }

      if (
        ![
          "calling",
          "ringing",
        ].includes(
          currentStatus
        )
      ) {
        throw new Error(
          "This call can no longer be marked missed."
        );
      }

      call.status =
        "missed";

      call.endedAt =
        new Date();

      call.duration = 0;

      break;
    }

    case "ended": {
      if (
        !isParticipant(
          call,
          actor
        )
      ) {
        throw new Error(
          "You are not a participant in this call."
        );
      }

      if (
        currentStatus !==
        "accepted"
      ) {
        throw new Error(
          "Only an accepted call can be ended."
        );
      }

      call.status =
        "ended";

      call.endedAt =
        new Date();

      call.duration =
        calculateDuration(
          call
        );

      break;
    }

    default:
      throw new Error(
        "Invalid call status."
      );
  }

  await call.save();

  return call;
}

async function emitIncoming(
  io,
  call
) {
  await populateCall(call);

  const receiverId =
    getReceiverId(call);

  if (!receiverId) {
    return;
  }

  emitToUser(
    io,
    receiverId,
    "call:incoming",
    {
      call: serializeCall(
        call
      ),
    }
  );
}

async function emitAccepted(
  io,
  call
) {
  await populateCall(call);

  const callerId =
    getCallerId(call);

  if (!callerId) {
    return;
  }

  emitToUser(
    io,
    callerId,
    "call:accepted",
    {
      call: serializeCall(
        call
      ),
    }
  );
}

async function emitRejected(
  io,
  call
) {
  await populateCall(call);

  const callerId =
    getCallerId(call);

  if (!callerId) {
    return;
  }

  emitToUser(
    io,
    callerId,
    "call:rejected",
    {
      call: serializeCall(
        call
      ),
    }
  );
}

async function emitCancelled(
  io,
  call
) {
  await populateCall(call);

  const receiverId =
    getReceiverId(call);

  if (!receiverId) {
    return;
  }

  emitToUser(
    io,
    receiverId,
    "call:cancelled",
    {
      call: serializeCall(
        call
      ),
    }
  );
}

async function emitMissed(
  io,
  call
) {
  await populateCall(call);

  const callerId =
    getCallerId(call);

  if (!callerId) {
    return;
  }

  emitToUser(
    io,
    callerId,
    "call:missed",
    {
      call: serializeCall(
        call
      ),
    }
  );
}

async function emitEnded(
  io,
  call
) {
  await populateCall(call);

  const payload = {
    call: serializeCall(
      call
    ),
  };

  const callerId =
    getCallerId(call);

  const receiverId =
    getReceiverId(call);

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

async function handleCallInitiate(
  io,
  socket,
  data = {}
) {
  const userId =
    getSocketUserId(socket);

  const callId =
    normalizeId(
      data.callId
    );

  if (!userId || !callId) {
    throw new Error(
      "Call ID is required."
    );
  }

  const call =
    await getAuthorizedCall(
      socket,
      callId
    );

  if (
    !isCaller(
      call,
      userId
    )
  ) {
    throw new Error(
      "Only the caller can initiate this call."
    );
  }

  if (
    !ACTIVE_STATUSES.includes(
      call.status
    )
  ) {
    throw new Error(
      "This call is no longer active."
    );
  }

  if (
    call.status ===
    "calling"
  ) {
    await transitionCall(
      call,
      "ringing",
      userId
    );
  }

  await emitIncoming(
    io,
    call
  );
}

async function handleCallAccept(
  io,
  socket,
  data = {}
) {
  const userId =
    getSocketUserId(socket);

  const call =
    await getAuthorizedCall(
      socket,
      data.callId
    );

  await transitionCall(
    call,
    "accepted",
    userId
  );

  await emitAccepted(
    io,
    call
  );
}

async function handleCallReject(
  io,
  socket,
  data = {}
) {
  const userId =
    getSocketUserId(socket);

  const call =
    await getAuthorizedCall(
      socket,
      data.callId
    );

  await transitionCall(
    call,
    "rejected",
    userId
  );

  await emitRejected(
    io,
    call
  );
}

async function handleCallCancel(
  io,
  socket,
  data = {}
) {
  const userId =
    getSocketUserId(socket);

  const call =
    await getAuthorizedCall(
      socket,
      data.callId
    );

  await transitionCall(
    call,
    "cancelled",
    userId
  );

  await emitCancelled(
    io,
    call
  );
}

async function handleCallMissed(
  io,
  socket,
  data = {}
) {
  const userId =
    getSocketUserId(socket);

  const call =
    await getAuthorizedCall(
      socket,
      data.callId
    );

  await transitionCall(
    call,
    "missed",
    userId
  );

  await emitMissed(
    io,
    call
  );
}

async function handleCallEnd(
  io,
  socket,
  data = {}
) {
  const userId =
    getSocketUserId(socket);

  const call =
    await getAuthorizedCall(
      socket,
      data.callId
    );

  await transitionCall(
    call,
    "ended",
    userId
  );

  await emitEnded(
    io,
    call
  );
}

async function handleCallReady(
  io,
  socket,
  data = {}
) {
  const userId =
    getSocketUserId(socket);

  const callId =
    normalizeId(
      data.callId
    );

  if (!userId || !callId) {
    throw new Error(
      "Call ID is required."
    );
  }

  const call =
    await getAuthorizedCall(
      socket,
      callId
    );

  if (
    call.status !==
    "accepted"
  ) {
    throw new Error(
      "Call is not accepted."
    );
  }

  const targetUserId =
    getOtherParticipant(
      call,
      userId
    );

  if (!targetUserId) {
    throw new Error(
      "Remote participant could not be found."
    );
  }

  emitToUser(
    io,
    targetUserId,
    "call:ready",
    {
      callId,
      userId,
    }
  );
}

async function forwardWebRTCSignal(
  io,
  socket,
  eventName,
  data = {}
) {
  const userId =
    getSocketUserId(socket);

  const callId =
    normalizeId(
      data.callId
    );

  if (!userId || !callId) {
    throw new Error(
      "Call ID is required."
    );
  }

  const call =
    await getAuthorizedCall(
      socket,
      callId
    );

  if (
    call.status !==
    "accepted"
  ) {
    throw new Error(
      "WebRTC signaling is only allowed on accepted calls."
    );
  }

  const targetUserId =
    getOtherParticipant(
      call,
      userId
    );

  if (!targetUserId) {
    throw new Error(
      "Remote participant could not be found."
    );
  }

  const payload = {
    ...data,
    callId,
    fromUserId: userId,
  };

  emitToUser(
    io,
    targetUserId,
    eventName,
    payload
  );
}

function registerCallSocket(
  io,
  socket
) {
  socket.on(
    "call:initiate",
    async (data, ack) => {
      try {
        await handleCallInitiate(
          io,
          socket,
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[CALL] initiate error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "call:accept",
    async (data, ack) => {
      try {
        await handleCallAccept(
          io,
          socket,
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[CALL] accept error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "call:reject",
    async (data, ack) => {
      try {
        await handleCallReject(
          io,
          socket,
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[CALL] reject error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "call:cancel",
    async (data, ack) => {
      try {
        await handleCallCancel(
          io,
          socket,
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[CALL] cancel error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "call:missed",
    async (data, ack) => {
      try {
        await handleCallMissed(
          io,
          socket,
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[CALL] missed error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "call:end",
    async (data, ack) => {
      try {
        await handleCallEnd(
          io,
          socket,
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[CALL] end error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "call:ready",
    async (data, ack) => {
      try {
        await handleCallReady(
          io,
          socket,
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[CALL] ready error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "webrtc:offer",
    async (data, ack) => {
      try {
        await forwardWebRTCSignal(
          io,
          socket,
          "webrtc:offer",
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[WEBRTC] offer error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "webrtc:answer",
    async (data, ack) => {
      try {
        await forwardWebRTCSignal(
          io,
          socket,
          "webrtc:answer",
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[WEBRTC] answer error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  socket.on(
    "webrtc:ice-candidate",
    async (data, ack) => {
      try {
        await forwardWebRTCSignal(
          io,
          socket,
          "webrtc:ice-candidate",
          data
        );

        ack?.({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[WEBRTC] ICE error:",
          error
        );

        emitError(
          socket,
          error.message
        );

        ack?.({
          ok: false,
          error: error.message,
        });
      }
    }
  );

  console.log(
    `Call socket registered: ${socket.id}`
  );
}

module.exports = registerCallSocket;