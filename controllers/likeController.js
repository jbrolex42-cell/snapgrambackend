const mongoose = require("mongoose");

const Post = require("../models/Post");
const Notification = require("../models/Notification");

function getUserId(req) {
  return req.user?._id || req.user?.id || req.userId;
}

function sameId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

async function likePost(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid post ID.",
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    if (!Array.isArray(post.likes)) {
      post.likes = [];
    }

    const alreadyLiked = post.likes.some((likeId) =>
      sameId(likeId, userId)
    );

    if (!alreadyLiked) {
      post.likes.push(userId);
      await post.save();

      if (!sameId(post.user, userId)) {
        try {
          await Notification.create({
            recipient: post.user,
            sender: userId,
            type: "like",
            post: post._id,
            message: "liked your post",
          });
        } catch (notificationError) {
          console.error(
            "POST LIKE NOTIFICATION ERROR:",
            notificationError
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      liked: true,
      likesCount: post.likes.length,
      postId: String(post._id),
    });
  } catch (error) {
    console.error("LIKE POST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to like post.",
    });
  }
}

async function unlikePost(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid post ID.",
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    if (!Array.isArray(post.likes)) {
      post.likes = [];
    }

    post.likes = post.likes.filter(
      (likeId) => !sameId(likeId, userId)
    );

    await post.save();

    return res.status(200).json({
      success: true,
      liked: false,
      likesCount: post.likes.length,
      postId: String(post._id),
    });
  } catch (error) {
    console.error("UNLIKE POST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to unlike post.",
    });
  }
}

async function togglePostLike(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid post ID.",
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    if (!Array.isArray(post.likes)) {
      post.likes = [];
    }

    const alreadyLiked = post.likes.some((likeId) =>
      sameId(likeId, userId)
    );

    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (likeId) => !sameId(likeId, userId)
      );
    } else {
      post.likes.push(userId);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      liked: !alreadyLiked,
      likesCount: post.likes.length,
      postId: String(post._id),
    });
  } catch (error) {
    console.error("TOGGLE POST LIKE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update post like.",
    });
  }
}

module.exports = {
  likePost,
  unlikePost,
  togglePostLike,
};