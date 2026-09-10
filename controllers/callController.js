const mongoose = require("mongoose");
const Call = require("../models/Call");
const startCall = async (req, res) => {
  try {
    const { receiverId, type } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Receiver is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid receiver ID",
      });
    }

    if (!["voice", "video"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid call type",
      });
    }

    if (String(req.user._id) === String(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot call yourself",
      });
    }

    const call = await Call.create({
      caller: req.user._id,
      receiver: receiverId,
      type,
      status: "calling",
    });

    await call.populate("caller", "username fullName avatar isVerified");
    await call.populate("receiver", "username fullName avatar isVerified");

    return res.status(201).json({
      success: true,
      call,
    });
  } catch (error) {
    console.error("START CALL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start call",
    });
  }
};

const updateCall = async (req, res) => {
  try {
    const { callId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(callId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid call ID",
      });
    }

    const allowedStatuses = [
      "calling",
      "ringing",
      "accepted",
      "rejected",
      "ended",
      "missed",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid call status",
      });
    }

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    const userId = String(req.user._id);
    const callerId = String(call.caller);
    const receiverId = String(call.receiver);

    if (userId !== callerId && userId !== receiverId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this call",
      });
    }

    const terminalStatuses = [
      "ended",
      "missed",
      "rejected",
    ];

    if (terminalStatuses.includes(call.status)) {
      return res.status(400).json({
        success: false,
        message: "Call has already ended",
      });
    }

    call.status = status;

    if (status === "accepted") {
      if (!call.answeredAt) {
        call.answeredAt = new Date();
      }

      if (!call.startedAt) {
        call.startedAt = new Date();
      }
    }

    if (status === "ended") {
      call.endedAt = new Date();

      if (call.answeredAt) {
        call.duration = Math.max(
          0,
          Math.floor(
            (call.endedAt.getTime() -
              call.answeredAt.getTime()) /
              1000
          )
        );
      }
    }

    if (
      status === "rejected" ||
      status === "missed"
    ) {
      call.endedAt = new Date();
    }

    await call.save();

    await call.populate("caller", "username fullName avatar isVerified");
    await call.populate("receiver", "username fullName avatar isVerified");

    return res.status(200).json({
      success: true,
      call,
    });
  } catch (error) {
    console.error("UPDATE CALL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update call",
    });
  }
};

const updateCallStatus = async (req, res) => {
  try {
    const { callId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(callId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid call ID",
      });
    }

    const allowedStatuses = [
      "calling",
      "ringing",
      "accepted",
      "rejected",
      "missed",
      "ended",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid call status",
      });
    }

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    const userId = String(req.user._id);
    const callerId = String(call.caller);
    const receiverId = String(call.receiver);

    if (userId !== callerId && userId !== receiverId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this call",
      });
    }

    const terminalStatuses = [
      "ended",
      "missed",
      "rejected",
    ];

    if (terminalStatuses.includes(call.status)) {
      return res.status(400).json({
        success: false,
        message: "Call has already ended",
      });
    }

    call.status = status;

    if (status === "accepted") {
      if (!call.answeredAt) {
        call.answeredAt = new Date();
      }

      if (!call.startedAt) {
        call.startedAt = new Date();
      }
    }

    if (status === "ended") {
      call.endedAt = new Date();

      if (call.answeredAt) {
        call.duration = Math.max(
          0,
          Math.floor(
            (call.endedAt.getTime() -
              call.answeredAt.getTime()) /
              1000
          )
        );
      }
    }

    if (
      status === "rejected" ||
      status === "missed"
    ) {
      call.endedAt = new Date();
    }

    await call.save();

    await call.populate("caller", "username fullName avatar isVerified");
    await call.populate("receiver", "username fullName avatar isVerified");

    return res.status(200).json({
      success: true,
      call,
    });
  } catch (error) {
    console.error(
      "UPDATE CALL STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update call status",
    });
  }
};

const getCallHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const calls = await Call.find({
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
      .populate("caller", "username fullName avatar isVerified")
      .populate("receiver", "username fullName avatar isVerified")
      .populate("participants", "username fullName avatar isVerified")
      .sort({
        createdAt: -1,
      })
      .limit(100);

    return res.status(200).json({
      success: true,
      calls,
    });
  } catch (error) {
    console.error(
      "GET CALL HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load call history",
    });
  }
};

const getTurnCredentials = async (req, res) => {
  try {
    const apiKey = process.env.METERED_API_KEY;

    const meteredDomain =
      process.env.METERED_DOMAIN ||
      "snapgramapp.metered.live";

    if (!apiKey) {
      console.error(
        "METERED_API_KEY is missing from .env"
      );

      return res.status(500).json({
        success: false,
        message: "TURN server is not configured",
      });
    }

    const url =
      `https://${meteredDomain}/api/v1/turn/credentials` +
      `?apiKey=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "METERED TURN API ERROR:",
        response.status,
        errorText
      );

      return res.status(502).json({
        success: false,
        message: "Failed to obtain TURN credentials",
      });
    }

    const iceServers = await response.json();

    if (
      !Array.isArray(iceServers) ||
      iceServers.length === 0
    ) {
      console.error(
        "METERED RETURNED EMPTY ICE SERVERS"
      );

      return res.status(502).json({
        success: false,
        message: "TURN server returned no ICE servers",
      });
    }

    return res.status(200).json({
      success: true,
      iceServers,
    });
  } catch (error) {
    console.error(
      "GET TURN CREDENTIALS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load TURN credentials",
    });
  }
};

const createGroupCall = async (req, res) => {
  try {
    const {
      participantIds,
      type,
    } = req.body;

    if (
      !Array.isArray(participantIds) ||
      participantIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Participants are required",
      });
    }

    const uniqueParticipantIds = [
      ...new Set(
        participantIds.map((id) => String(id))
      ),
    ];

    const invalidParticipant =
      uniqueParticipantIds.some(
        (id) =>
          !mongoose.Types.ObjectId.isValid(id)
      );

    if (invalidParticipant) {
      return res.status(400).json({
        success: false,
        message:
          "One or more participant IDs are invalid",
      });
    }

    const callerId = String(req.user._id);

    const participants = [
      callerId,
      ...uniqueParticipantIds.filter(
        (id) => id !== callerId
      ),
    ];

    if (participants.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "A group call requires at least one other participant",
      });
    }

    const call = await Call.create({
      caller: req.user._id,

      receiver: participants[1],

      participants,

      type:
        type === "video"
          ? "video"
          : "voice",

      status: "ringing",
    });

    const populatedCall =
      await Call.findById(call._id)
        .populate(
          "caller",
          "username fullName avatar isVerified"
        )
        .populate(
          "receiver",
          "username fullName avatar isVerified"
        )
        .populate(
          "participants",
          "username fullName avatar isVerified"
        );

    return res.status(201).json({
      success: true,
      call: populatedCall,
    });
  } catch (error) {
    console.error(
      "CREATE GROUP CALL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create group call",
    });
  }
};

module.exports = {
  startCall,
  updateCall,
  updateCallStatus,
  getCallHistory,
  getTurnCredentials,
  createGroupCall,
};