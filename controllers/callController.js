const mongoose = require("mongoose");
const Call = require("../models/Call");

const CALL_TYPES = ["voice", "video"];

const CALL_STATUSES = [
  "calling",
  "ringing",
  "accepted",
  "rejected",
  "cancelled",
  "ended",
  "missed",
];

const ACTIVE_STATUSES = [
  "calling",
  "ringing",
  "accepted",
];

const TERMINAL_STATUSES = [
  "rejected",
  "cancelled",
  "ended",
  "missed",
];

const UNANSWERED_CALL_TIMEOUT_MS = 90 * 1000;

const ACCEPTED_CALL_TIMEOUT_MS = 12 * 60 * 60 * 1000;

const USER_FIELDS =
  "username fullName avatar isVerified";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getUserId(req) {
  return (
    req.user?._id?.toString() ||
    req.user?.id?.toString() ||
    req.userId?.toString() ||
    null
  );
}

function isParticipant(call, userId) {
  if (!call || !userId) {
    return false;
  }

  const currentUserId = String(userId);

  if (
    String(call.caller) === currentUserId ||
    String(call.receiver) === currentUserId
  ) {
    return true;
  }

  return (
    Array.isArray(call.participants) &&
    call.participants.some(
      (participant) =>
        String(participant) === currentUserId
    )
  );
}

async function populateCall(call) {
  if (!call) {
    return call;
  }

  await call.populate(
    "caller",
    USER_FIELDS
  );

  await call.populate(
    "receiver",
    USER_FIELDS
  );

  await call.populate(
    "participants",
    USER_FIELDS
  );

  return call;
}

function calculateDuration(
  answeredAt,
  endedAt
) {
  if (!answeredAt || !endedAt) {
    return 0;
  }

  const start = new Date(
    answeredAt
  ).getTime();

  const end = new Date(
    endedAt
  ).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((end - start) / 1000)
  );
}

function isCallStale(call) {
  if (
    !call ||
    !ACTIVE_STATUSES.includes(
      call.status
    )
  ) {
    return false;
  }

  if (
    ["calling", "ringing"].includes(
      call.status
    )
  ) {
    const createdAt = new Date(
      call.createdAt
    ).getTime();

    if (!Number.isFinite(createdAt)) {
      return false;
    }

    return (
      Date.now() - createdAt >
      UNANSWERED_CALL_TIMEOUT_MS
    );
  }

  if (call.status === "accepted") {
    const acceptedAt = call.answeredAt
      ? new Date(
          call.answeredAt
        ).getTime()
      : new Date(
          call.createdAt
        ).getTime();

    if (!Number.isFinite(acceptedAt)) {
      return false;
    }

    return (
      Date.now() - acceptedAt >
      ACCEPTED_CALL_TIMEOUT_MS
    );
  }

  return false;
}

async function expireCall(call) {
  if (!call) {
    return null;
  }

  if (
    ["calling", "ringing"].includes(
      call.status
    )
  ) {
    call.status = "missed";
    call.endedAt = new Date();
    call.duration = 0;

    await call.save();

    console.log(
      `[CALL] Expired unanswered call: ${call._id}`
    );

    return call;
  }

  if (call.status === "accepted") {
    const endedAt = new Date();

    call.status = "ended";
    call.endedAt = endedAt;

    call.duration =
      calculateDuration(
        call.answeredAt,
        endedAt
      );

    await call.save();

    console.log(
      `[CALL] Expired accepted call: ${call._id}`
    );

    return call;
  }

  return call;
}

async function findActiveCallBetweenUsers(
  userA,
  userB
) {
  const calls = await Call.find({
    $or: [
      {
        caller: userA,
        receiver: userB,
      },
      {
        caller: userB,
        receiver: userA,
      },
    ],
    status: {
      $in: ACTIVE_STATUSES,
    },
  }).sort({
    createdAt: -1,
  });

  for (const call of calls) {
    if (isCallStale(call)) {
      await expireCall(call);
      continue;
    }

    return call;
  }

  return null;
}

const startCall = async (req, res) => {
  try {
    const callerId = getUserId(req);

    if (!callerId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const receiverId =
      req.body?.receiverId;

    const type =
      req.body?.type;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver is required",
      });
    }

    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid receiver ID",
      });
    }

    if (!CALL_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid call type. Use voice or video.",
      });
    }

    if (
      String(callerId) ===
      String(receiverId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot call yourself",
      });
    }

    const existingCall =
      await findActiveCallBetweenUsers(
        callerId,
        receiverId
      );

    if (existingCall) {
      await populateCall(existingCall);

      return res.status(409).json({
        success: false,
        message:
          "There is already an active call between these users",
        call: existingCall,
      });
    }

    const call = await Call.create({
      caller: callerId,
      receiver: receiverId,

      type,

      participants: [
        callerId,
        receiverId,
      ],

      status: "calling",

      startedAt: null,
      answeredAt: null,
      endedAt: null,

      duration: 0,
    });

    await populateCall(call);

    console.log(
      "[CALL] Created:",
      call._id.toString()
    );

    return res.status(201).json({
      success: true,
      call,
    });
  } catch (error) {
    console.error(
      "[CALL] START ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to start call",
    });
  }
};

const updateCall = async (
  req,
  res
) => {
  return updateCallStatus(req, res);
};

const updateCallStatus = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const callId =
      req.params?.callId;

    const status =
      req.body?.status;

    if (!isValidObjectId(callId)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid call ID",
      });
    }

    if (
      !CALL_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid call status",
      });
    }

    const call =
      await Call.findById(callId);

    if (!call) {
      return res.status(404).json({
        success: false,
        message:
          "Call not found",
      });
    }

    if (
      !isParticipant(
        call,
        userId
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Not authorized to update this call",
      });
    }

    if (
      TERMINAL_STATUSES.includes(
        call.status
      )
    ) {
      if (
        call.status === status
      ) {
        await populateCall(call);

        return res.status(200).json({
          success: true,
          call,
        });
      }

      return res.status(400).json({
        success: false,
        message:
          "Call has already ended",
      });
    }

    const allowedTransitions = {
      calling: [
        "ringing",
        "accepted",
        "rejected",
        "cancelled",
        "missed",
        "ended",
      ],

      ringing: [
        "accepted",
        "rejected",
        "cancelled",
        "missed",
        "ended",
      ],

      accepted: [
        "ended",
        "cancelled",
      ],
    };

    const allowed =
      allowedTransitions[
        call.status
      ] || [];

    if (
      !allowed.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid call status transition: ${call.status} -> ${status}`,
      });
    }

    if (status === "accepted") {
      const now = new Date();

      call.answeredAt =
        call.answeredAt || now;

      call.startedAt =
        call.startedAt || now;
    }

    if (status === "ended") {
      const endedAt = new Date();

      call.endedAt =
        endedAt;

      call.duration =
        calculateDuration(
          call.answeredAt,
          endedAt
        );
    }

    if (
      [
        "rejected",
        "cancelled",
        "missed",
      ].includes(status)
    ) {
      call.endedAt =
        new Date();

      call.duration = 0;
    }

    call.status = status;

    await call.save();

    await populateCall(call);

    console.log(
      `[CALL] ${callId}: ${status}`
    );

    return res.status(200).json({
      success: true,
      call,
    });
  } catch (error) {
    console.error(
      "[CALL] UPDATE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update call status",
    });
  }
};

const getCall = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const callId =
      req.params?.callId;

    if (!isValidObjectId(callId)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid call ID",
      });
    }

    const call =
      await Call.findById(callId);

    if (!call) {
      return res.status(404).json({
        success: false,
        message:
          "Call not found",
      });
    }

    if (
      !isParticipant(
        call,
        userId
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Not authorized to view this call",
      });
    }

    if (isCallStale(call)) {
      await expireCall(call);
    }

    await populateCall(call);

    return res.status(200).json({
      success: true,
      call,
    });
  } catch (error) {
    console.error(
      "[CALL] GET ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load call",
    });
  }
};

const getCallHistory = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const activeCalls =
      await Call.find({
        $or: [
          {
            caller: userId,
          },
          {
            receiver: userId,
          },
          {
            participants: userId,
          },
        ],

        status: {
          $in: ACTIVE_STATUSES,
        },
      });

    for (const call of activeCalls) {
      if (isCallStale(call)) {
        await expireCall(call);
      }
    }

    const calls =
      await Call.find({
        $or: [
          {
            caller: userId,
          },
          {
            receiver: userId,
          },
          {
            participants: userId,
          },
        ],
      })
        .populate(
          "caller",
          USER_FIELDS
        )
        .populate(
          "receiver",
          USER_FIELDS
        )
        .populate(
          "participants",
          USER_FIELDS
        )
        .sort({
          createdAt: -1,
        })
        .limit(100)
        .lean();

    return res.status(200).json({
      success: true,
      calls,
    });
  } catch (error) {
    console.error(
      "[CALL] HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load call history",
    });
  }
};

const getTurnCredentials = async (
  req,
  res
) => {
  try {
    const apiKey =
      process.env.METERED_API_KEY;

    const meteredDomain =
      process.env.METERED_DOMAIN ||
      "snapgramapp.metered.live";

    if (!apiKey) {
      console.error(
        "[TURN] METERED_API_KEY missing"
      );

      return res.status(500).json({
        success: false,
        message:
          "TURN server is not configured",
      });
    }

    const url =
      `https://${meteredDomain}` +
      `/api/v1/turn/credentials` +
      `?apiKey=${encodeURIComponent(
        apiKey
      )}`;

    const response =
      await fetch(url);

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "[TURN] Metered error:",
        response.status,
        errorText
      );

      return res.status(502).json({
        success: false,
        message:
          "Failed to obtain TURN credentials",
      });
    }

    const iceServers =
      await response.json();

    if (
      !Array.isArray(iceServers) ||
      iceServers.length === 0
    ) {
      return res.status(502).json({
        success: false,
        message:
          "TURN server returned no ICE servers",
      });
    }

    console.log(
      "[TURN] ICE servers:",
      iceServers.length
    );

    return res.status(200).json({
      success: true,
      iceServers,
    });
  } catch (error) {
    console.error(
      "[TURN] ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load TURN credentials",
    });
  }
};

const createGroupCall = async (
  req,
  res
) => {
  try {
    const callerId = getUserId(req);

    if (!callerId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const participantIds =
      req.body?.participantIds;

    const type =
      req.body?.type;

    if (
      !Array.isArray(
        participantIds
      ) ||
      participantIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Participants are required",
      });
    }

    if (!CALL_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid call type",
      });
    }

    const uniqueParticipantIds = [
      ...new Set(
        participantIds.map(
          (id) => String(id)
        )
      ),
    ];

    for (
      const participantId
      of uniqueParticipantIds
    ) {
      if (
        !isValidObjectId(
          participantId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more participant IDs are invalid",
        });
      }
    }

    const participants = [
      String(callerId),
      ...uniqueParticipantIds.filter(
        (id) =>
          id !== String(callerId)
      ),
    ];

    if (
      participants.length < 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A group call requires at least one other participant",
      });
    }

    const call =
      await Call.create({
        caller: callerId,

        receiver:
          participants[1],

        participants,

        type,

        status: "calling",

        startedAt: null,
        answeredAt: null,
        endedAt: null,

        duration: 0,
      });

    await populateCall(call);

    console.log(
      "[CALL] Group created:",
      call._id.toString()
    );

    return res.status(201).json({
      success: true,
      call,
    });
  } catch (error) {
    console.error(
      "[CALL] GROUP ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create group call",
    });
  }
};

module.exports = {
  startCall,
  updateCall,
  updateCallStatus,
  getCall,
  getCallHistory,
  getTurnCredentials,
  createGroupCall,
};