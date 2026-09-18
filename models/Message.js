const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    emoji: {
      type: String,
      required: true,
      maxlength: 32,
    },
  },
  {
    _id: false,
  }
);

const messageSchema = new mongoose.Schema(
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
      index: true,
    },

    senderDeviceId: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "text",
        "image",
        "video",
        "voice",
        "file",
        "system",
      ],
      default: "text",
      required: true,
    },

    /*
     * NEVER store plaintext.
     */
    ciphertext: {
      type: String,
      required: true,
    },

    /*
     * Example:
     *
     * signal-v1
     *
     * This lets us migrate protocol versions later.
     */
    encryptionVersion: {
      type: String,
      required: true,
      default: "signal-v1",
    },

    /*
     * The encrypted message envelope may contain
     * protocol metadata required by the receiver.
     *
     * It is opaque to the backend.
     */
    envelopeType: {
      type: String,
      enum: [
        "preKeySignal",
        "signal",
        "group",
      ],
      required: true,
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    media: {
      ciphertextUrl: {
        type: String,
        default: null,
      },

      publicId: {
        type: String,
        default: null,
      },

      mimeType: {
        type: String,
        default: null,
      },

      encryptedMetadata: {
        type: String,
        default: null,
      },
    },

    reactions: {
      type: [reactionSchema],
      default: [],
    },

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

messageSchema.index({
  sender: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.Message ||
  mongoose.model("Message", messageSchema);