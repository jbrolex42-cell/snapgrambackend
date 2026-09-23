const mongoose = require("mongoose");

const Post = require("../models/Post");
const User = require("../models/User");

async function getHomeFeed(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;

    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated user.",
      });
    }

    const currentUser = await User.findById(userId)
      .select("following")
      .lean();

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const followingIds = Array.isArray(
      currentUser.following
    )
      ? currentUser.following.filter((id) =>
          id &&
          mongoose.Types.ObjectId.isValid(id)
        )
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

      postType: {
        $in: ["post", "reel"],
      },

      $or: [
        {
          isArchived: {
            $exists: false,
          },
        },
        {
          isArchived: false,
        },
      ],
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

    const currentUserId =
      userId.toString();

    const formattedPosts = posts.map(
      (post) => {
        const likes = Array.isArray(
          post.likes
        )
          ? post.likes
          : [];

        const savedBy = Array.isArray(
          post.savedBy
        )
          ? post.savedBy
          : [];

        const media = Array.isArray(
          post.media
        )
          ? post.media
          : [];

        return {
          ...post,

          id: post._id
            ? post._id.toString()
            : null,

          _id: post._id
            ? post._id.toString()
            : null,

          postType:
            post.postType || "post",

          media,

          likesCount: likes.length,

          liked: likes.some(
            (id) =>
              id &&
              id.toString() ===
                currentUserId
          ),

          isLiked: likes.some(
            (id) =>
              id &&
              id.toString() ===
                currentUserId
          ),

          saved: savedBy.some(
            (id) =>
              id &&
              id.toString() ===
                currentUserId
          ),

          isSaved: savedBy.some(
            (id) =>
              id &&
              id.toString() ===
                currentUserId
          ),
        };
      }
    );

    console.log(
      "[FEED] HOME FEED:",
      {
        userId: currentUserId,
        followingCount:
          followingIds.length,
        userCount:
          uniqueFeedUserIds.length,
        postCount:
          formattedPosts.length,
        types:
          formattedPosts.map(
            (post) =>
              post.postType
          ),
      }
    );

    return res.status(200).json({
      success: true,
      posts: formattedPosts,
      count: formattedPosts.length,
    });
  } catch (error) {
    console.error(
      "[FEED] HOME FEED ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load home feed.",
    });
  }
}

module.exports = {
  getHomeFeed,
};