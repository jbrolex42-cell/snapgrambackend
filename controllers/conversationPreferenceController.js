const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const ConversationPreference = require("../models/ConversationPreference");

function getUserId(req) {
  return (
    req.user?._id?.toString() ||
    req.user?.id?.toString() ||
    req.userId?.toString() ||
    null
  );
}

function isValidObjectId(value) {
  return Boolean(value) && mongoose.Types.ObjectId.isValid(value);
}

function getConversationId(req) {
  return (
    req.params?.conversationId ||
    req.body?.conversationId ||
    null
  );
}

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendError(res, error, fallbackMessage) {
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

async function getUserConversation(req) {
  const userId = getUserId(req);
  const conversationId = getConversationId(req);

  if (!userId) {
    throw createError("Authentication required", 401);
  }

  if (!conversationId || !isValidObjectId(conversationId)) {
    throw createError(
      "Valid conversationId is required",
      400
    );
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  })
    .populate({
      path: "participants",
      select:
        "_id username fullName avatar isVerified isOnline lastSeen",
    })
    .lean();

  if (!conversation) {
    throw createError(
      "Conversation not found or you are not a participant",
      404
    );
  }

  return {
    userId,
    conversationId,
    conversation,
  };
}

function serializePreference(preference) {
  if (!preference) {
    return {
      mutedUntil: null,
      muted: false,
      restricted: false,
      theme: "default",
      nickname: "",
      disappearingDuration: 0,
    };
  }

  const mutedUntil = preference.mutedUntil
    ? new Date(preference.mutedUntil)
    : null;

  const muted =
    Boolean(mutedUntil) &&
    mutedUntil.getTime() > Date.now();

  return {
    _id: preference._id,
    conversation: preference.conversation,
    user: preference.user,

    mutedUntil,
    muted,

    restricted: Boolean(preference.restricted),

    theme: preference.theme || "default",

    nickname: preference.nickname || "",

    disappearingDuration:
      Number(preference.disappearingDuration) || 0,

    createdAt: preference.createdAt,
    updatedAt: preference.updatedAt,
  };
}

async function getOrCreatePreference(
  conversationId,
  userId
) {
  return ConversationPreference.findOneAndUpdate(
    {
      conversation: conversationId,
      user: userId,
    },
    {
      $setOnInsert: {
        conversation: conversationId,
        user: userId,
        mutedUntil: null,
        restricted: false,
        theme: "default",
        nickname: "",
        disappearingDuration: 0,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

exports.getConversationPreferences = async (req, res) => {
  try {
    const { userId, conversationId } =
      await getUserConversation(req);

    const preference = await getOrCreatePreference(
      conversationId,
      userId
    );

    return res.status(200).json({
      success: true,
      preferences: serializePreference(preference),
    });
  } catch (error) {
    console.error(
      "[CONVERSATION PREFERENCE] Get error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to load conversation preferences."
    );
  }
};

exports.updateMute = async (req, res) => {
  try {
    const { userId, conversationId } =
      await getUserConversation(req);

    const { duration } = req.body || {};

    let mutedUntil = null;

    if (
      duration === null ||
      duration === false ||
      duration === "off"
    ) {
      mutedUntil = null;
    } else {
      const numericDuration = Number(duration);

      if (numericDuration === 0) {
        mutedUntil = new Date(
          "9999-12-31T23:59:59.999Z"
        );
      } else if (
        [3600, 28800, 86400].includes(
          numericDuration
        )
      ) {
        mutedUntil = new Date(
          Date.now() + numericDuration * 1000
        );
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Invalid mute duration. Use 3600, 28800, 86400, 0, or null.",
        });
      }
    }

    const preference = await getOrCreatePreference(
      conversationId,
      userId
    );

    preference.mutedUntil = mutedUntil;

    await preference.save();

    return res.status(200).json({
      success: true,
      preferences: serializePreference(preference),
    });
  } catch (error) {
    console.error(
      "[CONVERSATION PREFERENCE] Mute error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to update mute settings."
    );
  }
};

exports.updateRestriction = async (req, res) => {
  try {
    const { userId, conversationId } =
      await getUserConversation(req);

    const { restricted } = req.body || {};

    if (typeof restricted !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "restricted must be a boolean.",
      });
    }

    const preference = await getOrCreatePreference(
      conversationId,
      userId
    );

    preference.restricted = restricted;

    await preference.save();

    return res.status(200).json({
      success: true,
      preferences: serializePreference(preference),
    });
  } catch (error) {
    console.error(
      "[CONVERSATION PREFERENCE] Restrict error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to update restriction."
    );
  }
};

exports.updateTheme = async (req, res) => {
  try {
    const { userId, conversationId } =
      await getUserConversation(req);

    const theme = String(
      req.body?.theme || ""
    ).trim();

    if (!theme) {
      return res.status(400).json({
        success: false,
        message: "Theme is required.",
      });
    }

    if (theme.length > 50) {
      return res.status(400).json({
        success: false,
        message:
          "Theme cannot exceed 50 characters.",
      });
    }

    const preference = await getOrCreatePreference(
      conversationId,
      userId
    );

    preference.theme = theme;

    await preference.save();

    return res.status(200).json({
      success: true,
      preferences: serializePreference(preference),
    });
  } catch (error) {
    console.error(
      "[CONVERSATION PREFERENCE] Theme error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to update conversation theme."
    );
  }
};

exports.updateNickname = async (req, res) => {
  try {
    const { userId, conversationId } =
      await getUserConversation(req);

    let nickname = req.body?.nickname;

    if (
      nickname === null ||
      nickname === undefined
    ) {
      nickname = "";
    }

    nickname = String(nickname).trim();

    if (nickname.length > 50) {
      return res.status(400).json({
        success: false,
        message:
          "Nickname cannot exceed 50 characters.",
      });
    }

    const preference = await getOrCreatePreference(
      conversationId,
      userId
    );

    preference.nickname = nickname;

    await preference.save();

    return res.status(200).json({
      success: true,
      preferences: serializePreference(preference),
    });
  } catch (error) {
    console.error(
      "[CONVERSATION PREFERENCE] Nickname error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to update nickname."
    );
  }
};

exports.updateDisappearingMessages = async (
  req,
  res
) => {
  try {
    const { userId, conversationId } =
      await getUserConversation(req);

    const duration = Number(
      req.body?.duration
    );

    const allowedDurations = [
      0,
      86400,
      604800,
      2592000,
    ];

    if (!allowedDurations.includes(duration)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid disappearing-message duration.",
      });
    }

    const preference = await getOrCreatePreference(
      conversationId,
      userId
    );

    preference.disappearingDuration = duration;

    await preference.save();

    return res.status(200).json({
      success: true,
      preferences: serializePreference(preference),
    });
  } catch (error) {
    console.error(
      "[CONVERSATION PREFERENCE] Disappearing error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to update disappearing messages."
    );
  }
};

exports.resetConversationPreferences = async (
  req,
  res
) => {
  try {
    const { userId, conversationId } =
      await getUserConversation(req);

    const preference = await getOrCreatePreference(
      conversationId,
      userId
    );

    preference.mutedUntil = null;
    preference.restricted = false;
    preference.theme = "default";
    preference.nickname = "";
    preference.disappearingDuration = 0;

    await preference.save();

    return res.status(200).json({
      success: true,
      preferences: serializePreference(preference),
    });
  } catch (error) {
    console.error(
      "[CONVERSATION PREFERENCE] Reset error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to reset conversation preferences."
    );
  }
};