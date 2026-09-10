const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
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
      ],
      required: true,
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    reel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reel",
      default: null,
    },

    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      default: null,
    },

    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    call: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Call",
      default: null,
    },

    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    text: {
      type: String,
      default: "",
      maxlength: 300,
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({
  recipient: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipient: 1,
  isRead: 1,
});

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);