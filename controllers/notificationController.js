const Notification = require("../models/Notification");

async function getNotifications(req, res) {
  try {
    const notifications =
      await Notification.find({
        recipient: req.user._id,
      })
        .populate(
          "sender",
          "username fullName avatar isVerified"
        )
        .populate(
          "post",
          "_id image media"
        )
        .populate(
          "reel",
          "_id thumbnail coverImage media"
        )
        .populate(
          "story",
          "_id media image"
        )
        .populate(
          "comment",
          "_id text"
        )
        .populate(
          "call",
          "_id caller receiver callType status"
        )
        .populate(
          "message",
          "_id conversation sender text mediaUrl"
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

    return res.json({
      notifications,
    });
  } catch (error) {
    console.error(
      "GET NOTIFICATIONS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to load notifications",
    });
  }
}

async function getUnreadCount(req, res) {
  try {
    const count =
      await Notification.countDocuments({
        recipient: req.user._id,
        isRead: false,
      });

    return res.json({
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
    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: req.params.id,
          recipient: req.user._id,
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

    return res.json({
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
    await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );

    return res.json({
      message:
        "All notifications marked as read",
    });
  } catch (error) {
    console.error(
      "MARK ALL NOTIFICATIONS READ ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to update notifications",
    });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};