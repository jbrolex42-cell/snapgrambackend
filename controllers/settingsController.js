const User = require("../models/User");
const UserSettings = require("../models/UserSettings");

function cleanSettings(settings) {
  if (!settings) {
    return {};
  }

  const data = settings.toObject
    ? settings.toObject()
    : { ...settings };

  delete data._id;
  delete data.__v;
  delete data.user;
  delete data.createdAt;
  delete data.updatedAt;

  return data;
}

function mergeObject(target, source) {
  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    return;
  }

  for (const key of Object.keys(source)) {
    const value = source[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      if (
        !target[key] ||
        typeof target[key] !== "object"
      ) {
        target[key] = {};
      }

      mergeObject(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

async function getOrCreateSettings(userId) {
  let settings = await UserSettings.findOne({
    user: userId,
  });

  if (!settings) {
    settings = await UserSettings.create({
      user: userId,
    });
  }

  return settings;
}

async function getSettings(req, res) {
  try {
    const user = await User.findById(req.user._id)
      .select(
        [
          "isPrivate",
          "closeFriends",
          "blockedUsers",
          "mutedUsers",
          "restrictedUsers",
          "isVerified",
          "verificationStatus",
        ].join(" ")
      )
      .populate(
        "closeFriends",
        "username fullName avatar"
      )
      .populate(
        "blockedUsers",
        "username fullName avatar"
      )
      .populate(
        "mutedUsers",
        "username fullName avatar"
      )
      .populate(
        "restrictedUsers",
        "username fullName avatar"
      );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const settings = await getOrCreateSettings(user._id);

    return res.json({
      settings: {
        isPrivate: Boolean(user.isPrivate),

        closeFriends: user.closeFriends || [],

        blockedUsers: user.blockedUsers || [],

        mutedUsers: user.mutedUsers || [],

        restrictedUsers: user.restrictedUsers || [],

        isVerified: Boolean(user.isVerified),

        verificationStatus:
          user.verificationStatus || "none",

        preferences: cleanSettings(settings),
      },
    });
  } catch (error) {
    console.error("GET SETTINGS ERROR:", error);

    return res.status(500).json({
      message: "Unable to load settings",
    });
  }
}

async function updateSettings(req, res) {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const settings = await getOrCreateSettings(user._id);

    const body = req.body || {};

    if (body.isPrivate !== undefined) {
      user.isPrivate = Boolean(body.isPrivate);

      await user.save();
    }

    const allowedFields = [
      "dailyReminder",
      "showActivityStatus",
      "readReceipts",

      "notifications",

      "story",

      "messages",

      "tagsAndMentions",

      "comments",

      "sharing",

      "hiddenWordsEnabled",
      "hiddenWords",

      "mediaQuality",
      "uploadAtHighestQuality",

      "dataSaver",
      "autoplay",

      "appearance",

      "language",

      "fontSize",
       
      "animations",
      "reduceMotion",

      "accessibility",

      "savedLoginInformation",

      "twoFactorEnabled",
    ];

    for (const field of allowedFields) {
      if (body[field] === undefined) {
        continue;
      }

      const value = body[field];

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        const currentValue =
          settings[field]?.toObject
            ? settings[field].toObject()
            : settings[field]
              ? { ...settings[field] }
              : {};

        mergeObject(currentValue, value);

        settings[field] = currentValue;
      } else {
        settings[field] = value;
      }
    }

    await settings.save();

    return res.json({
      message: "Settings updated successfully",

      settings: cleanSettings(settings),

      isPrivate: Boolean(user.isPrivate),
    });
  } catch (error) {
    console.error(
      "UPDATE SETTINGS ERROR:",
      error
    );

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid settings value",

        errors: Object.values(error.errors).map(
          (item) => item.message
        ),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid settings value",
      });
    }

    return res.status(500).json({
      message: "Unable to update settings",
    });
  }
}

async function addRelationship(req, res) {
  try {
    const { type } = req.body || {};

    const allowedTypes = [
      "closeFriends",
      "blockedUsers",
      "mutedUsers",
      "restrictedUsers",
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid relationship type",
      });
    }

    const targetUser = await User.findById(
      req.params.userId
    );

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (
      String(targetUser._id) ===
      String(req.user._id)
    ) {
      return res.status(400).json({
        message: "You cannot add yourself",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!Array.isArray(user[type])) {
      user[type] = [];
    }

    const exists = user[type].some(
      (id) =>
        String(id) ===
        String(targetUser._id)
    );

    if (!exists) {
      user[type].push(targetUser._id);

      await user.save();
    }

    return res.json({
      message: "Account list updated",

      type,

      userId: targetUser._id,
    });
  } catch (error) {
    console.error(
      "ADD RELATIONSHIP ERROR:",
      error
    );

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    return res.status(500).json({
      message: "Unable to update account list",
    });
  }
}

async function removeRelationship(req, res) {
  try {
    const { type } = req.body || {};

    const allowedTypes = [
      "closeFriends",
      "blockedUsers",
      "mutedUsers",
      "restrictedUsers",
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid relationship type",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user[type] = Array.isArray(user[type])
      ? user[type].filter(
          (id) =>
            String(id) !==
            String(req.params.userId)
        )
      : [];

    await user.save();

    return res.json({
      message: "Account list updated",

      type,

      userId: req.params.userId,
    });
  } catch (error) {
    console.error(
      "REMOVE RELATIONSHIP ERROR:",
      error
    );

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    return res.status(500).json({
      message: "Unable to update account list",
    });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  addRelationship,
  removeRelationship,
};