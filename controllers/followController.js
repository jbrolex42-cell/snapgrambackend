const mongoose = require("mongoose");

const User = require("../models/User");
const Follow = require("../models/Follow");
const Notification = require("../models/Notification");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function followUser(req, res) {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    if (
      targetUserId.toString() ===
      currentUserId.toString()
    ) {
      return res.status(400).json({
        message: "You cannot follow yourself.",
      });
    }

    const targetUser =
      await User.findById(targetUserId).select(
        "_id username fullName avatar isVerified isPrivate followersCount followingCount"
      );

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const existingFollow =
      await Follow.exists({
        follower: currentUserId,
        following: targetUserId,
      });

    if (existingFollow) {
      return res.json({
        following: true,
        alreadyFollowing: true,
        followersCount:
          targetUser.followersCount || 0,
      });
    }

    try {
      await Follow.create({
        follower: currentUserId,
        following: targetUserId,
      });
    } catch (error) {
      if (error?.code === 11000) {
        const latestTarget =
          await User.findById(targetUserId).select(
            "followersCount"
          );

        return res.json({
          following: true,
          alreadyFollowing: true,
          followersCount:
            latestTarget?.followersCount ||
            targetUser.followersCount ||
            0,
        });
      }

      throw error;
    }

    const [
      updatedTarget,
      updatedCurrent,
    ] = await Promise.all([
      User.findByIdAndUpdate(
        targetUserId,
        {
          $inc: {
            followersCount: 1,
          },
        },
        {
          new: true,
          projection:
            "_id username followersCount followingCount",
        }
      ),

      User.findByIdAndUpdate(
        currentUserId,
        {
          $inc: {
            followingCount: 1,
          },
        },
        {
          new: true,
          projection:
            "_id username followersCount followingCount",
        }
      ),
    ]);

    try {
      await Notification.create({
        recipient: targetUserId,
        sender: currentUserId,
        type: "follow",
        text: "started following you",
      });
    } catch (notificationError) {
      console.error(
        "FOLLOW NOTIFICATION ERROR:",
        notificationError
      );
    }

    return res.json({
      following: true,
      followersCount:
        updatedTarget?.followersCount || 0,
      followingCount:
        updatedCurrent?.followingCount || 0,
    });
  } catch (error) {
    console.error(
      "FOLLOW USER ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to follow user.",
    });
  }
}

async function unfollowUser(req, res) {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    if (
      targetUserId.toString() ===
      currentUserId.toString()
    ) {
      return res.status(400).json({
        message: "Invalid follow operation.",
      });
    }

    const deletedFollow =
      await Follow.findOneAndDelete({
        follower: currentUserId,
        following: targetUserId,
      });

    const targetUser =
      await User.findById(targetUserId).select(
        "followersCount followingCount"
      );

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (!deletedFollow) {
      return res.json({
        following: false,
        alreadyUnfollowed: true,
        followersCount: Math.max(
          0,
          Number(
            targetUser.followersCount || 0
          )
        ),
        followingCount: Math.max(
          0,
          Number(
            targetUser.followingCount || 0
          )
        ),
      });
    }

    const [
      updatedTarget,
      updatedCurrent,
    ] = await Promise.all([
      User.findByIdAndUpdate(
        targetUserId,
        {
          $inc: {
            followersCount: -1,
          },
        },
        {
          new: true,
          projection:
            "_id followersCount followingCount",
        }
      ),

      User.findByIdAndUpdate(
        currentUserId,
        {
          $inc: {
            followingCount: -1,
          },
        },
        {
          new: true,
          projection:
            "_id followersCount followingCount",
        }
      ),
    ]);

    if (
      updatedTarget &&
      updatedTarget.followersCount < 0
    ) {
      await User.updateOne(
        {
          _id: targetUserId,
          followersCount: {
            $lt: 0,
          },
        },
        {
          $set: {
            followersCount: 0,
          },
        }
      );
    }

    if (
      updatedCurrent &&
      updatedCurrent.followingCount < 0
    ) {
      await User.updateOne(
        {
          _id: currentUserId,
          followingCount: {
            $lt: 0,
          },
        },
        {
          $set: {
            followingCount: 0,
          },
        }
      );
    }

    return res.json({
      following: false,
      followersCount: Math.max(
        0,
        updatedTarget?.followersCount || 0
      ),
      followingCount: Math.max(
        0,
        updatedCurrent?.followingCount || 0
      ),
    });
  } catch (error) {
    console.error(
      "UNFOLLOW USER ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to unfollow user.",
    });
  }
}

async function toggleFollow(req, res) {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    if (
      targetUserId.toString() ===
      currentUserId.toString()
    ) {
      return res.status(400).json({
        message: "You cannot follow yourself.",
      });
    }

    const targetUser =
      await User.findById(targetUserId).select(
        "_id username followersCount followingCount"
      );

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const existingFollow =
      await Follow.findOne({
        follower: currentUserId,
        following: targetUserId,
      });

    if (existingFollow) {
      await Follow.deleteOne({
        _id: existingFollow._id,
      });

      const [
        updatedTarget,
        updatedCurrent,
      ] = await Promise.all([
        User.findByIdAndUpdate(
          targetUserId,
          {
            $inc: {
              followersCount: -1,
            },
          },
          {
            new: true,
            projection: "followersCount",
          }
        ),

        User.findByIdAndUpdate(
          currentUserId,
          {
            $inc: {
              followingCount: -1,
            },
          },
          {
            new: true,
            projection: "followingCount",
          }
        ),
      ]);

      return res.json({
        following: false,
        followersCount: Math.max(
          0,
          updatedTarget?.followersCount || 0
        ),
        followingCount: Math.max(
          0,
          updatedCurrent?.followingCount || 0
        ),
      });
    }

    try {
      await Follow.create({
        follower: currentUserId,
        following: targetUserId,
      });
    } catch (error) {
      if (error?.code === 11000) {
        const latestTarget =
          await User.findById(targetUserId).select(
            "followersCount"
          );

        return res.json({
          following: true,
          alreadyFollowing: true,
          followersCount:
            latestTarget?.followersCount ||
            targetUser.followersCount ||
            0,
        });
      }

      throw error;
    }

    const [
      updatedTarget,
      updatedCurrent,
    ] = await Promise.all([
      User.findByIdAndUpdate(
        targetUserId,
        {
          $inc: {
            followersCount: 1,
          },
        },
        {
          new: true,
          projection: "followersCount",
        }
      ),

      User.findByIdAndUpdate(
        currentUserId,
        {
          $inc: {
            followingCount: 1,
          },
        },
        {
          new: true,
          projection: "followingCount",
        }
      ),
    ]);

    try {
      await Notification.create({
        recipient: targetUserId,
        sender: currentUserId,
        type: "follow",
        text: "started following you",
      });
    } catch (notificationError) {
      console.error(
        "FOLLOW NOTIFICATION ERROR:",
        notificationError
      );
    }

    return res.json({
      following: true,
      followersCount:
        updatedTarget?.followersCount || 0,
      followingCount:
        updatedCurrent?.followingCount || 0,
    });
  } catch (error) {
    console.error(
      "TOGGLE FOLLOW ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to update follow status.",
    });
  }
}

async function getFollowStatus(req, res) {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    const targetUser =
      await User.findById(targetUserId).select(
        "followersCount followingCount"
      );

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const following = Boolean(
      await Follow.exists({
        follower: currentUserId,
        following: targetUserId,
      })
    );

    return res.json({
      following,

      isFollowing: following,

      followersCount:
        targetUser.followersCount || 0,

      followingCount:
        targetUser.followingCount || 0,
    });
  } catch (error) {
    console.error(
      "FOLLOW STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to check follow status.",
    });
  }
}

async function getFollowers(req, res) {
  try {
    const targetUserId = req.params.userId;

    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit, 10) || 30,
        1
      ),
      100
    );

    const cursor =
      req.query.cursor || null;

    const targetUser =
      await User.findById(targetUserId)
        .select(
          "_id followersCount"
        )
        .lean();

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const query = {
      following: targetUserId,
    };

    if (cursor) {
      if (!isValidObjectId(cursor)) {
        return res.status(400).json({
          message: "Invalid cursor.",
        });
      }

      const cursorFollow =
        await Follow.findById(cursor)
          .select(
            "_id createdAt following"
          )
          .lean();

      if (!cursorFollow) {
        return res.status(400).json({
          message: "Invalid cursor.",
        });
      }

      if (
        cursorFollow.following.toString() !==
        targetUserId.toString()
      ) {
        return res.status(400).json({
          message: "Invalid cursor.",
        });
      }

      query.$or = [
        {
          createdAt: {
            $lt:
              cursorFollow.createdAt,
          },
        },
        {
          createdAt:
            cursorFollow.createdAt,
          _id: {
            $lt: cursorFollow._id,
          },
        },
      ];
    }

    const follows =
      await Follow.find(query)
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(limit + 1)
        .populate(
          "follower",
          "username fullName avatar isVerified"
        )
        .lean();

    const hasMore =
      follows.length > limit;

    const pageItems = hasMore
      ? follows.slice(0, limit)
      : follows;

    const users = pageItems
      .filter(
        (item) => item.follower
      )
      .map((item) => ({
        ...item.follower,
        isVerified: Boolean(
          item.follower.isVerified
        ),
      }));

    const lastItem =
      pageItems[
        pageItems.length - 1
      ];

    const nextCursor =
      hasMore && lastItem
        ? String(lastItem._id)
        : null;

    return res.json({
      users,

      followersCount:
        targetUser.followersCount || 0,

      nextCursor,

      hasMore,

      limit,
    });
  } catch (error) {
    console.error(
      "GET FOLLOWERS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to load followers.",
    });
  }
}

async function getFollowing(req, res) {
  try {
    const targetUserId = req.params.userId;

    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit, 10) || 30,
        1
      ),
      100
    );

    const cursor =
      req.query.cursor || null;

    const targetUser =
      await User.findById(targetUserId)
        .select(
          "_id followingCount"
        )
        .lean();

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const query = {
      follower: targetUserId,
    };

    if (cursor) {
      if (!isValidObjectId(cursor)) {
        return res.status(400).json({
          message: "Invalid cursor.",
        });
      }

      const cursorFollow =
        await Follow.findById(cursor)
          .select(
            "_id createdAt follower"
          )
          .lean();

      if (!cursorFollow) {
        return res.status(400).json({
          message: "Invalid cursor.",
        });
      }

      if (
        cursorFollow.follower.toString() !==
        targetUserId.toString()
      ) {
        return res.status(400).json({
          message: "Invalid cursor.",
        });
      }

      query.$or = [
        {
          createdAt: {
            $lt:
              cursorFollow.createdAt,
          },
        },
        {
          createdAt:
            cursorFollow.createdAt,
          _id: {
            $lt: cursorFollow._id,
          },
        },
      ];
    }

    const follows =
      await Follow.find(query)
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(limit + 1)
        .populate(
          "following",
          "username fullName avatar isVerified"
        )
        .lean();

    const hasMore =
      follows.length > limit;

    const pageItems = hasMore
      ? follows.slice(0, limit)
      : follows;

    const users = pageItems
      .filter(
        (item) => item.following
      )
      .map((item) => ({
        ...item.following,
        isVerified: Boolean(
          item.following.isVerified
        ),
      }));

    const lastItem =
      pageItems[
        pageItems.length - 1
      ];

    const nextCursor =
      hasMore && lastItem
        ? String(lastItem._id)
        : null;

    return res.json({
      users,

      followingCount:
        targetUser.followingCount || 0,

      nextCursor,

      hasMore,

      limit,
    });
  } catch (error) {
    console.error(
      "GET FOLLOWING ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to load following.",
    });
  }
}

async function getPendingRequests(req, res) {
  return res.status(501).json({
    message:
      "Follow requests are not configured yet.",
    requests: [],
  });
}

async function acceptRequest(req, res) {
  return res.status(501).json({
    message:
      "Follow requests are not configured yet.",
  });
}

async function rejectRequest(req, res) {
  return res.status(501).json({
    message:
      "Follow requests are not configured yet.",
  });
}

module.exports = {
  followUser,
  unfollowUser,
  toggleFollow,
  getFollowers,
  getFollowing,
  getFollowStatus,
  getPendingRequests,
  acceptRequest,
  rejectRequest,
};