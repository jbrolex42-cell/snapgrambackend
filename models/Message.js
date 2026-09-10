const mongoose = require("mongoose");

const messageSchema =
  new mongoose.Schema(
    {
      conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true,
      },

      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      type: {
        type: String,
        enum: [
          "text",
          "image",
          "video",
          "voice",
        ],
        default: "text",
      },

      text: {
        type: String,
        default: "",
        maxlength: 5000,
      },

      mediaUrl: {
        type: String,
        default: null,
      },

      mediaPublicId: {
        type: String,
        default: null,
      },

      mediaDuration: {
        type: Number,
        default: null,
      },

      replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },

      reactions: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },

          emoji: {
            type: String,
          },
        },
      ],

      readBy: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],

      deleted: {
        type: Boolean,
        default: false,
      },

      deletedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

messageSchema.index({
  conversation: 1,
  createdAt: 1,
});

module.exports =
  mongoose.model(
    "Message",
    messageSchema
  );