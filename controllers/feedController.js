const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");

async function getHomeFeed(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        message: "Invalid authenticated user.",
      });
    }

    const currentUser = await User.findById(userId)
      .select("following")
      .lean();

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const followingIds = Array.isArray(currentUser.following)
      ? currentUser.following.filter((id) => {
          if (!id) {
            return false;
          }

          return mongoose.Types.ObjectId.isValid(id);
        })
      : [];

    const feedUserIds = [
      userId,
      ...followingIds,
    ];

    const uniqueFeedUserIds = [
      ...new Map(
        feedUserIds.map((id) => [
          id.toString(),
          id,
        ])
      ).values(),
    ];

    const posts = await Post.find({
      user: {
        $in: uniqueFeedUserIds,
      },
    })
      .populate(
        "user",
        "username fullName avatar isVerified"
      )
      .sort({
        createdAt: -1,
      })
      .limit(50)
      .lean();

    const formattedPosts = posts.map((post) => {
      const likes = Array.isArray(post.likes)
        ? post.likes
        : [];

      const savedBy = Array.isArray(post.savedBy)
        ? post.savedBy
        : [];

      const currentUserId = userId.toString();

      return {
        ...post,

        likesCount: likes.length,

        liked: likes.some(
          (id) =>
            id &&
            id.toString() === currentUserId
        ),

        saved: savedBy.some(
          (id) =>
            id &&
            id.toString() === currentUserId
        ),
      };
    });
    
    return res.json({
      posts: formattedPosts,
    });
  } catch (error) {
    console.error("Home feed error:", error);

    return res.status(500).json({
      message: "Failed to load home feed.",
    });
  }
}

module.exports = {
  getHomeFeed,
};