const User =
  require("../models/User");

const UserSettings =
  require("../models/UserSettings");

async function getSettings(
  req,
  res
) {
  try {
    const user =
      await User.findById(
        req.user._id
      ).select(
        "isPrivate closeFriends blockedUsers mutedUsers restrictedUsers isVerified"
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    let settings =
      await UserSettings.findOne({
        user: user._id,
      });

    if (!settings) {
      settings =
        await UserSettings.create({
          user: user._id,
        });
    }

    res.json({
      settings: {
        isPrivate:
          user.isPrivate,

        closeFriends:
          user.closeFriends,

        blockedUsers:
          user.blockedUsers,

        mutedUsers:
          user.mutedUsers,

        restrictedUsers:
          user.restrictedUsers,

        preferences:
          settings,
      },
    });
  } catch (error) {
    console.error(
      "GET SETTINGS ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Unable to load settings",
    });
  }
}

async function updateSettings(
  req,
  res
) {
  try {
    let settings =
      await UserSettings.findOne({
        user: req.user._id,
      });

    if (!settings) {
      settings =
        await UserSettings.create({
          user: req.user._id,
        });
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
      "hiddenWords",
      "mediaQuality",
      "dataSaver",
      "appearance",
      "language",
      "fontSize",
      "reduceMotion",
      "accessibility",
      "savedLoginInformation",
    ];

    for (
      const field of allowedFields
    ) {
      if (
        req.body[field] !==
        undefined
      ) {
        settings[field] =
          req.body[field];
      }
    }

    await settings.save();

    let updatedUser =
      await User.findById(
        req.user._id
      );

    if (
      req.body.isPrivate !==
      undefined
    ) {
      updatedUser.isPrivate =
        Boolean(
          req.body.isPrivate
        );

      await updatedUser.save();
    }

    res.json({
      message:
        "Settings updated successfully",

      settings,

      isPrivate:
        updatedUser.isPrivate,
    });
  } catch (error) {
    console.error(
      "UPDATE SETTINGS ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Unable to update settings",
    });
  }
}

async function addRelationship(
  req,
  res
) {
  try {
    const {
      type,
    } = req.body;

    const allowedTypes = [
      "closeFriends",
      "blockedUsers",
      "mutedUsers",
      "restrictedUsers",
    ];

    if (
      !allowedTypes.includes(
        type
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid relationship type",
      });
    }

    const targetUser =
      await User.findById(
        req.params.userId
      );

    if (!targetUser) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    if (
      String(
        targetUser._id
      ) ===
      String(
        req.user._id
      )
    ) {
      return res.status(400).json({
        message:
          "You cannot add yourself",
      });
    }

    const user =
      await User.findById(
        req.user._id
      );

    if (
      !user[type].some(
        (id) =>
          String(id) ===
          String(
            targetUser._id
          )
      )
    ) {
      user[type].push(
        targetUser._id
      );

      await user.save();
    }

    res.json({
      message:
        "Account list updated",

      type,

      userId:
        targetUser._id,
    });
  } catch (error) {
    console.error(
      "ADD RELATIONSHIP ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Unable to update account list",
    });
  }
}

async function removeRelationship(
  req,
  res
) {
  try {
    const {
      type,
    } = req.body;

    const allowedTypes = [
      "closeFriends",
      "blockedUsers",
      "mutedUsers",
      "restrictedUsers",
    ];

    if (
      !allowedTypes.includes(
        type
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid relationship type",
      });
    }

    const user =
      await User.findById(
        req.user._id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    user[type] =
      user[type].filter(
        (id) =>
          String(id) !==
          String(
            req.params.userId
          )
      );

    await user.save();

    res.json({
      message:
        "Account list updated",
    });
  } catch (error) {
    console.error(
      "REMOVE RELATIONSHIP ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Unable to update account list",
    });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  addRelationship,
  removeRelationship,
};