const User = require("../models/User");

const getUserStatus = async (
  req,
  res
) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(
      userId
    ).select(
      "isOnline lastSeen username isVerified"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      success: true,

      userId: user._id,

      username: user.username,

      isOnline: user.isOnline,

      lastSeen: user.lastSeen,
    });
  } catch (error) {
    console.error(
      "STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to get user status",
    });
  }
};

module.exports = {
  getUserStatus,
};