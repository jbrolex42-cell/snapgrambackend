const Notification = require("../models/Notification");

async function getNotifications(req, res) {
  try {
    const recipientId = req.user?._id;

    if (!recipientId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const notifications = await Notification.find({
      recipient: recipientId,
    })
      .populate(
        "sender",
        "username fullName name displayName avatar profilePicture isVerified"
      )
      .populate(
        "post",
        "_id image media caption createdAt"
      )
      .populate(
        "reel",
        "_id thumbnail coverImage media caption createdAt"
      )
      .populate(
        "story",
        "_id media image createdAt"
      )
      .populate(
        "comment",
        "_id text createdAt"
      )
      .populate(
        "call",
        "_id caller receiver callType status createdAt"
      )
      .populate(
        "message",
        "_id conversation sender text mediaUrl createdAt"
      )
      .populate(
        "live",
        "_id host status title viewerCount startedAt endedAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(100)
      .lean();

    return res.status(200).json({
      notifications,
    });
  } catch (error) {
    console.error(
      "GET NOTIFICATIONS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to load notifications",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

async function getUnreadCount(req, res) {
  try {
    const recipientId = req.user?._id;

    if (!recipientId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const count =
      await Notification.countDocuments({
        recipient: recipientId,
        isRead: false,
      });

    return res.status(200).json({
      count,
    });
  } catch (error) {
    console.error(
      "GET UNREAD COUNT ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to get notification count",
    });
  }
}

async function markAsRead(req, res) {
  try {
    const recipientId = req.user?._id;

    if (!recipientId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          recipient: recipientId,
        },
        {
          $set: {
            isRead: true,
          },
        },
        {
          new: true,
        }
      );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      notification,
    });
  } catch (error) {
    console.error(
      "MARK NOTIFICATION READ ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to update notification",
    });
  }
}

async function markAllAsRead(req, res) {
  try {
    const recipientId = req.user?._id;

    if (!recipientId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    await Notification.updateMany(
      {
        recipient: recipientId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );

    return res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error(
      "MARK ALL NOTIFICATIONS READ ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to update notifications",
    });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};