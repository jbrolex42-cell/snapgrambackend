const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
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
  { _id: false }
);

const storySchema = new mongoose.Schema(
  {
    allowReplies: {
      type: Boolean,
      default: true,
    },

    allowSharing: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
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
  { _id: false }
);

const tagsAndMentionsSchema = new mongoose.Schema(
  {
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
  { _id: false }
);

const commentsSchema = new mongoose.Schema(
  {
    allowComments: {
      type: Boolean,
      default: true,
    },

    allowCommentRequests: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const sharingSchema = new mongoose.Schema(
  {
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
  { _id: false }
);

const accessibilitySchema = new mongoose.Schema(
  {
    reduceTransparency: {
      type: Boolean,
      default: false,
    },

    screenReaderOptimizations: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const userSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
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
      type: notificationSchema,
      default: () => ({}),
    },

    story: {
      type: storySchema,
      default: () => ({}),
    },

    messages: {
      type: messageSchema,
      default: () => ({}),
    },

    tagsAndMentions: {
      type: tagsAndMentionsSchema,
      default: () => ({}),
    },

    comments: {
      type: commentsSchema,
      default: () => ({}),
    },

    sharing: {
      type: sharingSchema,
      default: () => ({}),
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
      trim: true,
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
      type: accessibilitySchema,
      default: () => ({}),
    },

    savedLoginInformation: {
      type: Boolean,
      default: true,
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "UserSettings",
  userSettingsSchema
);