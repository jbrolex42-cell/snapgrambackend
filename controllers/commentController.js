const mongoose = require("mongoose");

const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const User = require("../models/User");

function getUserId(req) {
  return req.user?._id?.toString();
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function createComment(req, res) {
  try {
    const userId = getUserId(req);
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Not authorized.",
      });
    }

    if (!isValidObjectId(postId)) {
      return res.status(400).json({
        message: "Invalid post ID.",
      });
    }

    const text =
      typeof req.body.text === "string"
        ? req.body.text.trim()
        : "";

    const parentComment =
      req.body.parentComment || null;
    if (!text) {
      return res.status(400).json({
        message: "Comment cannot be empty.",
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        message: "Comment cannot exceed 1000 characters.",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    if (
      post.visibility === "private" &&
      post.user.toString() !== userId
    ) {
      return res.status(403).json({
        message: "You cannot comment on this post.",
      });
    }

   
    if (
      post.visibility === "followers" &&
      post.user.toString() !== userId
    ) {
      const currentUser = await User.findById(userId)
        .select("following")
        .lean();

      const isFollowing = (
        currentUser?.following || []
      ).some(
        (id) =>
          id.toString() ===
          post.user.toString()
      );

      if (!isFollowing) {
        return res.status(403).json({
          message:
            "You must follow this account to comment on this post.",
        });
      }
    }

    let normalizedParentComment = null;

    if (parentComment) {
      if (!isValidObjectId(parentComment)) {
        return res.status(400).json({
          message: "Invalid parent comment ID.",
        });
      }

      const parent = await Comment.findOne({
        _id: parentComment,
        post: post._id,
      });

      if (!parent) {
        return res.status(404).json({
          message: "Parent comment not found.",
        });
      }

      normalizedParentComment = parent._id;
    }

    const comment = await Comment.create({
      post: post._id,
      user: req.user._id,
      text,
      parentComment: normalizedParentComment,
    });

    post.commentsCount =
      (post.commentsCount || 0) + 1;

    await post.save();

    const populatedComment =
      await Comment.findById(comment._id)
        .populate(
          "user",
          "username fullName avatar isVerified"
        )
        .lean();

    if (
      post.user &&
      post.user.toString() !== userId
    ) {
      try {
        await Notification.create({
          recipient: post.user,
          sender: req.user._id,
          type: "comment",
          post: post._id,
          comment: comment._id,
          message: "commented on your post",
        });
      } catch (notificationError) {
        console.error(
          "Create comment notification error:",
          notificationError
        );
      }
    }

    return res.status(201).json({
      message: "Comment created successfully.",
      comment: populatedComment,
    });
  } catch (error) {
    console.error(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.error("CREATE COMMENT ERROR");
    console.error(error);
    console.error(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    if (error?.name === "ValidationError") {
      return res.status(400).json({
        message: Object.values(error.errors)
          .map((item) => item.message)
          .join(" "),
      });
    }

    if (error?.name === "CastError") {
      return res.status(400).json({
        message: "Invalid comment or post ID.",
      });
    }

    return res.status(500).json({
      message:
        error?.message ||
        "Unable to create comment.",
    });
  }
}

async function getComments(req, res) {
  try {
    const { postId } = req.params;

    if (!isValidObjectId(postId)) {
      return res.status(400).json({
        message: "Invalid post ID.",
      });
    }

    const post = await Post.findById(postId)
      .select("_id user visibility")
      .lean();

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    const comments = await Comment.find({
      post: post._id,
    })
      .populate(
        "user",
        "username name fullName avatar isVerified"
      )
      .sort({
        createdAt: 1,
      })
      .lean();

    const topLevel = comments.filter(
      (comment) =>
        !comment.parentComment
    );

    const replies = comments.filter(
      (comment) =>
        comment.parentComment
    );

    const result = topLevel.map(
      (comment) => ({
        ...comment,

        replies: replies.filter(
          (reply) =>
            reply.parentComment?.toString() ===
            comment._id.toString()
        ),
      })
    );

    return res.json({
      comments: result,
    });
  } catch (error) {
    console.error(
      "Get comments error:",
      error
    );

    if (error?.name === "CastError") {
      return res.status(400).json({
        message: "Invalid post ID.",
      });
    }

    return res.status(500).json({
      message:
        error?.message ||
        "Unable to load comments.",
    });
  }
}

async function deleteComment(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Not authorized.",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid comment ID.",
      });
    }

    const comment =
      await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    if (
      comment.user.toString() !==
      userId
    ) {
      return res.status(403).json({
        message:
          "You can only delete your own comments.",
      });
    }

    const replyCount =
      await Comment.countDocuments({
        parentComment: comment._id,
      });
    await Comment.deleteMany({
      parentComment: comment._id,
    });
    await comment.deleteOne();

    const removedCount =
      1 + replyCount;
    await Post.findByIdAndUpdate(
      comment.post,
      {
        $inc: {
          commentsCount: -removedCount,
        },
      }
    );

    return res.json({
      message:
        "Comment deleted successfully.",
    });
  } catch (error) {
    console.error(
      "Delete comment error:",
      error
    );

    if (error?.name === "CastError") {
      return res.status(400).json({
        message: "Invalid comment ID.",
      });
    }

    return res.status(500).json({
      message:
        error?.message ||
        "Unable to delete comment.",
    });
  }
}

async function likeComment(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Not authorized.",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid comment ID.",
      });
    }

    const comment =
      await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    if (!Array.isArray(comment.likes)) {
      comment.likes = [];
    }

    const alreadyLiked =
      comment.likes.some(
        (likeId) =>
          likeId.toString() ===
          userId
      );

    if (!alreadyLiked) {
      comment.likes.push(
        req.user._id
      );

      await comment.save();
    }

    return res.json({
      liked: true,
      likesCount:
        comment.likes.length,
    });
  } catch (error) {
    console.error(
      "Like comment error:",
      error
    );

    if (error?.name === "CastError") {
      return res.status(400).json({
        message: "Invalid comment ID.",
      });
    }

    return res.status(500).json({
      message:
        error?.message ||
        "Unable to like comment.",
    });
  }
}

async function unlikeComment(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Not authorized.",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid comment ID.",
      });
    }

    const comment =
      await Comment.findById(id);

    if (!comment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    comment.likes =
      (comment.likes || []).filter(
        (likeId) =>
          likeId.toString() !==
          userId
      );

    await comment.save();

    return res.json({
      liked: false,
      likesCount:
        comment.likes.length,
    });
  } catch (error) {
    console.error(
      "Unlike comment error:",
      error
    );

    if (error?.name === "CastError") {
      return res.status(400).json({
        message: "Invalid comment ID.",
      });
    }

    return res.status(500).json({
      message:
        error?.message ||
        "Unable to unlike comment.",
    });
  }
}

module.exports = {
  createComment,
  getComments,
  deleteComment,
  likeComment,
  unlikeComment,
};