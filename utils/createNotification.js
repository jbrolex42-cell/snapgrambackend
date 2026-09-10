const Notification = require("../models/Notification");

/**
 * @param {Object} options
 * @param {String|ObjectId} options.recipient - User receiving notification
 * @param {String|ObjectId} options.sender - User causing notification
 * @param {String} options.type - Notification type
 * @param {String|ObjectId|null} options.post - Related post
 * @param {String|ObjectId|null} options.reel - Related reel
 * @param {String|ObjectId|null} options.story - Related story
 * @param {String|ObjectId|null} options.comment - Related comment
 * @param {String|ObjectId|null} options.message - Related message
 * @param {String|ObjectId|null} options.call - Related call
 * @param {String} options.text - Notification text
 * @param {Boolean} options.emit - Whether to send through Socket.IO
 * @param {Object} options.io - Socket.IO instance
 *
 * @returns {Promise<Object|null>}
 */
async function createNotification({
  recipient,
  sender,
  type,

  post = null,
  reel = null,
  story = null,
  comment = null,
  message = null,
  call = null,

  text = "",

  emit = true,
  io = null,
} = {}) {
  try {
   
    if (!recipient) {
      console.warn(
        "Notification skipped: recipient is missing"
      );

      return null;
    }

    if (!sender) {
      console.warn(
        "Notification skipped: sender is missing"
      );

      return null;
    }

    if (!type) {
      console.warn(
        "Notification skipped: type is missing"
      );

      return null;
    }

    const allowedTypes = [
      "like",
      "comment",
      "follow",
      "mention",
      "story_like",
      "story_reply",
      "reel_like",
      "reel_comment",
      "message",
      "follow_request",
      "follow_accept",
      "call",
      "system",
    ];

    if (!allowedTypes.includes(type)) {
      console.warn(
        `Invalid notification type: ${type}`
      );

      return null;
    }

    if (
      String(recipient) ===
      String(sender)
    ) {
      return null;
    }

    const notificationData = {
      recipient,
      sender,
      type,

      post: post || null,
      reel: reel || null,
      story: story || null,
      comment: comment || null,
      message: message || null,
      call: call || null,

      text:
        typeof text === "string"
          ? text.trim().slice(0, 300)
          : "",

      read: false,
      isRead: false,
    };

    const notification =
      await Notification.create(
        notificationData
      );

    if (emit && io) {
      try {
        const recipientSocketId =
          io.connectedUsers?.get(
            String(recipient)
          );

        if (recipientSocketId) {
          io.to(
            recipientSocketId
          ).emit(
            "notification:new",
            {
              notification,
            }
          );
        }
      } catch (socketError) {
        console.error(
          "NOTIFICATION SOCKET ERROR:",
          socketError
        );
      }
    }

    return notification;
  } catch (error) {
    console.error(
      "CREATE NOTIFICATION ERROR:",
      error
    );

    return null;
  }
}

async function markNotificationAsRead(
  notificationId,
  userId
) {
  try {
    if (
      !notificationId ||
      !userId
    ) {
      return null;
    }

    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId,
        },
        {
          read: true,
          isRead: true,
        },
        {
          new: true,
        }
      );

    return notification;
  } catch (error) {
    console.error(
      "MARK NOTIFICATION READ ERROR:",
      error
    );

    return null;
  }
}

async function markAllNotificationsAsRead(
  userId
) {
  try {
    if (!userId) {
      return null;
    }

    const result =
      await Notification.updateMany(
        {
          recipient: userId,
          $or: [
            { read: false },
            { isRead: false },
          ],
        },
        {
          $set: {
            read: true,
            isRead: true,
          },
        }
      );

    return result;
  } catch (error) {
    console.error(
      "MARK ALL NOTIFICATIONS READ ERROR:",
      error
    );

    return null;
  }
}

async function deleteNotification(
  notificationId,
  userId
) {
  try {
    if (
      !notificationId ||
      !userId
    ) {
      return null;
    }

    const result =
      await Notification.findOneAndDelete(
        {
          _id: notificationId,
          recipient: userId,
        }
      );

    return result;
  } catch (error) {
    console.error(
      "DELETE NOTIFICATION ERROR:",
      error
    );

    return null;
  }
}

module.exports = {
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
};