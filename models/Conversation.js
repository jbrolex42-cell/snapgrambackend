const mongoose = require("mongoose");

const conversationSchema =
  new mongoose.Schema(
    {
      participants: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],

      lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
      },

      lastMessageAt: {
        type: Date,
        default: null,
      },

      /*
       * Conversation-level encryption metadata.
       *
       * The actual private keys NEVER belong here.
       */
      encryptionVersion: {
        type: String,
        default: null,
      },

      encryptionEnabled: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

conversationSchema.index({
  participants: 1,
});

conversationSchema.index({
  lastMessageAt: -1,
});

conversationSchema.pre(
  "validate",
  function (next) {
    if (!Array.isArray(this.participants)) {
      return next();
    }

    const uniqueIds = [
      ...new Set(
        this.participants.map(
          (id) => String(id)
        )
      ),
    ];

    this.participants = uniqueIds;

    if (this.participants.length < 2) {
      return next(
        new Error(
          "A conversation requires at least two participants"
        )
      );
    }

    next();
  }
);

module.exports =
  mongoose.models.Conversation ||
  mongoose.model(
    "Conversation",
    conversationSchema
  );