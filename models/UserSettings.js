const mongoose = require("mongoose");

const userSettingsSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
      },

      dailyReminder: {
        type: Boolean,
        default: false,
      },

      showActivityStatus: {
        type: Boolean,
        default: true,
      },

      readReceipts: {
        type: Boolean,
        default: true,
      },

      notifications: {
        push: {
          type: Boolean,
          default: true,
        },

        likes: {
          type: Boolean,
          default: true,
        },

        comments: {
          type: Boolean,
          default: true,
        },

        messages: {
          type: Boolean,
          default: true,
        },

        follows: {
          type: Boolean,
          default: true,
        },

        stories: {
          type: Boolean,
          default: true,
        },

        mentions: {
          type: Boolean,
          default: true,
        },

        calls: {
          type: Boolean,
          default: true,
        },
      },

      story: {
        allowReplies: {
          type: Boolean,
          default: true,
        },

        allowSharing: {
          type: Boolean,
          default: true,
        },
      },

      messages: {
        allowRequests: {
          type: Boolean,
          default: true,
        },

        allowCalls: {
          type: Boolean,
          default: true,
        },

        allowGroupInvites: {
          type: Boolean,
          default: true,
        },
      },


      tagsAndMentions: {
        tags: {
          type: String,
          enum: [
            "everyone",
            "following",
            "no_one",
          ],
          default: "everyone",
        },

        mentions: {
          type: String,
          enum: [
            "everyone",
            "following",
            "no_one",
          ],
          default: "everyone",
        },
      },

      comments: {
        allowComments: {
          type: Boolean,
          default: true,
        },

        allowCommentRequests: {
          type: Boolean,
          default: true,
        },
      },

      sharing: {
        allowPostSharing: {
          type: Boolean,
          default: true,
        },

        allowStorySharing: {
          type: Boolean,
          default: true,
        },

        allowReuse: {
          type: Boolean,
          default: true,
        },
      },

      hiddenWords: {
        type: [String],
        default: [],
      },

      mediaQuality: {
        type: String,
        enum: [
          "standard",
          "high",
        ],
        default: "standard",
      },

      dataSaver: {
        type: Boolean,
        default: false,
      },

      appearance: {
        type: String,
        enum: [
          "system",
          "light",
          "dark",
        ],
        default: "system",
      },

      language: {
        type: String,
        default: "English",
      },

      fontSize: {
        type: String,
        enum: [
          "small",
          "default",
          "large",
          "extra_large",
        ],
        default: "default",
      },

      reduceMotion: {
        type: Boolean,
        default: false,
      },

      accessibility: {
        reduceTransparency: {
          type: Boolean,
          default: false,
        },

        screenReaderOptimizations: {
          type: Boolean,
          default: false,
        },
      },

      savedLoginInformation: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "UserSettings",
    userSettingsSchema
  );